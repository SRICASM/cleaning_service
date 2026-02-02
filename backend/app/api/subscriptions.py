"""
Subscription API Endpoints

Handles:
- Subscription plans (list, detail)
- User subscriptions (create, list, detail, update)
- Subscription actions (pause, resume, cancel)
- Visit management
- Admin operations
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.api.deps import get_current_user, get_admin_user
from app.models import User, Booking
from app.models.subscription import (
    SubscriptionPlan, Subscription, SubscriptionVisit,
    SubscriptionBilling, SubscriptionStatus
)
from app.schemas.subscription import (
    SubscriptionPlanCreate, SubscriptionPlanUpdate, SubscriptionPlanResponse,
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse,
    SubscriptionSummary, SubscriptionListResponse,
    SubscriptionPause, SubscriptionResume, SubscriptionCancel,
    SubscriptionPlanChangeRequest,
    SubscriptionVisitResponse, SubscriptionBillingResponse,
    SubscriptionCalendarResponse, ScheduleVisitRequest,
    SubscriptionStats, VisitSlot, SubscriptionPackagePurchase,
    # New schemas for visit management
    VisitRescheduleRequest, VisitCancelRequest,
    VisitRescheduleResponse, VisitCancelResponse,
    UpcomingVisitResponse, UserSubscriptionResponse
)
from app.services.subscription_service import SubscriptionService
from app.services.calendar_service import CalendarService

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


# ============ Helper Functions ============

def get_subscription_service(db: Session = Depends(get_db)) -> SubscriptionService:
    """Get subscription service instance."""
    return SubscriptionService(db)


def _subscription_to_response(subscription: Subscription) -> SubscriptionResponse:
    """Convert Subscription model to response schema."""
    return SubscriptionResponse(
        id=subscription.id,
        subscription_number=subscription.subscription_number,
        user_id=subscription.user_id,
        status=subscription.status,
        plan=SubscriptionPlanResponse.model_validate(subscription.plan),
        address={
            "id": subscription.address.id,
            "label": subscription.address.label,
            "street_address": subscription.address.street_address,
            "apartment": subscription.address.apartment,
            "city": subscription.address.city,
            "postal_code": subscription.address.postal_code
        },
        service={
            "id": subscription.service.id,
            "name": subscription.service.name,
            "icon": subscription.service.icon
        },
        preferred_cleaner={
            "id": str(subscription.preferred_cleaner.id),
            "employee_id": subscription.preferred_cleaner.employee_id,
            "full_name": subscription.preferred_cleaner.full_name
        } if subscription.preferred_cleaner else None,
        preferred_days=subscription.preferred_days,
        preferred_time_slot=subscription.preferred_time_slot,
        property_size_sqft=subscription.property_size_sqft,
        bedrooms=subscription.bedrooms,
        bathrooms=subscription.bathrooms,
        visits_allocated=subscription.visits_allocated,
        visits_used=subscription.visits_used,
        visits_remaining=subscription.visits_remaining,
        rollover_visits=subscription.rollover_visits,
        billing_cycle_start=subscription.billing_cycle_start,
        next_billing_date=subscription.next_billing_date,
        pause_reason=subscription.pause_reason,
        paused_at=subscription.paused_at,
        resume_at=subscription.resume_at,
        cancellation_reason=subscription.cancellation_reason,
        cancelled_at=subscription.cancelled_at,
        started_at=subscription.started_at,
        created_at=subscription.created_at,
        updated_at=subscription.updated_at
    )


def _subscription_to_summary(subscription: Subscription) -> SubscriptionSummary:
    """Convert Subscription model to summary schema."""
    return SubscriptionSummary(
        id=subscription.id,
        subscription_number=subscription.subscription_number,
        status=subscription.status,
        plan_name=subscription.plan.name,
        visits_remaining=subscription.visits_remaining,
        next_billing_date=subscription.next_billing_date,
        monthly_price=subscription.plan.monthly_price
    )


# ============ Plan Endpoints (Public) ============

@router.get("/plans", response_model=List[SubscriptionPlanResponse])
async def list_subscription_plans(
    db: Session = Depends(get_db)
):
    """
    List all active subscription plans.

    Public endpoint - no authentication required.
    """
    service = SubscriptionService(db)
    plans = service.get_active_plans()
    return [SubscriptionPlanResponse.model_validate(p) for p in plans]


@router.get("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def get_subscription_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific subscription plan."""
    service = SubscriptionService(db)
    plan = service.get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return SubscriptionPlanResponse.model_validate(plan)


