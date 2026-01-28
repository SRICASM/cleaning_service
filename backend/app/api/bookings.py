from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.api.deps import get_current_user, get_admin_user, get_staff_user
from app.core.security import generate_booking_number
from app.core.exceptions import (
    NotFoundException, ForbiddenException, BadRequestException,
    BookingNotFoundException, BookingCannotBeCancelledException
)
from app.models import (
    Booking, BookingStatus, BookingStatusHistory, PaymentStatus,
    Service, AddOn, Address, User, Payment, booking_add_ons,
    UserRole, UserStatus
)
from app.schemas import (
    BookingCreate, BookingUpdate, BookingStatusUpdate,
    BookingAssignCleaner, BookingReschedule, BookingCancel,
    BookingResponse, BookingListResponse,
    AvailabilityRequest, AvailabilityResponse, AvailableSlot
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _calculate_booking_price(
    service: Service,
    property_size_sqft: int,
    bedrooms: int,
    bathrooms: int,
    add_ons: List[AddOn],
    discount_amount: Decimal = Decimal("0")
) -> dict:
    """Calculate booking price breakdown."""
    base_price = Decimal(str(service.base_price))
    size_adjustment = Decimal(str(service.price_per_sqft)) * property_size_sqft
    bedroom_adjustment = Decimal(str(service.price_per_bedroom)) * bedrooms
    bathroom_adjustment = Decimal(str(service.price_per_bathroom)) * bathrooms
    
    add_ons_total = sum(Decimal(str(addon.price)) for addon in add_ons)
    
    subtotal = base_price + size_adjustment + bedroom_adjustment + bathroom_adjustment + add_ons_total
    
    tax_rate = Decimal("0.085")
    tax_amount = (subtotal - discount_amount) * tax_rate
    
    total = subtotal - discount_amount + tax_amount
    
    return {
        "base_price": base_price.quantize(Decimal("0.01")),
        "size_adjustment": (size_adjustment + bedroom_adjustment + bathroom_adjustment).quantize(Decimal("0.01")),
        "add_ons_total": add_ons_total.quantize(Decimal("0.01")),
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
        status=booking.status,
        payment_status=booking.payment_status,
        customer_notes=booking.customer_notes,
        internal_notes=booking.internal_notes,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
        cancelled_at=booking.cancelled_at,
        cancellation_reason=booking.cancellation_reason
    )


# ============ Customer: Booking Operations ============

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
    
    # Validate address belongs to user
    address = db.query(Address).filter(
        Address.id == data.address_id,
        Address.user_id == current_user.id
    ).first()
    if not address:
        raise NotFoundException("Address not found")
    
    # Validate scheduled date is in future
    if data.scheduled_date < datetime.now(timezone.utc):
        raise BadRequestException("Scheduled date must be in the future")
    
    # Get add-ons
    add_ons = []
    if data.add_on_ids:
        add_ons = db.query(AddOn).filter(
            AddOn.id.in_(data.add_on_ids),
            AddOn.is_active == True
        ).all()
    
    # Calculate pricing
    pricing = _calculate_booking_price(
        service=service,
        property_size_sqft=data.property_size_sqft,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        add_ons=add_ons,
        discount_amount=Decimal("0")  # TODO: Handle discount codes
    )
    
    # Create booking
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
        total_price=pricing["total_price"],
        discount_code=data.discount_code,
        customer_notes=data.customer_notes,
        status=BookingStatus.PENDING,
        payment_status=PaymentStatus.PENDING
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
    
    db.commit()
    
    # Reload with relationships
    booking = db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.cleaner),
        joinedload(Booking.service),
        joinedload(Booking.address),
        joinedload(Booking.add_ons)
    ).filter(Booking.id == booking.id).first()
    
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
        joinedload(Booking.address)
    ).order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for booking in bookings:
        scheduled_dt = booking.scheduled_date
        date_str = scheduled_dt.strftime('%Y-%m-%d') if scheduled_dt else ''
        time_str = scheduled_dt.strftime('%I:%M %p') if scheduled_dt else ''
        
        result.append(BookingListResponse(
            id=booking.id,
            booking_number=booking.booking_number,
            customer_name=f"{booking.customer.first_name} {booking.customer.last_name}",
            customer_email=booking.customer.email,
            service_name=booking.service.name,
            city=booking.address.city,
            scheduled_date=date_str,
            scheduled_time=time_str,
            status=booking.status.value if hasattr(booking.status, 'value') else str(booking.status),
            payment_status=booking.payment_status.value if hasattr(booking.payment_status, 'value') else str(booking.payment_status),
            total_price=booking.total_price,
            created_at=booking.created_at
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
    
    db.commit()
    
    # TODO: Handle refund if payment was made
    # TODO: Send cancellation notification
    
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
        joinedload(Booking.address)
    ).order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for booking in bookings:
        scheduled_dt = booking.scheduled_date
        date_str = scheduled_dt.strftime('%Y-%m-%d') if scheduled_dt else ''
        time_str = scheduled_dt.strftime('%I:%M %p') if scheduled_dt else ''
        
        result.append(BookingListResponse(
            id=booking.id,
            booking_number=booking.booking_number,
            customer_name=f"{booking.customer.first_name} {booking.customer.last_name}",
            customer_email=booking.customer.email,
            service_name=booking.service.name,
            city=booking.address.city,
            scheduled_date=date_str,
            scheduled_time=time_str,
            status=booking.status.value if hasattr(booking.status, 'value') else str(booking.status),
            payment_status=booking.payment_status.value if hasattr(booking.payment_status, 'value') else str(booking.payment_status),
            total_price=booking.total_price,
            created_at=booking.created_at
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
    
    return {"message": f"Booking status updated to {data.status.value}"}


@router.put("/admin/{booking_id}/assign")
async def assign_cleaner(
    booking_id: int,
    data: BookingAssignCleaner,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Assign cleaner to booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise BookingNotFoundException(booking_id=booking_id)
    
    # Validate cleaner
    cleaner = db.query(User).filter(
        User.id == data.cleaner_id,
        User.role.in_([UserRole.CLEANER, UserRole.ADMIN]),
        User.status == UserStatus.ACTIVE
    ).first()
    
    if not cleaner:
        raise NotFoundException("Cleaner not found or not active")
    
    booking.cleaner_id = data.cleaner_id
    
    if booking.status == BookingStatus.CONFIRMED:
        booking.status = BookingStatus.ASSIGNED
    
    db.commit()
    
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
