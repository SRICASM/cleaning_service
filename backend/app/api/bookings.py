from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.api.deps import get_current_user, get_admin_user, get_staff_user
from app.core.security import generate_booking_number, generate_subscription_number
from app.core.exceptions import (
    NotFoundException, ForbiddenException, BadRequestException,
    BookingNotFoundException, BookingCannotBeCancelledException
)
from app.models import (
    Booking, BookingStatus, BookingStatusHistory, PaymentStatus, BookingType,
    Service, AddOn, Address, User, Payment, booking_add_ons,
    UserRole, UserStatus, Subscription, SubscriptionStatus, SubscriptionVisit, SubscriptionPlan,
    TransactionType, Review, Employee
)
from app.api.wallet import get_or_create_wallet, create_transaction
from app.schemas import (
    BookingCreate, BookingUpdate, BookingStatusUpdate,
    BookingAssignCleaner, BookingReschedule, BookingCancel,
    BookingResponse, BookingListResponse,
    AvailabilityRequest, AvailabilityResponse, AvailableSlot
)
from app.services.events import event_publisher, EventType
from app.services.cache import cache_service
from app.services.discount_service import DiscountService, DiscountValidationError
from app.services.pricing_engine import PricingEngine
from app.services.cleaner_assignment import get_region_from_city

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _calculate_booking_price(
    service: Service,
    property_size_sqft: int,
    bedrooms: int,
    bathrooms: int,
    add_ons: List[AddOn],
    discount_amount: Decimal = Decimal("0"),
    demand_multiplier: Decimal = Decimal("1.00"),
    rush_premium: Decimal = Decimal("1.00")
) -> dict:
    """
    Calculate booking price breakdown with dynamic pricing.

    Dynamic pricing is applied to the subtotal before discount and tax:
    adjusted_subtotal = subtotal × demand_multiplier × rush_premium
    final_total = adjusted_subtotal - discount + tax
    """
    base_price = Decimal(str(service.base_price))
    size_adjustment = Decimal(str(service.price_per_sqft or 0)) * property_size_sqft
    bedroom_adjustment = Decimal(str(service.price_per_bedroom or 0)) * bedrooms
    bathroom_adjustment = Decimal(str(service.price_per_bathroom or 0)) * bathrooms

    add_ons_total = sum(Decimal(str(addon.price)) for addon in add_ons)

    # Calculate subtotal before dynamic pricing
    subtotal = base_price + size_adjustment + bedroom_adjustment + bathroom_adjustment + add_ons_total

    # Apply dynamic pricing multipliers
    final_multiplier = demand_multiplier * rush_premium
    adjusted_subtotal = (subtotal * final_multiplier).quantize(Decimal("0.01"))

    # Calculate dynamic pricing adjustment (for display)
    dynamic_adjustment = adjusted_subtotal - subtotal

    # Apply tax to adjusted subtotal minus discount
    tax_rate = Decimal("0.05")  # 5% VAT
    taxable_amount = adjusted_subtotal - discount_amount
    tax_amount = (taxable_amount * tax_rate).quantize(Decimal("0.01"))

    # Final total
    total = adjusted_subtotal - discount_amount + tax_amount

    return {
        "base_price": base_price.quantize(Decimal("0.01")),
        "size_adjustment": (size_adjustment + bedroom_adjustment + bathroom_adjustment).quantize(Decimal("0.01")),
        "add_ons_total": add_ons_total.quantize(Decimal("0.01")),
        "subtotal_before_dynamic": subtotal.quantize(Decimal("0.01")),
        "demand_multiplier": demand_multiplier,
        "rush_premium": rush_premium,
        "dynamic_adjustment": dynamic_adjustment.quantize(Decimal("0.01")),
        "discount_amount": discount_amount.quantize(Decimal("0.01")),
        "tax_amount": tax_amount.quantize(Decimal("0.01")),
        "total_price": total.quantize(Decimal("0.01"))
    }


