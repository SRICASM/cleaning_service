"""
Subscription Schemas for API validation and responses.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from enum import Enum


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    PAYMENT_FAILED = "payment_failed"
    PENDING_ACTIVATION = "pending_activation"


class BillingStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    RETRYING = "retrying"
    REFUNDED = "refunded"


# ============ Subscription Plan Schemas ============

class SubscriptionPlanBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    visits_per_month: int = Field(..., ge=1, le=31)
    price_per_visit: Optional[Decimal] = None
    monthly_price: Decimal = Field(..., ge=0)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    features: Optional[Dict[str, Any]] = None
    included_addon_ids: Optional[List[int]] = None
    min_commitment_months: int = Field(default=1, ge=1)
    max_rollover_visits: int = Field(default=4, ge=0)


class SubscriptionPlanCreate(SubscriptionPlanBase):
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    monthly_price: Optional[Decimal] = Field(None, ge=0)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    features: Optional[Dict[str, Any]] = None
    included_addon_ids: Optional[List[int]] = None
    max_rollover_visits: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = None


class SubscriptionPlanResponse(SubscriptionPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    is_featured: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


# ============ Subscription Schemas ============

class SubscriptionCreate(BaseModel):
    plan_id: int
    address_id: int
    service_id: int
    preferred_cleaner_id: Optional[str] = None  # UUID as string
    preferred_days: Optional[List[int]] = Field(None, description="Days of week: 0=Monday, 6=Sunday")
    preferred_time_slot: Optional[str] = Field(None, max_length=20)
    property_size_sqft: Optional[int] = Field(None, ge=100, le=50000)
    bedrooms: int = Field(default=2, ge=0)
    bathrooms: int = Field(default=1, ge=1)
    payment_method_id: Optional[str] = None  # Stripe payment method ID


class SubscriptionUpdate(BaseModel):
    address_id: Optional[int] = None
    preferred_cleaner_id: Optional[str] = None
    preferred_days: Optional[List[int]] = None
    preferred_time_slot: Optional[str] = Field(None, max_length=20)


class SubscriptionPause(BaseModel):
    reason: Optional[str] = None
    resume_at: Optional[datetime] = None  # Scheduled resume date


class SubscriptionResume(BaseModel):
    pass  # No fields needed, just triggers resume


class SubscriptionCancel(BaseModel):
    reason: Optional[str] = None
    feedback: Optional[str] = None  # For churn analysis


class SubscriptionPlanChangeRequest(BaseModel):
    new_plan_id: int
    effective_immediately: bool = False  # If true, change now; else, at next billing cycle


class SubscriptionPackagePurchase(BaseModel):
    name: str
    visits: int = Field(..., ge=1)
    price: Decimal = Field(..., ge=0)
    service_id: int
    address_id: int
    validity_months: int = Field(default=3, ge=1)



# ============ Response Schemas ============

class AddressInSubscription(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    street_address: str
    apartment: Optional[str]
    city: str
    postal_code: str


class ServiceInSubscription(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon: Optional[str]


class CleanerInSubscription(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str  # UUID
    employee_id: str
    full_name: str


class SubscriptionVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_number: int
    billing_cycle_month: str
    scheduled_date: Optional[datetime]
    is_rollover: bool
    is_used: bool
    is_cancelled: bool
    booking_id: Optional[int]
    created_at: datetime
    used_at: Optional[datetime]


class SubscriptionBillingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    billing_date: datetime
    billing_period_start: datetime
    billing_period_end: datetime
    amount: Decimal
    currency: str
    visits_allocated: int
    rollover_from_previous: int
    total_visits: int
    status: BillingStatus
    retry_count: int
    stripe_invoice_id: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_number: str
    user_id: int
    status: SubscriptionStatus

    # Plan info
    plan: SubscriptionPlanResponse

    # Location & service
    address: AddressInSubscription
    service: ServiceInSubscription
    preferred_cleaner: Optional[CleanerInSubscription] = None

    # Preferences
    preferred_days: Optional[List[int]]
    preferred_time_slot: Optional[str]

    # Property details
    property_size_sqft: Optional[int]
    bedrooms: int
    bathrooms: int

    # Visit tracking
    visits_allocated: int
    visits_used: int
    visits_remaining: int
    rollover_visits: int

    # Billing cycle
    billing_cycle_start: datetime
    next_billing_date: datetime

    # Status details
    pause_reason: Optional[str]
    paused_at: Optional[datetime]
    resume_at: Optional[datetime]
    cancellation_reason: Optional[str]
    cancelled_at: Optional[datetime]

    # Timestamps
    started_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SubscriptionSummary(BaseModel):
    """Lightweight subscription info for lists."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_number: str
    status: SubscriptionStatus
    plan_name: str
    visits_remaining: int
    next_billing_date: datetime
    monthly_price: Decimal


