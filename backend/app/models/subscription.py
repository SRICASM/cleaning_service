"""
Subscription Models

Implements the subscription system with:
- Subscription plans (8 visits, 12 visits, etc.)
- User subscriptions with preferences
- Visit tracking and rollover logic
- Billing history with retry support
"""
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Numeric, Text,
    ForeignKey, Enum as SQLEnum, ARRAY, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum
import uuid


class SubscriptionStatus(str, enum.Enum):
    """Subscription lifecycle status."""
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    PAYMENT_FAILED = "payment_failed"
    PENDING_ACTIVATION = "pending_activation"


class BillingStatus(str, enum.Enum):
    """Billing record status."""
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    RETRYING = "retrying"
    REFUNDED = "refunded"


class SubscriptionPlan(Base):
    """
    Available subscription plans.

    Example plans:
    - "8 Visits" - 8 cleanings per month
    - "12 Visits" - 12 cleanings per month (most popular)
    - "Custom" - Flexible visits
    """
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)

    # Plan identification
    name = Column(String(100), nullable=False)  # "8 Visits", "12 Visits"
    slug = Column(String(50), unique=True, nullable=False, index=True)  # "8-visits"
    description = Column(Text, nullable=True)

    # Visit allocation
    visits_per_month = Column(Integer, nullable=False)

    # Pricing
    price_per_visit = Column(Numeric(10, 2), nullable=True)  # For display
    monthly_price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), nullable=True)  # vs one-time booking

    # Features (JSON for flexibility)
    # e.g., {"priority_booking": true, "free_addons": ["inside_fridge"]}
    features = Column(JSON, nullable=True)

    # Included add-ons (IDs of add-ons included free)
    included_addon_ids = Column(ARRAY(Integer), nullable=True)

    # Restrictions
    min_commitment_months = Column(Integer, default=1)
    max_rollover_visits = Column(Integer, default=4)

    # Status
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    subscriptions = relationship("Subscription", back_populates="plan")

    def __repr__(self):
        return f"<SubscriptionPlan {self.slug}: {self.visits_per_month} visits @ ${self.monthly_price}>"


class Subscription(Base):
    """
    User subscription record.

    Tracks:
    - Which plan the user is on
    - Their preferences (day, time, cleaner)
    - Visit usage and rollover
    - Billing cycle information
    """
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    # Unique identifier
    subscription_number = Column(String(20), unique=True, nullable=False, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    address_id = Column(Integer, ForeignKey("addresses.id"), nullable=False)

    # Preferred cleaner (optional)
    preferred_cleaner_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)

    # Schedule preferences
    # Days of week: 0=Monday, 6=Sunday. e.g., [0, 3] = Monday and Thursday
    preferred_days = Column(ARRAY(Integer), nullable=True)
    preferred_time_slot = Column(String(20), nullable=True)  # "09:00 AM"

    # Property details (snapshot at subscription time)
    property_size_sqft = Column(Integer, nullable=True)
    bedrooms = Column(Integer, default=2)
    bathrooms = Column(Integer, default=1)

    # Service selection
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)

    # Status
    status = Column(
        SQLEnum(SubscriptionStatus),
        default=SubscriptionStatus.PENDING_ACTIVATION,
        nullable=False,
        index=True
    )
    pause_reason = Column(Text, nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    resume_at = Column(DateTime(timezone=True), nullable=True)  # Scheduled resume date

    # Billing cycle
    billing_cycle_start = Column(DateTime(timezone=True), nullable=False)
    next_billing_date = Column(DateTime(timezone=True), nullable=False)

    # Stripe integration
    stripe_subscription_id = Column(String(100), nullable=True, index=True)
    stripe_customer_id = Column(String(100), nullable=True)
    payment_method_id = Column(String(100), nullable=True)  # Stripe payment method

    # Visit tracking
    visits_allocated = Column(Integer, default=0)  # Total for current cycle
    visits_used = Column(Integer, default=0)
    visits_remaining = Column(Integer, default=0)
    rollover_visits = Column(Integer, default=0)  # From previous month

    # Lifecycle timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
    address = relationship("Address", backref="subscriptions")
    preferred_cleaner = relationship("Employee", backref="preferred_subscriptions")
    service = relationship("Service", backref="subscriptions")
    visits = relationship("SubscriptionVisit", back_populates="subscription")
    billing_history = relationship("SubscriptionBilling", back_populates="subscription")

    def __repr__(self):
        return f"<Subscription {self.subscription_number}: {self.status.value}>"

    @property
    def is_active(self) -> bool:
        """Check if subscription is currently active."""
        return self.status == SubscriptionStatus.ACTIVE

    @property
    def can_book_visit(self) -> bool:
        """Check if user can book a visit."""
        return self.is_active and self.visits_remaining > 0


class SubscriptionVisit(Base):
    """
    Tracks individual visits within a subscription.

    Links subscription visits to actual bookings.
    """
    __tablename__ = "subscription_visits"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)  # Nullable until booking is created

    # Visit tracking
    visit_number = Column(Integer, nullable=False)  # 1, 2, 3... within billing cycle
    billing_cycle_month = Column(String(7), nullable=False)  # "2024-01" format

    # Scheduling
    scheduled_date = Column(DateTime(timezone=True), nullable=True)

    # Flags
    is_rollover = Column(Boolean, default=False)  # From previous month
    is_used = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)

    # Cancellation tracking
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    rolled_over = Column(Boolean, default=False)  # Whether this cancelled visit was rolled over

    # Rescheduling tracking
    original_scheduled_date = Column(DateTime(timezone=True), nullable=True)  # Original date before reschedule
    rescheduled_at = Column(DateTime(timezone=True), nullable=True)
    reschedule_count = Column(Integer, default=0)  # How many times rescheduled

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    subscription = relationship("Subscription", back_populates="visits")
    booking = relationship("Booking", backref="subscription_visit")

    def __repr__(self):
        return f"<SubscriptionVisit #{self.visit_number} for subscription {self.subscription_id}>"


