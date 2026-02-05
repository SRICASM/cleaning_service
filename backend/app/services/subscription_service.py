"""
Subscription Service

Handles all subscription-related business logic:
- Subscription creation and management
- Visit allocation and scheduling
- Billing cycle management
- Pause/resume/cancel operations
- Rollover calculations
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional, List, Tuple
from decimal import Decimal
import logging
import uuid

from app.models.subscription import (
    SubscriptionPlan, Subscription, SubscriptionVisit,
    SubscriptionBilling, SubscriptionPlanChange,
    SubscriptionStatus, BillingStatus
)
from app.models.user import User, Address
from app.models.booking import Booking, BookingStatus
from app.models.service import Service

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Service class for subscription operations."""

    def __init__(self, db: Session):
        self.db = db

    # ============ Subscription Number Generation ============

    def generate_subscription_number(self) -> str:
        """Generate a unique subscription number like SUB-2024-XXXXXX."""
        year = datetime.utcnow().year
        random_part = uuid.uuid4().hex[:6].upper()
        return f"SUB-{year}-{random_part}"

    # ============ Plan Operations ============

    def get_active_plans(self) -> List[SubscriptionPlan]:
        """Get all active subscription plans."""
        return self.db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True
        ).order_by(SubscriptionPlan.display_order).all()

    def get_plan_by_id(self, plan_id: int) -> Optional[SubscriptionPlan]:
        """Get a plan by ID."""
        return self.db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == plan_id
        ).first()

    def get_plan_by_slug(self, slug: str) -> Optional[SubscriptionPlan]:
        """Get a plan by slug."""
        return self.db.query(SubscriptionPlan).filter(
            SubscriptionPlan.slug == slug
        ).first()

    # ============ Subscription CRUD ============

    def create_subscription(
        self,
        user_id: int,
        plan_id: int,
        address_id: int,
        service_id: int,
        preferred_days: Optional[List[int]] = None,
        preferred_time_slot: Optional[str] = None,
        preferred_cleaner_id: Optional[str] = None,
        property_size_sqft: Optional[int] = None,
        bedrooms: int = 2,
        bathrooms: int = 1,
        payment_method_id: Optional[str] = None,
        stripe_customer_id: Optional[str] = None
    ) -> Subscription:
        """
        Create a new subscription.

        The subscription starts in PENDING_ACTIVATION status.
        It becomes ACTIVE after the first successful payment.
        """
        # Validate plan exists and is active
        plan = self.get_plan_by_id(plan_id)
        if not plan or not plan.is_active:
            raise ValueError(f"Invalid or inactive plan: {plan_id}")

        # Validate address belongs to user
        address = self.db.query(Address).filter(
            Address.id == address_id,
            Address.user_id == user_id
        ).first()
        if not address:
            raise ValueError(f"Invalid address: {address_id}")

        # Validate service exists
        service = self.db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise ValueError(f"Invalid service: {service_id}")

        # Calculate billing dates
        now = datetime.utcnow()
        billing_cycle_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_billing_date = billing_cycle_start + relativedelta(months=1)

        # Create subscription
        subscription = Subscription(
            subscription_number=self.generate_subscription_number(),
            user_id=user_id,
            plan_id=plan_id,
            address_id=address_id,
            service_id=service_id,
            preferred_days=preferred_days,
            preferred_time_slot=preferred_time_slot,
            preferred_cleaner_id=uuid.UUID(preferred_cleaner_id) if preferred_cleaner_id else None,
            property_size_sqft=property_size_sqft,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            status=SubscriptionStatus.PENDING_ACTIVATION,
            billing_cycle_start=billing_cycle_start,
            next_billing_date=next_billing_date,
            visits_allocated=plan.visits_per_month,
            visits_used=0,
            visits_remaining=plan.visits_per_month,
            rollover_visits=0,
            stripe_customer_id=stripe_customer_id,
            payment_method_id=payment_method_id
        )

        self.db.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)

        logger.info(f"Created subscription {subscription.subscription_number} for user {user_id}")
        return subscription

    def create_package_subscription(
        self,
        user_id: int,
        visits: int,
        address_id: int,
        service_id: int,
        payment_method_id: Optional[str] = None,
        validity_months: int = 3
    ) -> Subscription:
        """
        Create a subscription from a package purchase.
        
        Uses a generic plan but overrides visit counts.
        """
        # Find a suitable base plan (e.g., the first active one) or a specific "Package" plan
        # For now, we'll use the first active plan as a placeholder for the foreign key
        plan = self.db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True
        ).first()
        
        if not plan:
            # Fallback if no plans exist (shouldn't happen in prod)
            raise ValueError("No subscription plans found to link package to")

        # Validate address
        address = self.db.query(Address).filter(
            Address.id == address_id,
            Address.user_id == user_id
        ).first()
        if not address:
            raise ValueError(f"Invalid address: {address_id}")

        # Validate service
        service = self.db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise ValueError(f"Invalid service: {service_id}")

        now = datetime.utcnow()
        billing_cycle_start = now
        # Set next billing date to validity period (e.g. 3 months)
        # Packages are typically one-off, but we track them as a cycle for validity
        next_billing_date = now + relativedelta(months=validity_months)

        subscription = Subscription(
            subscription_number=self.generate_subscription_number(),
            user_id=user_id,
            plan_id=plan.id,
            address_id=address_id,
            service_id=service_id,
            status=SubscriptionStatus.ACTIVE, # Auto-activate for packages (assuming paid)
            billing_cycle_start=billing_cycle_start,
            next_billing_date=next_billing_date,
            visits_allocated=visits,
            visits_used=0,
            visits_remaining=visits,
            rollover_visits=0,
            payment_method_id=payment_method_id,
            started_at=now
        )

        self.db.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)
        
        # Create visit slots immediately
        self._create_visit_slots(subscription)
        
        logger.info(f"Created package subscription {subscription.subscription_number} with {visits} visits")
        return subscription


    def get_subscription(self, subscription_id: int) -> Optional[Subscription]:
        """Get subscription by ID."""
        return self.db.query(Subscription).filter(
            Subscription.id == subscription_id
        ).first()

    def get_subscription_by_number(self, subscription_number: str) -> Optional[Subscription]:
        """Get subscription by subscription number."""
        return self.db.query(Subscription).filter(
            Subscription.subscription_number == subscription_number
        ).first()

    def get_user_subscriptions(
        self,
        user_id: int,
        include_cancelled: bool = False
    ) -> List[Subscription]:
        """Get all subscriptions for a user."""
        query = self.db.query(Subscription).filter(Subscription.user_id == user_id)

        if not include_cancelled:
            query = query.filter(Subscription.status != SubscriptionStatus.CANCELLED)

        return query.order_by(Subscription.created_at.desc()).all()

    def get_active_subscription_for_address(
        self,
        user_id: int,
        address_id: int
    ) -> Optional[Subscription]:
        """Check if user has an active subscription for an address."""
        return self.db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.address_id == address_id,
            Subscription.status == SubscriptionStatus.ACTIVE
        ).first()

    # ============ Subscription Activation ============

    def activate_subscription(
        self,
        subscription_id: int,
        stripe_subscription_id: Optional[str] = None
    ) -> Subscription:
        """
        Activate a subscription after successful payment.

        - Sets status to ACTIVE
        - Records started_at timestamp
        - Creates initial visit slots
        - Creates billing record
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        if subscription.status != SubscriptionStatus.PENDING_ACTIVATION:
            raise ValueError(f"Subscription is already {subscription.status.value}")

        subscription.status = SubscriptionStatus.ACTIVE
        subscription.started_at = datetime.utcnow()
        if stripe_subscription_id:
            subscription.stripe_subscription_id = stripe_subscription_id

        # Create initial visit slots
        self._create_visit_slots(subscription)

        # Create first billing record
        self._create_billing_record(subscription, is_first=True)

        self.db.commit()
        self.db.refresh(subscription)

        logger.info(f"Activated subscription {subscription.subscription_number}")
        return subscription

    # ============ Pause/Resume/Cancel ============

    def pause_subscription(
        self,
        subscription_id: int,
        reason: Optional[str] = None,
        resume_at: Optional[datetime] = None
    ) -> Subscription:
        """
        Pause a subscription.

        - Visits stop accruing
        - Scheduled visits are cancelled
        - Can set auto-resume date
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        if subscription.status != SubscriptionStatus.ACTIVE:
            raise ValueError(f"Can only pause active subscriptions")

        subscription.status = SubscriptionStatus.PAUSED
        subscription.pause_reason = reason
        subscription.paused_at = datetime.utcnow()
        subscription.resume_at = resume_at

        # Cancel pending visits
        self._cancel_pending_visits(subscription)

        self.db.commit()
        self.db.refresh(subscription)

        logger.info(f"Paused subscription {subscription.subscription_number}")
        return subscription

    def resume_subscription(self, subscription_id: int) -> Subscription:
        """
        Resume a paused subscription.

        - Sets status back to ACTIVE
        - Clears pause fields
        - Creates new visit slots for remaining allocation
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        if subscription.status != SubscriptionStatus.PAUSED:
            raise ValueError(f"Can only resume paused subscriptions")

        subscription.status = SubscriptionStatus.ACTIVE
        subscription.pause_reason = None
        subscription.paused_at = None
        subscription.resume_at = None

        # Recreate visit slots for remaining visits
        self._create_visit_slots(subscription)

        self.db.commit()
        self.db.refresh(subscription)

        logger.info(f"Resumed subscription {subscription.subscription_number}")
        return subscription

    def cancel_subscription(
        self,
        subscription_id: int,
        reason: Optional[str] = None,
        immediate: bool = False
    ) -> Subscription:
        """
        Cancel a subscription.

        - If immediate, cancels now
        - Otherwise, cancels at end of billing cycle
        - Cancels any pending visits
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        if subscription.status == SubscriptionStatus.CANCELLED:
            raise ValueError(f"Subscription is already cancelled")

        subscription.cancellation_reason = reason
        subscription.cancelled_at = datetime.utcnow()

        if immediate:
            subscription.status = SubscriptionStatus.CANCELLED
            self._cancel_pending_visits(subscription)
        else:
            # Set to expire at end of current billing cycle
            subscription.expires_at = subscription.next_billing_date

        self.db.commit()
        self.db.refresh(subscription)

        logger.info(f"Cancelled subscription {subscription.subscription_number} (immediate={immediate})")
        return subscription

    # ============ Visit Management ============

    def _create_visit_slots(self, subscription: Subscription) -> List[SubscriptionVisit]:
        """Create visit slots for the current billing cycle."""
        billing_month = subscription.billing_cycle_start.strftime("%Y-%m")

        # Check if slots already exist for this month
        existing = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.subscription_id == subscription.id,
            SubscriptionVisit.billing_cycle_month == billing_month
        ).count()

        if existing > 0:
            return []

        visits = []
        total_visits = subscription.visits_allocated + subscription.rollover_visits

        for i in range(total_visits):
            is_rollover = i >= subscription.visits_allocated
            visit = SubscriptionVisit(
                subscription_id=subscription.id,
                visit_number=i + 1,
                billing_cycle_month=billing_month,
                is_rollover=is_rollover,
                is_used=False,
                is_cancelled=False
            )
            visits.append(visit)
            self.db.add(visit)

        return visits

    def _cancel_pending_visits(self, subscription: Subscription) -> int:
        """Cancel all pending (unscheduled/unused) visits for a subscription."""
        cancelled = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.subscription_id == subscription.id,
            SubscriptionVisit.is_used == False,
            SubscriptionVisit.is_cancelled == False
        ).update({
            SubscriptionVisit.is_cancelled: True
        })
        return cancelled

    def use_visit(
        self,
        subscription_id: int,
        booking_id: int,
        scheduled_date: datetime
    ) -> SubscriptionVisit:
        """
        Use a visit slot from the subscription.

        Links the visit to a booking and marks it as used.
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        if not subscription.can_book_visit:
            raise ValueError("No visits remaining")

        # Find an available visit slot (prefer non-rollover first)
        visit = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.subscription_id == subscription_id,
            SubscriptionVisit.is_used == False,
            SubscriptionVisit.is_cancelled == False
        ).order_by(
            SubscriptionVisit.is_rollover.asc(),
            SubscriptionVisit.visit_number.asc()
        ).first()

        if not visit:
            raise ValueError("No visit slots available")

        # Mark visit as used
        visit.booking_id = booking_id
        visit.scheduled_date = scheduled_date
        visit.is_used = True
        visit.used_at = datetime.utcnow()

        # Update subscription counters
        subscription.visits_used += 1
        subscription.visits_remaining -= 1

        self.db.commit()
        self.db.refresh(visit)

        logger.info(f"Used visit {visit.id} for booking {booking_id}")
        return visit

    def get_subscription_visits(
        self,
        subscription_id: int,
        billing_month: Optional[str] = None
    ) -> List[SubscriptionVisit]:
        """Get visits for a subscription, optionally filtered by billing month."""
        query = self.db.query(SubscriptionVisit).filter(
            SubscriptionVisit.subscription_id == subscription_id
        )

        if billing_month:
            query = query.filter(SubscriptionVisit.billing_cycle_month == billing_month)

        return query.order_by(SubscriptionVisit.visit_number).all()

    # ============ Billing Operations ============

    def _create_billing_record(
        self,
        subscription: Subscription,
        is_first: bool = False
    ) -> SubscriptionBilling:
        """Create a billing record for the subscription."""
        plan = subscription.plan

        billing_period_start = subscription.billing_cycle_start
        billing_period_end = subscription.next_billing_date

        billing = SubscriptionBilling(
            subscription_id=subscription.id,
            billing_date=datetime.utcnow() if is_first else subscription.next_billing_date,
            billing_period_start=billing_period_start,
            billing_period_end=billing_period_end,
            amount=plan.monthly_price,
            currency="AED",
            visits_allocated=plan.visits_per_month,
            rollover_from_previous=subscription.rollover_visits,
            total_visits=plan.visits_per_month + subscription.rollover_visits,
            status=BillingStatus.PENDING
        )

        self.db.add(billing)
        return billing

    def process_billing_cycle(self, subscription_id: int) -> Tuple[Subscription, SubscriptionBilling]:
        """
        Process billing cycle for a subscription.

        Called at the start of each billing cycle:
        1. Calculate rollover visits
        2. Reset visit counters
        3. Create new billing record
        4. Create new visit slots
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        if subscription.status != SubscriptionStatus.ACTIVE:
            raise ValueError(f"Subscription is not active: {subscription.status.value}")

        plan = subscription.plan

        # Calculate rollover (unused visits, up to max)
        unused_visits = subscription.visits_remaining
        rollover = min(unused_visits, plan.max_rollover_visits)

        # Update billing dates
        old_billing_start = subscription.billing_cycle_start
        subscription.billing_cycle_start = subscription.next_billing_date
        subscription.next_billing_date = subscription.billing_cycle_start + relativedelta(months=1)

        # Reset visit counters
        subscription.rollover_visits = rollover
        subscription.visits_allocated = plan.visits_per_month
        subscription.visits_used = 0
        subscription.visits_remaining = plan.visits_per_month + rollover

        # Create billing record
        billing = self._create_billing_record(subscription)

        # Create visit slots for new cycle
        self._create_visit_slots(subscription)

        self.db.commit()
        self.db.refresh(subscription)
        self.db.refresh(billing)

        logger.info(
            f"Processed billing cycle for {subscription.subscription_number}: "
            f"{rollover} visits rolled over, {subscription.visits_remaining} total"
        )

        return subscription, billing

    def mark_billing_paid(
        self,
        billing_id: int,
        stripe_invoice_id: Optional[str] = None,
        stripe_payment_intent_id: Optional[str] = None,
        stripe_charge_id: Optional[str] = None
    ) -> SubscriptionBilling:
        """Mark a billing record as paid."""
        billing = self.db.query(SubscriptionBilling).filter(
            SubscriptionBilling.id == billing_id
        ).first()

        if not billing:
            raise ValueError(f"Billing record not found: {billing_id}")

        billing.status = BillingStatus.PAID
        billing.paid_at = datetime.utcnow()
        billing.stripe_invoice_id = stripe_invoice_id
        billing.stripe_payment_intent_id = stripe_payment_intent_id
        billing.stripe_charge_id = stripe_charge_id

        self.db.commit()
        self.db.refresh(billing)
        return billing

    def mark_billing_failed(
        self,
        billing_id: int,
        error_message: str
    ) -> SubscriptionBilling:
        """Mark a billing record as failed and schedule retry."""
        billing = self.db.query(SubscriptionBilling).filter(
            SubscriptionBilling.id == billing_id
        ).first()

        if not billing:
            raise ValueError(f"Billing record not found: {billing_id}")

        billing.retry_count += 1
        billing.last_error = error_message
        billing.failed_at = datetime.utcnow()

        if billing.can_retry:
            billing.status = BillingStatus.RETRYING
            # Retry in 24 hours
            billing.next_retry_at = datetime.utcnow() + timedelta(hours=24)
        else:
            billing.status = BillingStatus.FAILED
            # Update subscription status
            subscription = billing.subscription
            subscription.status = SubscriptionStatus.PAYMENT_FAILED

        self.db.commit()
        self.db.refresh(billing)
        return billing

    # ============ Plan Change ============

    def change_plan(
        self,
        subscription_id: int,
        new_plan_id: int,
        effective_immediately: bool = False
    ) -> SubscriptionPlanChange:
        """
        Request a plan change for a subscription.

        If effective_immediately, applies proration.
        Otherwise, changes at next billing cycle.
        """
        subscription = self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription not found: {subscription_id}")

        new_plan = self.get_plan_by_id(new_plan_id)
        if not new_plan or not new_plan.is_active:
            raise ValueError(f"Invalid or inactive plan: {new_plan_id}")

        if subscription.plan_id == new_plan_id:
            raise ValueError("New plan is the same as current plan")

        # Calculate effective date
        if effective_immediately:
            effective_at = datetime.utcnow()
            # Calculate proration
            prorated_amount = self._calculate_proration(subscription, new_plan)
        else:
            effective_at = subscription.next_billing_date
            prorated_amount = None

        # Create plan change record
        plan_change = SubscriptionPlanChange(
            subscription_id=subscription_id,
            from_plan_id=subscription.plan_id,
            to_plan_id=new_plan_id,
            effective_at=effective_at,
            prorated_amount=prorated_amount,
            is_processed=effective_immediately
        )

        self.db.add(plan_change)

        if effective_immediately:
            self._apply_plan_change(subscription, new_plan)
            plan_change.processed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(plan_change)

        logger.info(
            f"Plan change requested for {subscription.subscription_number}: "
            f"{subscription.plan.slug} -> {new_plan.slug}"
        )

        return plan_change

    def _calculate_proration(
        self,
        subscription: Subscription,
        new_plan: SubscriptionPlan
    ) -> Decimal:
        """
        Calculate proration amount for immediate plan change.

        Positive = user owes more
        Negative = user gets credit
        """
        now = datetime.utcnow()
        cycle_start = subscription.billing_cycle_start
        cycle_end = subscription.next_billing_date

        total_days = (cycle_end - cycle_start).days
        remaining_days = (cycle_end - now).days

        if total_days <= 0:
            return Decimal("0")

        # Calculate daily rates
        old_daily = subscription.plan.monthly_price / Decimal(total_days)
        new_daily = new_plan.monthly_price / Decimal(total_days)

        # Proration = (new rate - old rate) * remaining days
        proration = (new_daily - old_daily) * Decimal(remaining_days)

        return proration.quantize(Decimal("0.01"))

    def _apply_plan_change(
        self,
        subscription: Subscription,
        new_plan: SubscriptionPlan
    ):
        """Apply a plan change to a subscription immediately."""
        old_plan = subscription.plan

        # Update plan
        subscription.plan_id = new_plan.id

        # Adjust visit allocation proportionally
        visits_used_ratio = subscription.visits_used / old_plan.visits_per_month if old_plan.visits_per_month > 0 else 0
        new_visits_used = int(new_plan.visits_per_month * visits_used_ratio)

        subscription.visits_allocated = new_plan.visits_per_month
        subscription.visits_used = new_visits_used
        subscription.visits_remaining = new_plan.visits_per_month - new_visits_used + subscription.rollover_visits

    # ============ Statistics ============

    def get_subscription_stats(self) -> dict:
        """Get subscription statistics for admin dashboard."""
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Count by status
        active_count = self.db.query(Subscription).filter(
            Subscription.status == SubscriptionStatus.ACTIVE
        ).count()

        paused_count = self.db.query(Subscription).filter(
            Subscription.status == SubscriptionStatus.PAUSED
        ).count()

        # Cancelled this month
        cancelled_this_month = self.db.query(Subscription).filter(
            Subscription.status == SubscriptionStatus.CANCELLED,
            Subscription.cancelled_at >= month_start
        ).count()

        # New this month
        new_this_month = self.db.query(Subscription).filter(
            Subscription.created_at >= month_start
        ).count()

        # MRR (Monthly Recurring Revenue)
        mrr_result = self.db.query(
            func.sum(SubscriptionPlan.monthly_price)
        ).join(Subscription).filter(
            Subscription.status == SubscriptionStatus.ACTIVE
        ).scalar()
        mrr = Decimal(mrr_result or 0)

        # Average visits per subscription
        avg_visits_result = self.db.query(
            func.avg(Subscription.visits_used)
        ).filter(
            Subscription.status == SubscriptionStatus.ACTIVE
        ).scalar()
        avg_visits = float(avg_visits_result or 0)

        # Churn rate (cancelled / total active at month start)
        # Simplified calculation
        total_at_start = active_count + cancelled_this_month
        churn_rate = (cancelled_this_month / total_at_start * 100) if total_at_start > 0 else 0

        return {
            "total_active": active_count,
            "total_paused": paused_count,
            "total_cancelled_this_month": cancelled_this_month,
            "new_this_month": new_this_month,
            "mrr": mrr,
            "average_visits_per_subscription": round(avg_visits, 2),
            "churn_rate": round(churn_rate, 2)
        }