class SubscriptionListResponse(BaseModel):
    subscriptions: List[SubscriptionSummary]
    total: int


# ============ Calendar & Visit Scheduling ============

class VisitSlot(BaseModel):
    """A potential visit time slot."""
    date: datetime
    time_slot: str  # "09:00 AM"
    is_available: bool
    visit_number: int


class SubscriptionCalendarResponse(BaseModel):
    """Calendar view of subscription visits."""
    subscription_id: int
    billing_cycle_month: str
    visits_total: int
    visits_scheduled: int
    visits_completed: int
    visits_remaining: int
    upcoming_visits: List[VisitSlot]
    suggested_slots: List[VisitSlot]  # Recommended based on preferences


class ScheduleVisitRequest(BaseModel):
    """Request to schedule a specific visit."""
    visit_id: Optional[int] = None  # If scheduling existing visit slot
    scheduled_date: datetime
    notes: Optional[str] = None


# ============ Visit Management ============

class VisitRescheduleRequest(BaseModel):
    """Request to reschedule a subscription visit."""
    new_date: datetime
    new_time: Optional[str] = Field(None, description="Time in HH:MM format, e.g., '10:00'")
    reason: Optional[str] = None


class VisitCancelRequest(BaseModel):
    """Request to cancel a subscription visit."""
    reason: Optional[str] = None
    rollover: bool = Field(default=True, description="Whether to rollover this visit to next cycle")


class VisitRescheduleResponse(BaseModel):
    """Response after rescheduling a visit."""
    visit_id: int
    old_date: datetime
    new_date: datetime
    message: str


class VisitCancelResponse(BaseModel):
    """Response after cancelling a visit."""
    visit_id: int
    cancelled_date: datetime
    rolled_over: bool
    rollover_visits_total: int
    message: str


class UpcomingVisitResponse(BaseModel):
    """Detailed view of an upcoming visit for user management."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_number: int
    scheduled_date: Optional[datetime]
    scheduled_time: Optional[str]  # Formatted time string
    is_rollover: bool
    is_used: bool
    is_cancelled: bool
    can_reschedule: bool  # Based on time rules
    can_cancel: bool  # Based on time rules
    booking_id: Optional[int]
    booking_number: Optional[str]
    reschedule_count: int
    service_name: Optional[str]


class UserSubscriptionResponse(BaseModel):
    """Complete subscription info for user dashboard."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_number: str
    status: SubscriptionStatus

    # Plan info
    plan_name: str
    plan_id: int
    visits_per_month: int

    # Visit tracking
    visits_allocated: int
    visits_used: int
    visits_remaining: int
    rollover_visits: int
    max_rollover_visits: int

    # Billing
    next_billing_date: datetime
    monthly_price: Decimal

    # Service & Address
    service_name: str
    address_summary: str

    # Upcoming visits
    upcoming_visits: List[UpcomingVisitResponse]

    # Timestamps
    started_at: Optional[datetime]
    created_at: datetime


# ============ Analytics & Stats ============

class SubscriptionStats(BaseModel):
    """Stats for admin dashboard."""
    total_active: int
    total_paused: int
    total_cancelled_this_month: int
    new_this_month: int
    mrr: Decimal  # Monthly Recurring Revenue
    average_visits_per_subscription: float
    churn_rate: float  # Percentage