class SubscriptionBilling(Base):
    """
    Billing history for subscriptions.

    Tracks monthly charges, payment status, and retry attempts.
    """
    __tablename__ = "subscription_billing"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Billing period
    billing_date = Column(DateTime(timezone=True), nullable=False)
    billing_period_start = Column(DateTime(timezone=True), nullable=False)
    billing_period_end = Column(DateTime(timezone=True), nullable=False)

    # Amount
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="AED")

    # Visit allocation
    visits_allocated = Column(Integer, nullable=False)
    rollover_from_previous = Column(Integer, default=0)
    total_visits = Column(Integer, nullable=False)  # allocated + rollover

    # Payment status
    status = Column(
        SQLEnum(BillingStatus),
        default=BillingStatus.PENDING,
        nullable=False,
        index=True
    )

    # Retry tracking
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)

    # Stripe references
    stripe_invoice_id = Column(String(100), nullable=True, index=True)
    stripe_payment_intent_id = Column(String(100), nullable=True)
    stripe_charge_id = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    subscription = relationship("Subscription", back_populates="billing_history")

    def __repr__(self):
        return f"<SubscriptionBilling {self.billing_date}: {self.status.value}>"

    @property
    def can_retry(self) -> bool:
        """Check if payment can be retried."""
        return self.status == BillingStatus.FAILED and self.retry_count < self.max_retries


class SubscriptionPlanChange(Base):
    """
    Tracks subscription plan changes (upgrades/downgrades).
    """
    __tablename__ = "subscription_plan_changes"

    id = Column(Integer, primary_key=True, index=True)

    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Plan change
    from_plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    to_plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)

    # Effective dates
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    effective_at = Column(DateTime(timezone=True), nullable=False)

    # Proration
    prorated_amount = Column(Numeric(10, 2), nullable=True)  # Credit or charge

    # Status
    is_processed = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    from_plan = relationship("SubscriptionPlan", foreign_keys=[from_plan_id])
    to_plan = relationship("SubscriptionPlan", foreign_keys=[to_plan_id])

    def __repr__(self):
        return f"<PlanChange: {self.from_plan_id} -> {self.to_plan_id}>"