# ============ User Subscription Endpoints ============

@router.get("/my", response_model=List[SubscriptionSummary])
async def list_my_subscriptions(
    include_cancelled: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List current user's subscriptions."""
    service = SubscriptionService(db)
    subscriptions = service.get_user_subscriptions(
        current_user.id,
        include_cancelled=include_cancelled
    )
    return [_subscription_to_summary(s) for s in subscriptions]


@router.get("/me", response_model=UserSubscriptionResponse)
async def get_my_active_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's active subscription with upcoming visits.

    Returns detailed subscription info including:
    - Plan details
    - Visit tracking (used, remaining, rollover)
    - Upcoming scheduled visits with reschedule/cancel options
    """
    # Get active subscription
    subscription = db.query(Subscription).options(
        joinedload(Subscription.plan),
        joinedload(Subscription.service),
        joinedload(Subscription.address),
        joinedload(Subscription.visits)
    ).filter(
        Subscription.user_id == current_user.id,
        Subscription.status == SubscriptionStatus.ACTIVE
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")

    # Get upcoming visits (not used, not cancelled)
    now = datetime.now(timezone.utc)
    upcoming_visits = []

    for visit in subscription.visits:
        if visit.is_used or visit.is_cancelled:
            continue

        # Determine if visit can be rescheduled/cancelled (24 hours rule)
        can_modify = True
        if visit.scheduled_date:
            time_until = visit.scheduled_date - now
            can_modify = time_until > timedelta(hours=24)

        # Get booking info if exists
        booking_number = None
        if visit.booking_id:
            booking = db.query(Booking).filter(Booking.id == visit.booking_id).first()
            if booking:
                booking_number = booking.booking_number

        upcoming_visits.append(UpcomingVisitResponse(
            id=visit.id,
            visit_number=visit.visit_number,
            scheduled_date=visit.scheduled_date,
            scheduled_time=visit.scheduled_date.strftime("%I:%M %p") if visit.scheduled_date else None,
            is_rollover=visit.is_rollover,
            is_used=visit.is_used,
            is_cancelled=visit.is_cancelled,
            can_reschedule=can_modify,
            can_cancel=can_modify,
            booking_id=visit.booking_id,
            booking_number=booking_number,
            reschedule_count=visit.reschedule_count or 0,
            service_name=subscription.service.name if subscription.service else None
        ))

    # Sort by scheduled date
    upcoming_visits.sort(key=lambda v: v.scheduled_date or datetime.max.replace(tzinfo=timezone.utc))

    # Build address summary
    addr = subscription.address
    address_summary = f"{addr.street_address}, {addr.city}" if addr else "No address"

    return UserSubscriptionResponse(
        id=subscription.id,
        subscription_number=subscription.subscription_number,
        status=subscription.status,
        plan_name=subscription.plan.name,
        plan_id=subscription.plan.id,
        visits_per_month=subscription.plan.visits_per_month,
        visits_allocated=subscription.visits_allocated,
        visits_used=subscription.visits_used,
        visits_remaining=subscription.visits_remaining,
        rollover_visits=subscription.rollover_visits,
        max_rollover_visits=subscription.plan.max_rollover_visits,
        next_billing_date=subscription.next_billing_date,
        monthly_price=subscription.plan.monthly_price,
        service_name=subscription.service.name if subscription.service else "Unknown",
        address_summary=address_summary,
        upcoming_visits=upcoming_visits,
        started_at=subscription.started_at,
        created_at=subscription.created_at
    )


@router.get("/me/visits", response_model=List[UpcomingVisitResponse])
async def get_my_upcoming_visits(
    include_past: bool = Query(False, description="Include past/used visits"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all visits for user's active subscription.

    By default returns only upcoming (unused, not cancelled) visits.
    Set include_past=true to include all visits.
    """
    subscription = db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.status == SubscriptionStatus.ACTIVE
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")

    query = db.query(SubscriptionVisit).filter(
        SubscriptionVisit.subscription_id == subscription.id
    )

    if not include_past:
        query = query.filter(
            SubscriptionVisit.is_used == False,
            SubscriptionVisit.is_cancelled == False
        )

    visits = query.order_by(SubscriptionVisit.scheduled_date.asc()).all()

    now = datetime.now(timezone.utc)
    result = []

    for visit in visits:
        can_modify = True
        if visit.scheduled_date:
            time_until = visit.scheduled_date - now
            can_modify = time_until > timedelta(hours=24) and not visit.is_used

        booking_number = None
        if visit.booking_id:
            booking = db.query(Booking).filter(Booking.id == visit.booking_id).first()
            if booking:
                booking_number = booking.booking_number

        result.append(UpcomingVisitResponse(
            id=visit.id,
            visit_number=visit.visit_number,
            scheduled_date=visit.scheduled_date,
            scheduled_time=visit.scheduled_date.strftime("%I:%M %p") if visit.scheduled_date else None,
            is_rollover=visit.is_rollover,
            is_used=visit.is_used,
            is_cancelled=visit.is_cancelled,
            can_reschedule=can_modify and not visit.is_cancelled,
            can_cancel=can_modify and not visit.is_cancelled,
            booking_id=visit.booking_id,
            booking_number=booking_number,
            reschedule_count=visit.reschedule_count or 0,
            service_name=subscription.service.name if subscription.service else None
        ))

    return result


@router.put("/me/visits/{visit_id}/reschedule", response_model=VisitRescheduleResponse)
async def reschedule_visit(
    visit_id: int,
    data: VisitRescheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reschedule a subscription visit to a new date/time.

    Rules:
    - Must reschedule at least 24 hours before current scheduled time
    - Visit must not be used or cancelled
    - New date must be in the future
    """
    # Get the visit
    visit = db.query(SubscriptionVisit).options(
        joinedload(SubscriptionVisit.subscription)
    ).filter(SubscriptionVisit.id == visit_id).first()

    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    # Verify ownership
    if visit.subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this visit")

    # Check visit status
    if visit.is_used:
        raise HTTPException(status_code=400, detail="Cannot reschedule a completed visit")

    if visit.is_cancelled:
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled visit")

    # Check 24-hour rule
    now = datetime.now(timezone.utc)
    if visit.scheduled_date:
        time_until = visit.scheduled_date - now
        if time_until < timedelta(hours=24):
            raise HTTPException(
                status_code=400,
                detail="Cannot reschedule less than 24 hours before appointment"
            )

    # Validate new date is in the future
    new_date = data.new_date
    if new_date.tzinfo is None:
        new_date = new_date.replace(tzinfo=timezone.utc)

    if new_date < now:
        raise HTTPException(status_code=400, detail="New date must be in the future")

    # Store old date
    old_date = visit.scheduled_date

    # Update visit
    if visit.original_scheduled_date is None:
        visit.original_scheduled_date = old_date

    visit.scheduled_date = new_date
    visit.rescheduled_at = now
    visit.reschedule_count = (visit.reschedule_count or 0) + 1

    # If there's an associated booking, update it too
    if visit.booking_id:
        booking = db.query(Booking).filter(Booking.id == visit.booking_id).first()
        if booking:
            booking.scheduled_date = new_date

    db.commit()

    return VisitRescheduleResponse(
        visit_id=visit.id,
        old_date=old_date,
        new_date=new_date,
        message=f"Visit rescheduled from {old_date.strftime('%b %d')} to {new_date.strftime('%b %d, %Y at %I:%M %p')}"
    )


@router.put("/me/visits/{visit_id}/cancel", response_model=VisitCancelResponse)
async def cancel_visit(
    visit_id: int,
    data: VisitCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a subscription visit.

    Rules:
    - Must cancel at least 24 hours before scheduled time
    - Visit must not be used or already cancelled
    - If rollover=true (default), the visit is added to rollover_visits
    """
    # Get the visit with subscription
    visit = db.query(SubscriptionVisit).options(
        joinedload(SubscriptionVisit.subscription).joinedload(Subscription.plan)
    ).filter(SubscriptionVisit.id == visit_id).first()

    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    # Verify ownership
    if visit.subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this visit")

    # Check visit status
    if visit.is_used:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed visit")

    if visit.is_cancelled:
        raise HTTPException(status_code=400, detail="Visit is already cancelled")

    # Check 24-hour rule
    now = datetime.now(timezone.utc)
    if visit.scheduled_date:
        time_until = visit.scheduled_date - now
        if time_until < timedelta(hours=24):
            raise HTTPException(
                status_code=400,
                detail="Cannot cancel less than 24 hours before appointment"
            )

    subscription = visit.subscription
    cancelled_date = visit.scheduled_date

    # Mark visit as cancelled
    visit.is_cancelled = True
    visit.cancelled_at = now
    visit.cancellation_reason = data.reason

    # Handle rollover
    rolled_over = False
    if data.rollover:
        max_rollover = subscription.plan.max_rollover_visits
        current_rollover = subscription.rollover_visits or 0

        if current_rollover < max_rollover:
            subscription.rollover_visits = current_rollover + 1
            visit.rolled_over = True
            rolled_over = True

    # Update subscription visit counts
    subscription.visits_remaining = max(0, (subscription.visits_remaining or 0) - 1)

    # If there's an associated booking, cancel it too
    if visit.booking_id:
        from app.models.booking import BookingStatus
        booking = db.query(Booking).filter(Booking.id == visit.booking_id).first()
        if booking:
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            booking.cancellation_reason = f"Subscription visit cancelled: {data.reason or 'User requested'}"

    db.commit()

    return VisitCancelResponse(
        visit_id=visit.id,
        cancelled_date=cancelled_date,
        rolled_over=rolled_over,
        rollover_visits_total=subscription.rollover_visits,
        message=f"Visit cancelled.{' Visit has been added to your rollover credits.' if rolled_over else ''}"
    )


@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    data: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new subscription.

    The subscription starts in PENDING_ACTIVATION status.
    Complete payment to activate.
    """
    service = SubscriptionService(db)

    # Check for existing active subscription at same address
    existing = service.get_active_subscription_for_address(
        current_user.id,
        data.address_id
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an active subscription for this address"
        )

    try:
        subscription = service.create_subscription(
            user_id=current_user.id,
            plan_id=data.plan_id,
            address_id=data.address_id,
            service_id=data.service_id,
            preferred_days=data.preferred_days,
            preferred_time_slot=data.preferred_time_slot,
            preferred_cleaner_id=data.preferred_cleaner_id,
            property_size_sqft=data.property_size_sqft,
            bedrooms=data.bedrooms,
            bathrooms=data.bathrooms,
            payment_method_id=data.payment_method_id
        )
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/purchase-package", response_model=SubscriptionResponse)
async def purchase_package(
    data: SubscriptionPackagePurchase,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Purchase a multi-visit package.
    
    Creates an active subscription with the specified number of visits.
    Bypasses standard plan selection and payment flow for now (assumes separate payment or pay later).
    """
    service = SubscriptionService(db)
    
    try:
        subscription = service.create_package_subscription(
            user_id=current_user.id,
            visits=data.visits,
            address_id=data.address_id,
            service_id=data.service_id,
            validity_months=data.validity_months
        )
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get subscription details."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # Users can only view their own subscriptions
    if subscription.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this subscription")

    return _subscription_to_response(subscription)


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: int,
    data: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update subscription preferences."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this subscription")

    # Update allowed fields
    if data.address_id is not None:
        subscription.address_id = data.address_id
    if data.preferred_cleaner_id is not None:
        import uuid
        subscription.preferred_cleaner_id = uuid.UUID(data.preferred_cleaner_id)
    if data.preferred_days is not None:
        subscription.preferred_days = data.preferred_days
    if data.preferred_time_slot is not None:
        subscription.preferred_time_slot = data.preferred_time_slot

    db.commit()
    db.refresh(subscription)
    return _subscription_to_response(subscription)


# ============ Subscription Actions ============

@router.post("/{subscription_id}/pause", response_model=SubscriptionResponse)
async def pause_subscription(
    subscription_id: int,
    data: SubscriptionPause,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pause a subscription."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        subscription = service.pause_subscription(
            subscription_id,
            reason=data.reason,
            resume_at=data.resume_at
        )
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{subscription_id}/resume", response_model=SubscriptionResponse)
async def resume_subscription(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resume a paused subscription."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        subscription = service.resume_subscription(subscription_id)
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{subscription_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(
    subscription_id: int,
    data: SubscriptionCancel,
    immediate: bool = Query(False, description="Cancel immediately vs at end of billing cycle"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a subscription."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        subscription = service.cancel_subscription(
            subscription_id,
            reason=data.reason,
            immediate=immediate
        )
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{subscription_id}/change-plan", response_model=SubscriptionResponse)
async def change_subscription_plan(
    subscription_id: int,
    data: SubscriptionPlanChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request a plan change."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        service.change_plan(
            subscription_id,
            data.new_plan_id,
            effective_immediately=data.effective_immediately
        )
        # Refresh subscription after plan change
        subscription = service.get_subscription(subscription_id)
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Visit Endpoints ============

@router.get("/{subscription_id}/visits", response_model=List[SubscriptionVisitResponse])
async def list_subscription_visits(
    subscription_id: int,
    billing_month: Optional[str] = Query(None, description="Filter by billing month (YYYY-MM)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List visits for a subscription."""
    service = SubscriptionService(db)
    subscription = service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    visits = service.get_subscription_visits(subscription_id, billing_month)
    return [SubscriptionVisitResponse.model_validate(v) for v in visits]


@router.post("/{subscription_id}/visits/schedule")
async def schedule_visit(
    subscription_id: int,
    data: ScheduleVisitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Schedule a visit from the subscription.

    This uses one of the allocated visits and creates a booking.
    """
    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not subscription.can_book_visit:
        raise HTTPException(status_code=400, detail="No visits remaining")

    try:
        calendar_service = CalendarService(db)
        visit, booking = calendar_service.schedule_visit_from_subscription(
            subscription,
            data.scheduled_date,
            notes=data.notes
        )
        return {
            "visit": SubscriptionVisitResponse.model_validate(visit),
            "booking_id": booking.id,
            "booking_number": booking.booking_number,
            "message": "Visit scheduled successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{subscription_id}/calendar")
async def get_subscription_calendar(
    subscription_id: int,
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get calendar view for subscription visits.

    Returns scheduled visits, available slots, and suggested times.
    """
    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    calendar_service = CalendarService(db)
    return calendar_service.get_subscription_calendar(subscription, month)


@router.get("/{subscription_id}/available-slots")
async def get_available_slots(
    subscription_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available time slots for a specific date."""
    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        from datetime import datetime
        date_obj = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    calendar_service = CalendarService(db)
    return calendar_service.get_available_slots(subscription, date_obj)


@router.post("/{subscription_id}/visits/{visit_id}/reschedule")
async def reschedule_visit(
    subscription_id: int,
    visit_id: int,
    data: ScheduleVisitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reschedule an existing subscription visit."""
    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        calendar_service = CalendarService(db)
        visit = calendar_service.reschedule_subscription_visit(
            visit_id,
            data.scheduled_date,
            reason=data.notes
        )
        return {
            "visit": SubscriptionVisitResponse.model_validate(visit),
            "message": "Visit rescheduled successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{subscription_id}/visits/{visit_id}")
async def cancel_visit(
    subscription_id: int,
    visit_id: int,
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a scheduled subscription visit and return the credit."""
    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        calendar_service = CalendarService(db)
        visit = calendar_service.cancel_subscription_visit(visit_id, reason)
        return {
            "visit": SubscriptionVisitResponse.model_validate(visit),
            "message": "Visit cancelled, credit returned to subscription"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{subscription_id}/billing", response_model=List[SubscriptionBillingResponse])
async def list_subscription_billing(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get billing history for a subscription."""
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    billing = db.query(SubscriptionBilling).filter(
        SubscriptionBilling.subscription_id == subscription_id
    ).order_by(SubscriptionBilling.billing_date.desc()).all()

    return [SubscriptionBillingResponse.model_validate(b) for b in billing]


# ============ Admin Endpoints ============

@router.get("/admin/stats", response_model=SubscriptionStats)
async def get_subscription_stats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get subscription statistics (admin only)."""
    service = SubscriptionService(db)
    stats = service.get_subscription_stats()
    return SubscriptionStats(**stats)


@router.get("/admin/all", response_model=SubscriptionListResponse)
async def list_all_subscriptions(
    status: Optional[SubscriptionStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """List all subscriptions (admin only)."""
    query = db.query(Subscription)

    if status:
        query = query.filter(Subscription.status == status)

    total = query.count()
    subscriptions = query.order_by(
        Subscription.created_at.desc()
    ).offset(skip).limit(limit).all()

    return SubscriptionListResponse(
        subscriptions=[_subscription_to_summary(s) for s in subscriptions],
        total=total
    )


@router.post("/{subscription_id}/activate", response_model=SubscriptionResponse)
async def activate_subscription(
    subscription_id: int,
    stripe_subscription_id: Optional[str] = None,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Manually activate a subscription (admin only)."""
    service = SubscriptionService(db)

    try:
        subscription = service.activate_subscription(
            subscription_id,
            stripe_subscription_id=stripe_subscription_id
        )
        return _subscription_to_response(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Plan Admin Endpoints ============

@router.post("/admin/plans", response_model=SubscriptionPlanResponse)
async def create_subscription_plan(
    data: SubscriptionPlanCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new subscription plan (admin only)."""
    # Check slug uniqueness
    existing = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.slug == data.slug
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plan slug already exists")

    plan = SubscriptionPlan(
        name=data.name,
        slug=data.slug,
        description=data.description,
        visits_per_month=data.visits_per_month,
        price_per_visit=data.price_per_visit,
        monthly_price=data.monthly_price,
        discount_percentage=data.discount_percentage,
        features=data.features,
        included_addon_ids=data.included_addon_ids,
        min_commitment_months=data.min_commitment_months,
        max_rollover_visits=data.max_rollover_visits,
        is_active=data.is_active,
        is_featured=data.is_featured,
        display_order=data.display_order
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return SubscriptionPlanResponse.model_validate(plan)


@router.patch("/admin/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_subscription_plan(
    plan_id: int,
    data: SubscriptionPlanUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update a subscription plan (admin only)."""
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return SubscriptionPlanResponse.model_validate(plan)


# ============ Stripe Payment Endpoints ============

@router.post("/setup-payment")
async def setup_payment_method(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a SetupIntent for collecting payment method.

    Returns client_secret for Stripe.js on the frontend.
    """
    from app.services.stripe_subscription_service import StripeSubscriptionService

    try:
        stripe_service = StripeSubscriptionService(db)
        result = stripe_service.get_setup_intent(current_user)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create setup intent: {str(e)}")


@router.post("/{subscription_id}/start-billing")
async def start_subscription_billing(
    subscription_id: int,
    payment_method_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start billing for a subscription by creating a Stripe subscription.

    Returns client_secret if payment confirmation is needed.
    """
    from app.services.stripe_subscription_service import StripeSubscriptionService

    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if subscription.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="Subscription already has billing set up")

    try:
        stripe_service = StripeSubscriptionService(db)
        stripe_sub = stripe_service.create_stripe_subscription(
            subscription,
            payment_method_id=payment_method_id
        )

        # Get payment intent if confirmation needed
        payment_info = stripe_service.get_subscription_payment_intent(subscription)

        return {
            "stripe_subscription_id": stripe_sub.id,
            "status": stripe_sub.status,
            "client_secret": payment_info.get("client_secret") if payment_info else None,
            "amount": payment_info.get("amount") if payment_info else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Stripe subscription: {str(e)}")


@router.get("/{subscription_id}/payment-status")
async def get_subscription_payment_status(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payment status for a subscription."""
    from app.services.stripe_subscription_service import StripeSubscriptionService

    sub_service = SubscriptionService(db)
    subscription = sub_service.get_subscription(subscription_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    if not subscription.stripe_subscription_id:
        return {
            "has_billing": False,
            "status": subscription.status.value,
            "message": "No Stripe billing set up"
        }

    try:
        stripe_service = StripeSubscriptionService(db)
        payment_info = stripe_service.get_subscription_payment_intent(subscription)

        return {
            "has_billing": True,
            "stripe_subscription_id": subscription.stripe_subscription_id,
            "status": subscription.status.value,
            "requires_payment": payment_info is not None,
            "client_secret": payment_info.get("client_secret") if payment_info else None,
            "amount": payment_info.get("amount") if payment_info else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment status: {str(e)}")
