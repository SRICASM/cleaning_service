"""
Dynamic Pricing Engine

Implements utilization-based demand pricing and rush premiums
for the cleaning service marketplace.

Pricing Formula:
    Final Price = Base Price × Demand Multiplier × Rush Premium

Utilization Tiers (cleaner capacity in region):
    - 0-50%  → 1.00x (standard pricing)
    - 50-70% → 1.02x (+2% surge)
    - 70-85% → 1.05x (+5% surge)
    - 85%+   → 1.10x (+10% surge)

Rush Premiums (booking lead time):
    - Same day    → 1.25x (+25%)
    - Next day    → 1.15x (+15%)
    - Within 3 days → 1.05x (+5%)
    - 4+ days     → 1.00x (no premium)
"""
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging

from app.services.cache import cache_service
from app.models import Booking, BookingStatus
from app.models.employee import Employee, EmployeeAccountStatus, EmployeeCleanerStatus

logger = logging.getLogger(__name__)


class PricingEngine:
    """
    Dynamic pricing engine that calculates demand-based multipliers
    and rush premiums for bookings.
    """

    # Utilization-based demand tiers
    # (max_utilization_threshold, multiplier)
    UTILIZATION_TIERS = [
        (Decimal("0.50"), Decimal("1.00")),  # 0-50%: standard
        (Decimal("0.70"), Decimal("1.02")),  # 50-70%: +2%
        (Decimal("0.85"), Decimal("1.05")),  # 70-85%: +5%
        (Decimal("1.00"), Decimal("1.10")),  # 85%+: +10%
    ]

    # Rush premiums based on days until booking
    RUSH_PREMIUMS = {
        0: Decimal("1.25"),   # Same day: +25%
        1: Decimal("1.15"),   # Next day: +15%
        2: Decimal("1.05"),   # 2 days: +5%
        3: Decimal("1.05"),   # 3 days: +5%
    }
    DEFAULT_RUSH_PREMIUM = Decimal("1.00")  # 4+ days: no premium

    # Working hours per cleaner per day (for utilization calculation)
    WORKING_HOURS_PER_CLEANER = 8

    # Cache TTL for utilization data (5 minutes)
    UTILIZATION_CACHE_TTL = 300

    def __init__(self, db: Session):
        self.db = db

    async def calculate_dynamic_price(
        self,
        base_price: Decimal,
        region_code: str,
        scheduled_date: datetime,
        service_duration_hours: float = 2.5
    ) -> Dict:
        """
        Calculate the final price with dynamic pricing applied.

        Args:
            base_price: The base price before any dynamic adjustments
            region_code: The region code (DXB, AUH, etc.)
            scheduled_date: When the service is scheduled
            service_duration_hours: Expected duration of the service

        Returns:
            Dict with pricing breakdown:
            {
                "base_price": Decimal,
                "demand_multiplier": Decimal,
                "rush_premium": Decimal,
                "final_multiplier": Decimal,
                "adjusted_price": Decimal,
                "utilization_percentage": float,
                "days_until_booking": int,
                "pricing_tier": str,
                "rush_tier": str
            }
        """
        # Get demand multiplier based on utilization
        demand_multiplier, utilization, pricing_tier = await self._get_demand_multiplier(
            region_code, scheduled_date, service_duration_hours
        )

        # Get rush premium based on booking lead time
        rush_premium, days_ahead, rush_tier = self._get_rush_premium(scheduled_date)

        # Calculate final multiplier and price
        final_multiplier = demand_multiplier * rush_premium
        adjusted_price = (base_price * final_multiplier).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        return {
            "base_price": base_price,
            "demand_multiplier": demand_multiplier,
            "rush_premium": rush_premium,
            "final_multiplier": final_multiplier,
            "adjusted_price": adjusted_price,
            "utilization_percentage": float(utilization * 100),
            "days_until_booking": days_ahead,
            "pricing_tier": pricing_tier,
            "rush_tier": rush_tier
        }

    async def _get_demand_multiplier(
        self,
        region_code: str,
        scheduled_date: datetime,
        service_duration_hours: float
    ) -> Tuple[Decimal, Decimal, str]:
        """
        Calculate demand multiplier based on region utilization.

        Returns:
            Tuple of (multiplier, utilization_ratio, tier_name)
        """
        # Try to get cached utilization first
        cache_key = f"utilization:{region_code}:{scheduled_date.date().isoformat()}"
        cached = await cache_service.get(cache_key)

        if cached:
            utilization = Decimal(cached)
        else:
            utilization = await self._calculate_region_utilization(
                region_code, scheduled_date
            )
            # Cache the result
            await cache_service.set(
                cache_key,
                str(utilization),
                ttl=self.UTILIZATION_CACHE_TTL
            )

        # Determine tier and multiplier
        multiplier = Decimal("1.10")  # Default to highest tier
        tier_name = "peak"

        for threshold, tier_multiplier in self.UTILIZATION_TIERS:
            if utilization <= threshold:
                multiplier = tier_multiplier
                if threshold <= Decimal("0.50"):
                    tier_name = "standard"
                elif threshold <= Decimal("0.70"):
                    tier_name = "moderate"
                elif threshold <= Decimal("0.85"):
                    tier_name = "high"
                else:
                    tier_name = "peak"
                break

        logger.info(
            f"Demand pricing for {region_code} on {scheduled_date.date()}: "
            f"utilization={utilization:.2%}, multiplier={multiplier}, tier={tier_name}"
        )

        return multiplier, utilization, tier_name

    async def _calculate_region_utilization(
        self,
        region_code: str,
        scheduled_date: datetime
    ) -> Decimal:
        """
        Calculate the utilization ratio for a region on a specific date.

        Utilization = Booked Hours / Available Hours

        Available Hours = Active Cleaners × Working Hours Per Day
        Booked Hours = Sum of all booking durations
        """
        booking_date = scheduled_date.date()

        # Count active cleaners in the region
        active_cleaners = self.db.query(func.count(Employee.id)).filter(
            Employee.region_code == region_code,
            Employee.account_status == EmployeeAccountStatus.ACTIVE
        ).scalar() or 0

        if active_cleaners == 0:
            # No cleaners = full utilization (forces highest pricing)
            return Decimal("1.0")

        # Calculate total available hours
        available_hours = active_cleaners * self.WORKING_HOURS_PER_CLEANER

        # Get booked hours for the date
        # We need to sum up the durations of all non-cancelled bookings
        start_of_day = datetime.combine(booking_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_of_day = datetime.combine(booking_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        # Query bookings in this region for the date
        # Join with Address to filter by region
        from app.models import Address

        bookings = self.db.query(Booking).join(
            Address, Booking.address_id == Address.id
        ).filter(
            Booking.scheduled_date >= start_of_day,
            Booking.scheduled_date <= end_of_day,
            Booking.status.notin_([
                BookingStatus.CANCELLED,
                BookingStatus.REFUNDED,
                BookingStatus.NO_SHOW
            ])
        ).all()

        # Filter by region (using city mapping)
        from app.services.cleaner_assignment import get_region_from_city

        booked_hours = Decimal("0")
        for booking in bookings:
            if booking.address and booking.address.city:
                booking_region = get_region_from_city(booking.address.city)
                if booking_region == region_code:
                    # Get service duration
                    if booking.service and booking.service.base_duration_hours:
                        booked_hours += Decimal(str(booking.service.base_duration_hours))
                    else:
                        booked_hours += Decimal("2.5")  # Default duration

        # Calculate utilization ratio
        if available_hours > 0:
            utilization = booked_hours / Decimal(str(available_hours))
            # Cap at 1.0 (100%)
            utilization = min(utilization, Decimal("1.0"))
        else:
            utilization = Decimal("1.0")

        logger.debug(
            f"Region {region_code} utilization on {booking_date}: "
            f"booked={booked_hours}h, available={available_hours}h, ratio={utilization:.2%}"
        )

        return utilization

    def _get_rush_premium(
        self,
        scheduled_date: datetime
    ) -> Tuple[Decimal, int, str]:
        """
        Calculate rush premium based on how far ahead the booking is.

        Returns:
            Tuple of (premium_multiplier, days_ahead, tier_name)
        """
        today = date.today()
        booking_date = scheduled_date.date() if isinstance(scheduled_date, datetime) else scheduled_date

        days_ahead = (booking_date - today).days

        # Handle edge case of past dates
        if days_ahead < 0:
            days_ahead = 0

        # Get premium from lookup table
        premium = self.RUSH_PREMIUMS.get(days_ahead, self.DEFAULT_RUSH_PREMIUM)

        # Determine tier name
        if days_ahead == 0:
            tier_name = "same_day"
        elif days_ahead == 1:
            tier_name = "next_day"
        elif days_ahead <= 3:
            tier_name = "short_notice"
        else:
            tier_name = "standard"

        logger.info(
            f"Rush premium: {days_ahead} days ahead, "
            f"premium={premium}, tier={tier_name}"
        )

        return premium, days_ahead, tier_name

    async def get_pricing_preview(
        self,
        service_id: int,
        region_code: str,
        scheduled_date: datetime,
        property_size_sqft: int,
        bedrooms: int,
        bathrooms: int,
        add_on_ids: list = None
    ) -> Dict:
        """
        Get a complete pricing preview for a potential booking.

        This is used by the frontend to show customers the price
        breakdown before they confirm the booking.
        """
        from app.models import Service, AddOn

        # Get service
        service = self.db.query(Service).filter(
            Service.id == service_id,
            Service.is_active == True
        ).first()

        if not service:
            raise ValueError(f"Service {service_id} not found")

        # Calculate base price components
        base_price = Decimal(str(service.base_price))
        size_adjustment = Decimal(str(service.price_per_sqft or 0)) * property_size_sqft
        bedroom_adjustment = Decimal(str(service.price_per_bedroom or 0)) * bedrooms
        bathroom_adjustment = Decimal(str(service.price_per_bathroom or 0)) * bathrooms

        # Get add-ons
        add_ons_total = Decimal("0")
        add_ons_detail = []
        if add_on_ids:
            add_ons = self.db.query(AddOn).filter(
                AddOn.id.in_(add_on_ids),
                AddOn.is_active == True
            ).all()
            for addon in add_ons:
                add_ons_total += Decimal(str(addon.price))
                add_ons_detail.append({
                    "id": addon.id,
                    "name": addon.name,
                    "price": float(addon.price)
                })

        # Calculate subtotal before dynamic pricing
        subtotal = base_price + size_adjustment + bedroom_adjustment + bathroom_adjustment + add_ons_total

        # Get service duration for utilization calculation
        service_duration = float(service.base_duration_hours or 2.5)

        # Calculate dynamic pricing
        dynamic_pricing = await self.calculate_dynamic_price(
            base_price=subtotal,
            region_code=region_code,
            scheduled_date=scheduled_date,
            service_duration_hours=service_duration
        )

        # Calculate tax on adjusted price
        tax_rate = Decimal("0.05")  # 5% VAT
        tax_amount = (dynamic_pricing["adjusted_price"] * tax_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # Final total
        final_total = dynamic_pricing["adjusted_price"] + tax_amount

        return {
            "service": {
                "id": service.id,
                "name": service.name,
                "base_price": float(service.base_price)
            },
            "property": {
                "size_sqft": property_size_sqft,
                "bedrooms": bedrooms,
                "bathrooms": bathrooms
            },
            "price_breakdown": {
                "base_price": float(base_price),
                "size_adjustment": float(size_adjustment),
                "bedroom_adjustment": float(bedroom_adjustment),
                "bathroom_adjustment": float(bathroom_adjustment),
                "add_ons_total": float(add_ons_total),
                "subtotal": float(subtotal)
            },
            "add_ons": add_ons_detail,
            "dynamic_pricing": {
                "demand_multiplier": float(dynamic_pricing["demand_multiplier"]),
                "rush_premium": float(dynamic_pricing["rush_premium"]),
                "final_multiplier": float(dynamic_pricing["final_multiplier"]),
                "utilization_percentage": dynamic_pricing["utilization_percentage"],
                "days_until_booking": dynamic_pricing["days_until_booking"],
                "pricing_tier": dynamic_pricing["pricing_tier"],
                "rush_tier": dynamic_pricing["rush_tier"]
            },
            "totals": {
                "subtotal_before_dynamic": float(subtotal),
                "subtotal_after_dynamic": float(dynamic_pricing["adjusted_price"]),
                "dynamic_adjustment": float(dynamic_pricing["adjusted_price"] - subtotal),
                "tax_rate": float(tax_rate),
                "tax_amount": float(tax_amount),
                "final_total": float(final_total)
            },
            "scheduled_date": scheduled_date.isoformat(),
            "region_code": region_code
        }

    async def update_utilization_cache(self, region_code: str, booking_date: date):
        """
        Force update the utilization cache for a region/date.

        Call this after a booking is created or cancelled to ensure
        accurate pricing for subsequent bookings.
        """
        cache_key = f"utilization:{region_code}:{booking_date.isoformat()}"

        # Calculate fresh utilization
        scheduled_datetime = datetime.combine(
            booking_date,
            datetime.min.time()
        ).replace(tzinfo=timezone.utc)

        utilization = await self._calculate_region_utilization(
            region_code, scheduled_datetime
        )

        # Update cache
        await cache_service.set(
            cache_key,
            str(utilization),
            ttl=self.UTILIZATION_CACHE_TTL
        )

        logger.info(
            f"Updated utilization cache for {region_code} on {booking_date}: {utilization:.2%}"
        )

        return utilization