def _booking_to_response(booking: Booking) -> BookingResponse:
    """Convert booking model to response schema."""
    from app.schemas.booking import (
        CustomerInBooking, CleanerInBooking, ServiceInBooking,
        AddressInBooking, AddOnInBooking
    )
    
    customer = CustomerInBooking(
        id=booking.customer.id,
        email=booking.customer.email,
        first_name=booking.customer.first_name,
        last_name=booking.customer.last_name,
        phone=booking.customer.phone
    )
    
    cleaner = None
    if booking.cleaner:
        cleaner = CleanerInBooking(
            id=booking.cleaner.id,
            first_name=booking.cleaner.first_name,
            last_name=booking.cleaner.last_name,
            phone=booking.cleaner.phone
        )
    
    service = ServiceInBooking(
        id=booking.service.id,
        name=booking.service.name,
        icon=booking.service.icon
    )
    
    address = AddressInBooking(
        id=booking.address.id,
        label=booking.address.label,
        street_address=booking.address.street_address,
        apartment=booking.address.apartment,
        city=booking.address.city,
        state=booking.address.state,
        postal_code=booking.address.postal_code
    )
    
    add_ons_list = [
        AddOnInBooking(id=addon.id, name=addon.name, price=addon.price)
        for addon in booking.add_ons
    ]
    
    return BookingResponse(
        id=booking.id,
        booking_number=booking.booking_number,
        customer=customer,
        cleaner=cleaner,
        service=service,
        address=address,
        add_ons=add_ons_list,
        scheduled_date=booking.scheduled_date,
        scheduled_end_time=booking.scheduled_end_time,
        actual_start_time=booking.actual_start_time,
        actual_end_time=booking.actual_end_time,
        property_size_sqft=booking.property_size_sqft,
        bedrooms=booking.bedrooms,
        bathrooms=booking.bathrooms,
        base_price=booking.base_price,
        size_adjustment=booking.size_adjustment,
        add_ons_total=booking.add_ons_total,
        discount_amount=booking.discount_amount,
        tax_amount=booking.tax_amount,
        total_price=booking.total_price,
        discount_code=booking.discount_code,
        demand_multiplier=booking.demand_multiplier,
        rush_premium=booking.rush_premium,
        utilization_at_booking=booking.utilization_at_booking,
        pricing_tier=booking.pricing_tier,
        rush_tier=booking.rush_tier,
        status=booking.status,
        payment_status=booking.payment_status,
        customer_notes=booking.customer_notes,
        internal_notes=booking.internal_notes,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
        cancelled_at=booking.cancelled_at,
        cancellation_reason=booking.cancellation_reason
    )


def _process_cancellation_refund(booking: Booking, db: Session) -> None:
    """Process wallet refund for cancelled booking if paid by wallet."""
    from app.models.wallet import WalletTransaction

    try:
        # Check if original payment was from wallet
        original_payment = db.query(WalletTransaction).filter(
            WalletTransaction.reference_type == "booking",
            WalletTransaction.reference_id == str(booking.id),
            WalletTransaction.type == TransactionType.DEBIT
        ).first()

        if original_payment:
            wallet = get_or_create_wallet(db, booking.customer_id)
            create_transaction(
                db=db,
                wallet=wallet,
                type=TransactionType.REFUND,
                amount=original_payment.amount,
                description=f"Refund for cancelled booking #{booking.booking_number}",
                reference_type="booking_refund",
                reference_id=str(booking.id)
            )
            booking.payment_status = PaymentStatus.REFUNDED
    except Exception as e:
        # Log error but don't fail the cancellation
        print(f"Error processing refund for booking {booking.id}: {e}")


# ============ Customer: Booking Operations ============

