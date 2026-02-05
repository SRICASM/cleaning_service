"""
Calendar Service for Subscription Visit Scheduling

Generates suggested visit slots based on:
- User preferences (preferred days, time slots)
- Subscription allocation
- Cleaner availability
- Existing bookings
"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional, List, Tuple
import logging

from app.models.subscription import Subscription, SubscriptionVisit, SubscriptionStatus
from app.models.booking import Booking, BookingStatus, TimeSlot
from app.models.employee import Employee, EmployeeAccountStatus
from app.models.service import Service

logger = logging.getLogger(__name__)

# Standard time slots
TIME_SLOTS = [
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM"
]

# Day name mapping
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class CalendarService:
    """Service for managing subscription visit calendars."""

    def __init__(self, db: Session):
        self.db = db

    def get_subscription_calendar(
        self,
        subscription: Subscription,
        month: Optional[str] = None  # "YYYY-MM" format
    ) -> dict:
        """
        Get calendar view for a subscription.

        Returns:
        - Visit slots for the month
        - Scheduled visits
        - Suggested slots based on preferences
        """
        if not month:
            month = datetime.utcnow().strftime("%Y-%m")

        # Parse month
        year, month_num = map(int, month.split("-"))
        month_start = datetime(year, month_num, 1)
        month_end = (month_start + relativedelta(months=1)) - timedelta(days=1)

        # Get visits for this billing cycle
        visits = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.subscription_id == subscription.id,
            SubscriptionVisit.billing_cycle_month == month
        ).all()

        # Get scheduled visits (those with booking_id)
        scheduled_visits = [v for v in visits if v.booking_id]
        unscheduled_visits = [v for v in visits if not v.booking_id and not v.is_cancelled]

        # Generate suggested slots
        suggested_slots = self._generate_suggested_slots(
            subscription,
            month_start,
            month_end,
            len(unscheduled_visits)
        )

        # Get existing bookings for this period
        existing_bookings = self._get_existing_bookings(
            subscription.user_id,
            month_start,
            month_end
        )

        return {
            "subscription_id": subscription.id,
            "billing_cycle_month": month,
            "visits_total": len(visits),
            "visits_scheduled": len(scheduled_visits),
            "visits_completed": sum(1 for v in visits if v.is_used),
            "visits_remaining": len(unscheduled_visits),
            "scheduled_visits": [
                {
                    "visit_id": v.id,
                    "visit_number": v.visit_number,
                    "scheduled_date": v.scheduled_date.isoformat() if v.scheduled_date else None,
                    "booking_id": v.booking_id,
                    "is_rollover": v.is_rollover,
                    "is_used": v.is_used
                }
                for v in scheduled_visits
            ],
            "unscheduled_visits": [
                {
                    "visit_id": v.id,
                    "visit_number": v.visit_number,
                    "is_rollover": v.is_rollover
                }
                for v in unscheduled_visits
            ],
            "suggested_slots": suggested_slots,
            "existing_bookings": [
                {
                    "booking_id": b.id,
                    "scheduled_date": b.scheduled_date.isoformat(),
                    "status": b.status.value
                }
                for b in existing_bookings
            ]
        }

    def _generate_suggested_slots(
        self,
        subscription: Subscription,
        start_date: datetime,
        end_date: datetime,
        num_visits: int
    ) -> List[dict]:
        """
        Generate suggested visit slots based on preferences.

        Distribution strategy:
        - Spread visits evenly across the month
        - Prioritize preferred days
        - Use preferred time slot
        """
        if num_visits <= 0:
            return []

        suggestions = []
        preferred_days = subscription.preferred_days or [0, 3]  # Default: Mon, Thu
        preferred_time = subscription.preferred_time_slot or "09:00 AM"

        # Calculate ideal interval between visits
        total_days = (end_date - start_date).days + 1
        ideal_interval = total_days / num_visits if num_visits > 0 else 7

        current_date = start_date
        visits_suggested = 0

        while current_date <= end_date and visits_suggested < num_visits:
            weekday = current_date.weekday()

            # Check if this is a preferred day
            if weekday in preferred_days:
                # Check availability for this slot
                is_available = self._check_slot_availability(
                    subscription,
                    current_date,
                    preferred_time
                )

                suggestions.append({
                    "date": current_date.strftime("%Y-%m-%d"),
                    "day_name": DAY_NAMES[weekday],
                    "time_slot": preferred_time,
                    "is_available": is_available,
                    "is_preferred": True,
                    "visit_number": visits_suggested + 1
                })
                visits_suggested += 1

                # Skip to next week to spread visits
                current_date += timedelta(days=7)
            else:
                current_date += timedelta(days=1)

        # If we couldn't fill all slots with preferred days, fill with any available day
        if visits_suggested < num_visits:
            current_date = start_date
            while current_date <= end_date and visits_suggested < num_visits:
                # Skip already suggested dates
                date_str = current_date.strftime("%Y-%m-%d")
                if not any(s["date"] == date_str for s in suggestions):
                    is_available = self._check_slot_availability(
                        subscription,
                        current_date,
                        preferred_time
                    )
                    suggestions.append({
                        "date": date_str,
                        "day_name": DAY_NAMES[current_date.weekday()],
                        "time_slot": preferred_time,
                        "is_available": is_available,
                        "is_preferred": False,
                        "visit_number": visits_suggested + 1
                    })
                    visits_suggested += 1

                current_date += timedelta(days=1)

        # Sort by date
        suggestions.sort(key=lambda x: x["date"])
        return suggestions

    def _check_slot_availability(
        self,
        subscription: Subscription,
        date: datetime,
        time_slot: str
    ) -> bool:
        """Check if a time slot is available for booking."""
        # Parse time slot to datetime
        slot_datetime = self._parse_slot_datetime(date, time_slot)

        # Check for existing booking at this time
        existing = self.db.query(Booking).filter(
            Booking.customer_id == subscription.user_id,
            Booking.address_id == subscription.address_id,
            Booking.scheduled_date == slot_datetime,
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.NO_SHOW])
        ).first()

        return existing is None

    def _parse_slot_datetime(self, date: datetime, time_slot: str) -> datetime:
        """Convert date and time slot string to datetime."""
        # Parse time like "09:00 AM"
        time_parts = time_slot.replace(" AM", "").replace(" PM", "").split(":")
        hour = int(time_parts[0])
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0

        if "PM" in time_slot and hour != 12:
            hour += 12
        elif "AM" in time_slot and hour == 12:
            hour = 0

        return date.replace(hour=hour, minute=minute, second=0, microsecond=0)

    def _get_existing_bookings(
        self,
        user_id: int,
        start_date: datetime,
        end_date: datetime
    ) -> List[Booking]:
        """Get existing bookings for a user in date range."""
        return self.db.query(Booking).filter(
            Booking.customer_id == user_id,
            Booking.scheduled_date >= start_date,
            Booking.scheduled_date <= end_date,
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.NO_SHOW])
        ).order_by(Booking.scheduled_date).all()

    def get_available_slots(
        self,
        subscription: Subscription,
        date: datetime
    ) -> List[dict]:
        """Get all available time slots for a specific date."""
        slots = []

        for time_slot in TIME_SLOTS:
            slot_datetime = self._parse_slot_datetime(date, time_slot)

            # Skip past slots
            if slot_datetime < datetime.utcnow():
                continue

            is_available = self._check_slot_availability(subscription, date, time_slot)

            slots.append({
                "time_slot": time_slot,
                "datetime": slot_datetime.isoformat(),
                "is_available": is_available,
                "is_preferred": time_slot == subscription.preferred_time_slot
            })

        return slots

    def schedule_visit_from_subscription(
        self,
        subscription: Subscription,
        scheduled_date: datetime,
        notes: Optional[str] = None
    ) -> Tuple[SubscriptionVisit, Booking]:
        """
        Schedule a visit from the subscription.

        Creates a booking and links it to an available visit slot.
        """
        if subscription.status != SubscriptionStatus.ACTIVE:
            raise ValueError("Subscription is not active")

        if subscription.visits_remaining <= 0:
            raise ValueError("No visits remaining")

        # Find an available visit slot
        visit = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.subscription_id == subscription.id,
            SubscriptionVisit.is_used == False,
            SubscriptionVisit.is_cancelled == False,
            SubscriptionVisit.booking_id == None
        ).order_by(
            SubscriptionVisit.is_rollover.asc(),  # Use regular visits first
            SubscriptionVisit.visit_number.asc()
        ).first()

        if not visit:
            raise ValueError("No visit slots available")

        # Generate booking number
        booking_number = self._generate_booking_number()

        # Calculate pricing (subscription visits are pre-paid)
        service = subscription.service
        base_price = service.base_price

        # Create booking
        booking = Booking(
            booking_number=booking_number,
            customer_id=subscription.user_id,
            service_id=subscription.service_id,
            address_id=subscription.address_id,
            scheduled_date=scheduled_date,
            property_size_sqft=subscription.property_size_sqft,
            bedrooms=subscription.bedrooms,
            bathrooms=subscription.bathrooms,
            customer_notes=notes,
            status=BookingStatus.CONFIRMED,  # Auto-confirm subscription bookings
            payment_status="paid",  # Already paid via subscription
            base_price=base_price,
            total_price=0,  # Included in subscription
            is_subscription_booking=True
        )

        self.db.add(booking)
        self.db.flush()  # Get booking ID

        # Link visit to booking
        visit.booking_id = booking.id
        visit.scheduled_date = scheduled_date
        visit.is_used = True
        visit.used_at = datetime.utcnow()

        # Update subscription counters
        subscription.visits_used += 1
        subscription.visits_remaining -= 1

        # Assign preferred cleaner if set
        if subscription.preferred_cleaner_id:
            booking.assigned_employee_id = subscription.preferred_cleaner_id

        self.db.commit()
        self.db.refresh(visit)
        self.db.refresh(booking)

        logger.info(
            f"Scheduled subscription visit {visit.id} as booking {booking.booking_number}"
        )

        return visit, booking

    def _generate_booking_number(self) -> str:
        """Generate a unique booking number."""
        import uuid
        return f"BK-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    def reschedule_subscription_visit(
        self,
        visit_id: int,
        new_date: datetime,
        reason: Optional[str] = None
    ) -> SubscriptionVisit:
        """
        Reschedule an existing subscription visit.

        Updates the linked booking's scheduled date.
        """
        visit = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.id == visit_id
        ).first()

        if not visit:
            raise ValueError("Visit not found")

        if not visit.booking_id:
            raise ValueError("Visit has no booking to reschedule")

        booking = self.db.query(Booking).filter(
            Booking.id == visit.booking_id
        ).first()

        if booking.status in [BookingStatus.COMPLETED, BookingStatus.IN_PROGRESS]:
            raise ValueError("Cannot reschedule a completed or in-progress booking")

        # Update booking
        booking.scheduled_date = new_date
        if reason:
            booking.internal_notes = f"Rescheduled: {reason}"

        # Update visit
        visit.scheduled_date = new_date

        self.db.commit()
        self.db.refresh(visit)

        logger.info(f"Rescheduled visit {visit_id} to {new_date}")
        return visit

    def cancel_subscription_visit(
        self,
        visit_id: int,
        reason: Optional[str] = None
    ) -> SubscriptionVisit:
        """
        Cancel a scheduled subscription visit.

        Returns the visit credit to the subscription.
        """
        visit = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.id == visit_id
        ).first()

        if not visit:
            raise ValueError("Visit not found")

        subscription = visit.subscription

        # If visit has a booking, cancel it
        if visit.booking_id:
            booking = self.db.query(Booking).filter(
                Booking.id == visit.booking_id
            ).first()

            if booking and booking.status not in [
                BookingStatus.COMPLETED,
                BookingStatus.IN_PROGRESS
            ]:
                booking.status = BookingStatus.CANCELLED
                booking.cancellation_reason = reason or "Subscription visit cancelled"

        # Reset visit
        visit.booking_id = None
        visit.scheduled_date = None
        visit.is_used = False
        visit.used_at = None

        # Return credit to subscription
        subscription.visits_used = max(0, subscription.visits_used - 1)
        subscription.visits_remaining += 1

        self.db.commit()
        self.db.refresh(visit)

        logger.info(f"Cancelled visit {visit_id}, credit returned to subscription")
        return visit