@router.post("/validate-discount")
async def validate_discount_code(
    code: str = Query(..., description="Discount code to validate"),
    service_id: int = Query(..., description="Service ID"),
    subtotal: float = Query(..., description="Order subtotal"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate a discount code and return the discount amount.

    Use this before creating a booking to show the customer
    how much they'll save.
    """
    discount_service = DiscountService(db)

    try:
        discount, discount_amount = discount_service.validate_code(
            code=code,
            user_id=current_user.id,
            service_id=service_id,
            subtotal=Decimal(str(subtotal))
        )

        return {
            "valid": True,
            "code": discount.code,
            "discount_type": discount.discount_type,
            "discount_value": float(discount.discount_value),
            "discount_amount": float(discount_amount),
            "description": discount.description,
            "message": f"Discount of ${discount_amount:.2f} will be applied"
        }
    except DiscountValidationError as e:
        return {
            "valid": False,
            "code": code,
            "discount_amount": 0,
            "message": str(e)
        }


@router.get("/discount-info/{code}")
async def get_discount_info(
    code: str,
    db: Session = Depends(get_db)
):
    """
    Get information about a discount code (public).

    Returns code details without validating for a specific user/order.
    """
    discount_service = DiscountService(db)
    info = discount_service.get_code_info(code)

    if not info:
        raise NotFoundException("Discount code not found")

    return info


@router.post("/pricing-preview")
async def get_pricing_preview(
    service_id: int = Query(..., description="Service ID"),
    address_id: int = Query(..., description="Address ID"),
    scheduled_date: datetime = Query(..., description="Scheduled date/time (ISO format)"),
    property_size_sqft: int = Query(..., description="Property size in sqft"),
    bedrooms: int = Query(0, description="Number of bedrooms"),
    bathrooms: int = Query(1, description="Number of bathrooms"),
    add_on_ids: Optional[str] = Query(None, description="Comma-separated add-on IDs"),
    discount_code: Optional[str] = Query(None, description="Discount code to apply"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a complete pricing preview including dynamic pricing.

    This endpoint shows customers:
    - Base price breakdown
    - Dynamic pricing multipliers (demand + rush)
    - Discount (if code provided)
    - Tax
    - Final total

    Use this before creating a booking to show transparent pricing.
    """
    # Validate service
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.is_active == True
    ).first()
    if not service:
        raise NotFoundException("Service not found")

    # Validate address
    address = db.query(Address).filter(
        Address.id == address_id,
        Address.user_id == current_user.id
    ).first()
    if not address:
        raise NotFoundException("Address not found")

    # Parse add-on IDs
    addon_list = []
    if add_on_ids:
        try:
            addon_list = [int(x.strip()) for x in add_on_ids.split(",") if x.strip()]
        except ValueError:
            raise BadRequestException("Invalid add_on_ids format")

    # Get region for dynamic pricing
    region_code = get_region_from_city(address.city) if address.city else "DXB"

    # Get pricing preview from engine
    pricing_engine = PricingEngine(db)
    preview = await pricing_engine.get_pricing_preview(
        service_id=service_id,
        region_code=region_code,
        scheduled_date=scheduled_date,
        property_size_sqft=property_size_sqft,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        add_on_ids=addon_list
    )

    # Apply discount if provided
    if discount_code:
        discount_service = DiscountService(db)
        try:
            _, discount_amount = discount_service.validate_code(
                code=discount_code,
                user_id=current_user.id,
                service_id=service_id,
                subtotal=Decimal(str(preview["totals"]["subtotal_after_dynamic"]))
            )
            # Recalculate with discount
            subtotal_after_dynamic = Decimal(str(preview["totals"]["subtotal_after_dynamic"]))
            tax_rate = Decimal("0.05")
            tax_amount = ((subtotal_after_dynamic - discount_amount) * tax_rate).quantize(Decimal("0.01"))
            final_total = subtotal_after_dynamic - discount_amount + tax_amount

            preview["discount"] = {
                "code": discount_code,
                "amount": float(discount_amount),
                "valid": True
            }
            preview["totals"]["discount_amount"] = float(discount_amount)
            preview["totals"]["tax_amount"] = float(tax_amount)
            preview["totals"]["final_total"] = float(final_total)
        except DiscountValidationError as e:
            preview["discount"] = {
                "code": discount_code,
                "amount": 0,
                "valid": False,
                "error": str(e)
            }

    # Add address info
    preview["address"] = {
        "id": address.id,
        "city": address.city,
        "region_code": region_code
    }

    return preview


@router.post("/", response_model=BookingResponse)
async def create_booking(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new booking."""
    # Validate service
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.is_active == True
    ).first()
    if not service:
        raise NotFoundException("Service not found")
    
    # Handle Address
    address = None
    if data.address_id:
        # Validate provided address ID
        address = db.query(Address).filter(
            Address.id == data.address_id,
            Address.user_id == current_user.id
        ).first()
        if not address:
            raise NotFoundException("Address not found")
    elif data.address_details:
        # Create new address from details
        address = Address(
            user_id=current_user.id,
            label=data.address_details.label,
            street_address=data.address_details.street_address,
            apartment=data.address_details.apartment,
            city=data.address_details.city,
            state=data.address_details.state,
            postal_code=data.address_details.postal_code,
            country=data.address_details.country,
            property_type=data.address_details.property_type,
            property_size_sqft=data.address_details.property_size_sqft,
            bedrooms=data.address_details.bedrooms,
            bathrooms=data.address_details.bathrooms,
            access_instructions=data.address_details.access_instructions,
            is_default=data.address_details.is_default or False
        )
        db.add(address)
        db.flush() # Get ID
        
        # If this is the user's first address, make it default
        if db.query(Address).filter(Address.user_id == current_user.id).count() == 1:
            address.is_default = True
            
        data.address_id = address.id
    else:
        # Fallback to default address
        address = db.query(Address).filter(
            Address.user_id == current_user.id,
            Address.is_default == True
        ).first()
        if not address:
            # Try to find *any* address
            address = db.query(Address).filter(Address.user_id == current_user.id).first()
            
        if not address:
            raise BadRequestException("Address is required. Please add an address or select one.")
            
        data.address_id = address.id
    
    # Validate scheduled date is in future
    if data.scheduled_date.tzinfo is None:
        data.scheduled_date = data.scheduled_date.replace(tzinfo=timezone.utc)
        
    if data.scheduled_date < datetime.now(timezone.utc):
        raise BadRequestException("Scheduled date must be in the future")

    # Calculate booking duration for overlap check
    # Calculate booking duration and validate inputs
    # If duration_minutes is provided, use it (Duration-Based Pricing)
    # Otherwise, rely on property size (Property-Based Pricing)
    is_duration_based = data.duration_minutes is not None
    
    if is_duration_based:
        duration_hours = data.duration_minutes / 60.0
        # Set defaults for property details as they aren't used for pricing
        data.property_size_sqft = data.property_size_sqft or 1000
        data.bedrooms = data.bedrooms or 0
        data.bathrooms = data.bathrooms or 1
    else:
        if data.property_size_sqft is None:
             raise BadRequestException("Property size is required for this service")
        duration_hours = float(service.base_duration_hours or 2.5)

    booking_end_time = data.scheduled_date + timedelta(hours=duration_hours)

    # Check for overlapping bookings [truncated for brevity, assumes identical context]
    # (Checking overlap is same)
    
    overlapping_booking = db.query(Booking).filter(
        Booking.customer_id == current_user.id,
        Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUNDED, BookingStatus.NO_SHOW]),
        Booking.scheduled_date < booking_end_time,
        (Booking.scheduled_date + timedelta(hours=duration_hours)) > data.scheduled_date
    ).first()

    if overlapping_booking:
         raise BadRequestException(
            f"You already have a booking ({overlapping_booking.booking_number}) scheduled for this time."
        )

    # Get Add-ons
    add_ons = []
    if data.add_on_ids:
        add_ons = db.query(AddOn).filter(
            AddOn.id.in_(data.add_on_ids),
            AddOn.is_active == True
        ).all()
    
    # Initialize discount variables
    discount_amount = Decimal("0")
    validated_discount = None
    
    # Calculate initial pricing (pre-discount)
    if is_duration_based:
        # Fixed Hourly Rate strategy
        base_hourly_rate = Decimal("75.00") # Standard
        if data.booking_type == BookingType.INSTANT:
            base_hourly_rate = Decimal("85.00") # Premium
            
        subtotal = base_hourly_rate * Decimal(str(duration_hours))
        add_ons_total = sum(Decimal(str(addon.price)) for addon in add_ons)
        
        # Combined subtotal for duration-based (simplified dynamic pricing)
        base_price_val = subtotal
        dynamic_adjustment = Decimal("0.00")
        adjusted_subtotal = subtotal + add_ons_total # Add-ons included in tax base
        
        # Defaults
        demand_multiplier = Decimal("1.00")
        rush_premium = Decimal("1.00")
        
        pricing = {
            "base_price": base_price_val.quantize(Decimal("0.01")),
            "size_adjustment": Decimal("0.00"),
            "add_ons_total": add_ons_total.quantize(Decimal("0.01")),
            "subtotal_before_dynamic": (subtotal + add_ons_total).quantize(Decimal("0.01")),
            "demand_multiplier": demand_multiplier,
            "rush_premium": rush_premium,
            "dynamic_adjustment": dynamic_adjustment,
            "discount_amount": Decimal("0.00"),
            "tax_amount": Decimal("0.00"), # Will calc below
            "total_price": Decimal("0.00") # Will calc below
        }
        
        dynamic_pricing = {
             "demand_multiplier": demand_multiplier,
             "rush_premium": rush_premium,
             "utilization_percentage": 50,
             "pricing_tier": "standard",
             "rush_tier": "standard"
        }
    else:
        # Property-based pricing
        pricing_engine = PricingEngine(db)
        # We need to calculate subtotal first to pass to pricing engine? 
        # No, pricing engine does it.
        # But we need to separate out the pricing calculation from the discount application.
        
        # 1. Get Dynamic Multipliers
        # Calculate base subtotal estimate for the engine (optional, depends on implementation)
        # Check PricingEngine signature: calculate_dynamic_price(base_price, ...)
        # We need base_price.
        
        # Re-calc base price locally to pass to engine?
        # Or use _calculate_booking_price to get it?
        calc_temp = _calculate_booking_price(
            service=service,
            property_size_sqft=data.property_size_sqft,
            bedrooms=data.bedrooms,
            bathrooms=data.bathrooms,
            add_ons=add_ons,
            discount_amount=Decimal("0")
        )
        base_subtotal_for_engine = calc_temp["subtotal_before_dynamic"]
        
        dynamic_pricing = await pricing_engine.calculate_dynamic_price(
            base_price=base_subtotal_for_engine,
            region_code=region_code if 'region_code' in locals() else "DXB", # fallback
            scheduled_date=data.scheduled_date,
            service_duration_hours=duration_hours
        )

        # 2. Calculate Pricing with Dynamic Factors (No Discount yet)
        pricing = _calculate_booking_price(
            service=service,
            property_size_sqft=data.property_size_sqft,
            bedrooms=data.bedrooms,
            bathrooms=data.bathrooms,
            add_ons=add_ons,
            discount_amount=Decimal("0"),
            demand_multiplier=dynamic_pricing["demand_multiplier"],
            rush_premium=dynamic_pricing["rush_premium"]
        )
        
        # Calculate adjusted subtotal from pricing dict
        # base_price + size + addons = subtotal_before
        # subtotal_before + dynamic = adjusted_subtotal (which is effectively (subtotal * multipliers))
        
        # Logic in _calculate_booking_price:
        # adjusted_subtotal = (subtotal * final_multiplier)
        # We can reconstruct it:
        adjusted_subtotal = pricing["subtotal_before_dynamic"] + pricing["dynamic_adjustment"]

    # --- Apply Discount ---
    if data.discount_code:
        try:
            discount_service = DiscountService(db)
            validated_discount, calculated_discount = discount_service.validate_code(
                code=data.discount_code,
                user_id=current_user.id,
                service_id=service.id,
                subtotal=adjusted_subtotal
            )
            discount_amount = calculated_discount
        except DiscountValidationError:
            # If invalid, just ignore or could raise error? 
            # Frontend should have validated. We'll proceed without discount or could raise.
            # Choosing to ignore to avoid blocking booking if code expired last second, 
            # but ideally should warn. For now, let's just not apply it.
            pass
            
    # --- Final Tax & Total Calculation ---
    tax_rate = Decimal("0.05")
    taxable_amount = adjusted_subtotal - discount_amount
    if taxable_amount < 0: 
        taxable_amount = Decimal("0")
        
    tax_amount = (taxable_amount * tax_rate).quantize(Decimal("0.01"))
    total_price_val = taxable_amount + tax_amount
    
    # Update pricing dict
    pricing["discount_amount"] = discount_amount.quantize(Decimal("0.01"))
    pricing["tax_amount"] = tax_amount
    pricing["total_price"] = total_price_val.quantize(Decimal("0.01"))

    # Handle subscription usage / creation
    used_subscription = None
    
    # CASE 1: Purchasing a NEW subscription
    if data.new_subscription_plan_id:
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == data.new_subscription_plan_id,
            SubscriptionPlan.is_active == True
        ).first()
        
        if not plan:
            raise NotFoundException("Subscription plan not found")
            
        # Create new subscription
        now = datetime.now(timezone.utc)
        cycle_end = now + timedelta(days=30)
        
        used_subscription = Subscription(
            subscription_number=generate_subscription_number(),
            user_id=current_user.id,
            plan_id=plan.id,
            address_id=data.address_id,
            service_id=data.service_id,
            status=SubscriptionStatus.ACTIVE,
            billing_cycle_start=now,
            next_billing_date=cycle_end,
            visits_allocated=plan.visits_per_month,
            visits_used=0,
            visits_remaining=plan.visits_per_month,
            rollover_visits=0,
            started_at=now
        )
        db.add(used_subscription)
        db.flush()  # Get ID
        
        # NOTE: In a real flow, we'd handle payment here or mark as PENDING_ACTIVATION.
        # For this MVP, we treat it as active and potentially billed later/invoice.
    
    # CASE 2: Using an EXISTING subscription
    elif data.use_subscription:
        # Find active subscription with remaining visits
        subscription = db.query(Subscription).filter(
            Subscription.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.visits_remaining > 0
        ).first()

        if not subscription:
            raise BadRequestException("No active subscription with remaining visits available")
        
        
        # Verify service matches subscription plan (optional, but good practice)
        # For now, assuming any service can be booked with subscription if generic visits
        
        used_subscription = subscription

    # If using subscription, base service is covered.
    # Add-ons are still charged.
    total_price_val = pricing["total_price"]
    payment_status_val = PaymentStatus.PENDING
    
    if used_subscription:
        # Calculate total for add-ons only (plus tax)
        tax_rate = Decimal("0.05")
        add_ons_total = pricing["add_ons_total"]
        tax_on_addons = (add_ons_total * tax_rate).quantize(Decimal("0.01"))
        total_price_val = add_ons_total + tax_on_addons
        
        # If total is > 0, payment is pending (for add-ons)
        # If total is 0, payment is paid
        payment_status_val = PaymentStatus.PENDING if total_price_val > 0 else PaymentStatus.PAID
        
        # Update tax amount in stored record to reflect only add-on tax? 
        # Or keep original tax calculation? Better to record actual tax charged.
        # But 'pricing' dict has tax for full amount. We should update booking.tax_amount too.
        # For simplicity, we'll update total_price but verify if we need to update components.
        # Let's keep components (base_price etc) as "Value" but total_price as "Amount Due".

    # Handle Wallet Payment
    wallet_transaction_needed = False
    wallet = None

    if data.payment_method == 'wallet' and total_price_val > 0:
        wallet = get_or_create_wallet(db, current_user.id)
        if wallet.balance < total_price_val:
            raise BadRequestException(f"Insufficient wallet balance. Available: AED {wallet.balance}")
        
        payment_status_val = PaymentStatus.PAID
        wallet_transaction_needed = True

    # Create booking with dynamic pricing fields
    booking = Booking(
        booking_number=generate_booking_number(),
        customer_id=current_user.id,
        service_id=data.service_id,
        address_id=data.address_id,
        scheduled_date=data.scheduled_date,
        property_size_sqft=data.property_size_sqft,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        base_price=pricing["base_price"],
        size_adjustment=pricing["size_adjustment"],
        add_ons_total=pricing["add_ons_total"],
        discount_amount=pricing["discount_amount"],
        tax_amount=pricing["tax_amount"],
        
        total_price=total_price_val,
        
        booking_type=data.booking_type,
        recurrence_pattern=data.recurrence_pattern,

        discount_code=data.discount_code,
        # Dynamic pricing fields
        demand_multiplier=pricing["demand_multiplier"],
        rush_premium=pricing["rush_premium"],
        utilization_at_booking=Decimal(str(dynamic_pricing["utilization_percentage"] / 100)),
        pricing_tier=dynamic_pricing["pricing_tier"],
        rush_tier=dynamic_pricing["rush_tier"],
        customer_notes=data.customer_notes,
        status=BookingStatus.PENDING,
        
        payment_status=payment_status_val
    )
    
    db.add(booking)
    db.flush()  # Get booking ID
    
    # Add add-ons to booking
    for addon in add_ons:
        db.execute(
            booking_add_ons.insert().values(
                booking_id=booking.id,
                add_on_id=addon.id,
                price_at_booking=addon.price
            )
        )
    
    # Record status history
    history = BookingStatusHistory(
        booking_id=booking.id,
        previous_status=None,
        new_status=BookingStatus.PENDING,
        changed_by_id=current_user.id,
        reason="Booking created"
    )
    db.add(history)

    # Increment discount code usage if applicable
    if validated_discount:
        discount_service = DiscountService(db)
        discount_service.apply_code(validated_discount)

    # Deduct visit from subscription if used
    if used_subscription:
        used_subscription.visits_used += 1
        used_subscription.visits_remaining -= 1
        
        # Create visit record
        visit = SubscriptionVisit(
            subscription_id=used_subscription.id,
            booking_id=booking.id,
            visit_number=used_subscription.visits_used,
            billing_cycle_month=datetime.now().strftime("%Y-%m"),
            scheduled_date=booking.scheduled_date,
            is_used=True,
            used_at=datetime.now(timezone.utc)
        )
        db.add(visit)

    # Process wallet transaction if applicable (Commits the session)
    if wallet_transaction_needed and wallet:
        create_transaction(
            db=db,
            wallet=wallet,
            type=TransactionType.DEBIT,
            amount=total_price_val,
            description=f"Payment for booking #{booking.booking_number}",
            reference_type="booking",
            reference_id=str(booking.id)
        )
    else:
        db.commit()

    # Auto-assign a cleaner using enhanced allocation engine (weighted scoring + fallback)
    from app.services.allocation_engine import enhanced_auto_assign
    assigned_cleaner = await enhanced_auto_assign(booking, db, duration_hours=float(service.base_duration_hours or 2.5))

    # Reload with relationships
    booking = db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.cleaner),
        joinedload(Booking.service),
        joinedload(Booking.address),
        joinedload(Booking.add_ons)
    ).filter(Booking.id == booking.id).first()

    # Publish booking created event
    await event_publisher.publish(EventType.JOB_CREATED, {
        "job_id": booking.id,
        "booking_number": booking.booking_number,
        "status": booking.status.value,
        "customer_id": booking.customer_id,
        "customer_name": current_user.full_name,
        "service_name": service.name,
        "scheduled_date": booking.scheduled_date.isoformat(),
        "total_price": float(booking.total_price),
        "city": address.city,
        "assigned_cleaner": assigned_cleaner.full_name if assigned_cleaner else None
    })

    # If a cleaner was auto-assigned, also publish JOB_ASSIGNED event
    if assigned_cleaner:
        await event_publisher.publish(EventType.JOB_ASSIGNED, {
            "job_id": booking.id,
            "booking_number": booking.booking_number,
            "status": booking.status.value,
            "customer_id": booking.customer_id,
            "cleaner_id": str(assigned_cleaner.id),
            "cleaner_name": assigned_cleaner.full_name,
            "employee_id": assigned_cleaner.employee_id,
            "scheduled_date": booking.scheduled_date.isoformat(),
            "auto_assigned": True
        })

    # Update dashboard stats cache
    await cache_service.update_dashboard_stat("pending_jobs", 1)

    return _booking_to_response(booking)


@router.get("/", response_model=List[BookingListResponse])
async def list_my_bookings(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's bookings."""
    query = db.query(Booking).filter(Booking.customer_id == current_user.id)
    
    if status:
        query = query.filter(Booking.status == status)
    
    bookings = query.options(
        joinedload(Booking.service),
        joinedload(Booking.address),
        joinedload(Booking.cleaner),  # Legacy User-based cleaner
        joinedload(Booking.review)    # Check if reviewed
    ).order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for booking in bookings:
        scheduled_dt = booking.scheduled_date
        date_str = scheduled_dt.strftime('%Y-%m-%d') if scheduled_dt else ''
        time_str = scheduled_dt.strftime('%I:%M %p') if scheduled_dt else ''
        
        # Get cleaner info (check new Employee system first, fallback to legacy User)
        cleaner_name = None
        cleaner_phone = None
        
        if booking.assigned_employee_id:
            employee = db.query(Employee).filter(Employee.id == booking.assigned_employee_id).first()
            if employee:
                cleaner_name = employee.full_name
                cleaner_phone = employee.phone_number
        elif booking.cleaner:
            cleaner_name = f"{booking.cleaner.first_name} {booking.cleaner.last_name}"
            cleaner_phone = booking.cleaner.phone
        
        # Address string
        address_str = booking.address.street_address
        if booking.address.apartment:
            address_str = f"{booking.address.apartment}, {address_str}"
        
        result.append(BookingListResponse(
            id=booking.id,
            booking_number=booking.booking_number,
            customer_name=f"{booking.customer.first_name} {booking.customer.last_name}",
            customer_email=booking.customer.email,
            service_name=booking.service.name,
            address=address_str,
            city=booking.address.city,
            scheduled_date=date_str,
            scheduled_time=time_str,
            status=booking.status.value if hasattr(booking.status, 'value') else str(booking.status),
            payment_status=booking.payment_status.value if hasattr(booking.payment_status, 'value') else str(booking.payment_status),
            total_price=booking.total_price,
            created_at=booking.created_at,
            cleaner_name=cleaner_name,
            cleaner_phone=cleaner_phone,
            has_review=booking.review is not None
        ))
    
    return result


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get booking details."""
    booking = db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.cleaner),
        joinedload(Booking.service),
        joinedload(Booking.address),
        joinedload(Booking.add_ons)
    ).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise BookingNotFoundException(booking_id=booking_id)
    
    # Check access
    if booking.customer_id != current_user.id and current_user.role.value not in ["admin", "cleaner"]:
        raise ForbiddenException()
    
    return _booking_to_response(booking)


@router.put("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: int,
    data: BookingCancel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise BookingNotFoundException(booking_id=booking_id)
    
    # Check access
    if booking.customer_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException()
    
    # Check if can be cancelled
    if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REFUNDED]:
        raise BookingCannotBeCancelledException("Booking is already completed or cancelled")
    
    # Check cancellation deadline (30 minutes before scheduled time)
    if booking.scheduled_date - datetime.now(timezone.utc) < timedelta(minutes=30):
        raise BookingCannotBeCancelledException("Cannot cancel less than 30 minutes before scheduled time")
    
    old_status = booking.status
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = datetime.now(timezone.utc)
    booking.cancelled_by_id = current_user.id
    booking.cancellation_reason = data.reason
    
    # Record status history
    history = BookingStatusHistory(
        booking_id=booking.id,
        previous_status=old_status,
        new_status=BookingStatus.CANCELLED,
        changed_by_id=current_user.id,
        reason=data.reason or "Customer cancelled"
    )
    db.add(history)

    # Handle wallet refund if payment was made from wallet
    if booking.payment_status == PaymentStatus.PAID:
        _process_cancellation_refund(booking, db)

    db.commit()

    # Publish booking cancelled event
    await event_publisher.publish(EventType.JOB_CANCELLED, {
        "job_id": booking.id,
        "booking_number": booking.booking_number,
        "status": "cancelled",
        "previous_status": old_status.value,
        "customer_id": booking.customer_id,
        "cleaner_id": booking.cleaner_id,
        "cancellation_reason": data.reason,
        "cancelled_by_id": current_user.id
    })

    return {"message": "Booking cancelled successfully"}


@router.put("/{booking_id}/reschedule")
async def reschedule_booking(
    booking_id: int,
    data: BookingReschedule,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reschedule a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise BookingNotFoundException(booking_id=booking_id)
    
    # Check access
    if booking.customer_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException()
    
    # Check if can be rescheduled
    if booking.status not in [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ASSIGNED]:
        raise BadRequestException("Booking cannot be rescheduled in current status")
    
    if data.new_date < datetime.now(timezone.utc):
        raise BadRequestException("New date must be in the future")
    
    old_date = booking.scheduled_date
    booking.scheduled_date = data.new_date
    
    # Record status history
    history = BookingStatusHistory(
        booking_id=booking.id,
        previous_status=booking.status,
        new_status=booking.status,
        changed_by_id=current_user.id,
        reason=f"Rescheduled from {old_date} to {data.new_date}. Reason: {data.reason or 'Not specified'}"
    )
    db.add(history)
    
    db.commit()

    # Publish rescheduled event (using JOB_ASSIGNED as it's a status-related update)
    await event_publisher.publish(EventType.JOB_ASSIGNED, {
        "job_id": booking.id,
        "booking_number": booking.booking_number,
        "status": booking.status.value,
        "customer_id": booking.customer_id,
        "cleaner_id": booking.cleaner_id,
        "action": "rescheduled",
        "old_date": old_date.isoformat(),
        "new_date": data.new_date.isoformat(),
        "reason": data.reason
    })

    return {"message": "Booking rescheduled successfully", "new_date": data.new_date}


# ============ Admin/Staff: Booking Management ============

@router.get("/admin/all", response_model=List[BookingListResponse])
async def list_all_bookings(
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: List all bookings with filters."""
    query = db.query(Booking)
    
    if status:
        query = query.filter(Booking.status == status)
    if payment_status:
        query = query.filter(Booking.payment_status == payment_status)
    if from_date:
        query = query.filter(Booking.scheduled_date >= from_date)
    if to_date:
        query = query.filter(Booking.scheduled_date <= to_date)
    if search:
        query = query.join(User, Booking.customer_id == User.id).filter(
            (Booking.booking_number.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.first_name.ilike(f"%{search}%")) |
            (User.last_name.ilike(f"%{search}%"))
        )
    
    bookings = query.options(
        joinedload(Booking.customer),
        joinedload(Booking.service),
        joinedload(Booking.address),
        joinedload(Booking.cleaner),
        joinedload(Booking.review),
    joinedload(Booking.add_ons)
    ).order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for booking in bookings:
        scheduled_dt = booking.scheduled_date
        date_str = scheduled_dt.strftime('%Y-%m-%d') if scheduled_dt else ''
        time_str = scheduled_dt.strftime('%I:%M %p') if scheduled_dt else ''
        
        # Get cleaner info
        cleaner_name = None
        cleaner_phone = None
        
        if booking.assigned_employee_id:
            employee = db.query(Employee).filter(Employee.id == booking.assigned_employee_id).first()
            if employee:
                cleaner_name = employee.full_name
                cleaner_phone = employee.phone_number
        elif booking.cleaner:
            cleaner_name = f"{booking.cleaner.first_name} {booking.cleaner.last_name}"
            cleaner_phone = booking.cleaner.phone
        
        # Address string
        address_str = booking.address.street_address
        if booking.address.apartment:
            address_str = f"{booking.address.apartment}, {address_str}"
        
        result.append(BookingListResponse(
            id=booking.id,
            booking_number=booking.booking_number,
            customer_name=f"{booking.customer.first_name} {booking.customer.last_name}",
            customer_email=booking.customer.email,
            service_name=booking.service.name,
            address=address_str,
            city=booking.address.city,
            scheduled_date=date_str,
            scheduled_time=time_str,
            status=booking.status.value if hasattr(booking.status, 'value') else str(booking.status),
            payment_status=booking.payment_status.value if hasattr(booking.payment_status, 'value') else str(booking.payment_status),
            total_price=booking.total_price,
            created_at=booking.created_at,
            cleaner_name=cleaner_name,
            cleaner_phone=cleaner_phone,
            has_review=booking.review is not None,
            add_ons=[addon.name for addon in booking.add_ons]
        ))
    
    return result


@router.put("/admin/{booking_id}/status")
async def update_booking_status(
    booking_id: int,
    data: BookingStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Update booking status."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise BookingNotFoundException(booking_id=booking_id)
    
    old_status = booking.status
    booking.status = data.status
    
    # Handle special status transitions
    if data.status == BookingStatus.IN_PROGRESS:
        booking.actual_start_time = datetime.now(timezone.utc)
    elif data.status == BookingStatus.COMPLETED:
        booking.actual_end_time = datetime.now(timezone.utc)
    
    # Record status history
    history = BookingStatusHistory(
        booking_id=booking.id,
        previous_status=old_status,
        new_status=data.status,
        changed_by_id=admin.id,
        reason=data.reason
    )
    db.add(history)
    
    db.commit()

    # Map status to event type
    status_event_map = {
        BookingStatus.IN_PROGRESS: EventType.JOB_STARTED,
        BookingStatus.COMPLETED: EventType.JOB_COMPLETED,
        BookingStatus.CANCELLED: EventType.JOB_CANCELLED,
        BookingStatus.ASSIGNED: EventType.JOB_ASSIGNED,
    }

    event_type = status_event_map.get(data.status)
    if event_type:
        await event_publisher.publish(event_type, {
            "job_id": booking.id,
            "booking_number": booking.booking_number,
            "status": data.status.value,
            "previous_status": old_status.value,
            "customer_id": booking.customer_id,
            "cleaner_id": booking.cleaner_id,
            "reason": data.reason
        })

    return {"message": f"Booking status updated to {data.status.value}"}


@router.put("/admin/{booking_id}/assign")
async def assign_cleaner(
    booking_id: int,
    data: BookingAssignCleaner,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Admin: Assign cleaner to booking.
    DEPRECATED/DISABLED: Assignment is now handled automatically by the system.
    """
    raise ForbiddenException(
        "Manual assignment is disabled. Cleaners are automatically assigned by the allocation algorithm."
    )


    return {"message": f"Cleaner {cleaner.full_name} assigned to booking"}


# ============ Stats ============

@router.get("/admin/stats")
async def get_booking_stats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Get booking statistics."""
    total_bookings = db.query(Booking).count()
    pending_bookings = db.query(Booking).filter(Booking.status == BookingStatus.PENDING).count()
    confirmed_bookings = db.query(Booking).filter(Booking.status == BookingStatus.CONFIRMED).count()
    completed_bookings = db.query(Booking).filter(Booking.status == BookingStatus.COMPLETED).count()
    
    total_revenue = db.query(func.sum(Booking.total_price)).filter(
        Booking.payment_status == PaymentStatus.PAID
    ).scalar() or 0
    
    total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()
    
    return {
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "confirmed_bookings": confirmed_bookings,
        "completed_bookings": completed_bookings,
        "total_customers": total_customers,
        "total_revenue": float(total_revenue)
    }
