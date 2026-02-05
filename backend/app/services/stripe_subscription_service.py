"""
Stripe Subscription Billing Service

Handles:
- Creating Stripe customers
- Creating Stripe subscriptions
- Managing payment methods
- Handling subscription webhooks
- Billing retry logic
"""
import stripe
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging

from app.config import settings
from app.models.subscription import (
    Subscription, SubscriptionBilling, SubscriptionPlan,
    SubscriptionStatus, BillingStatus
)
from app.models.user import User
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = getattr(settings, 'STRIPE_API_KEY', None)


class StripeSubscriptionService:
    """Service for Stripe subscription operations."""

    def __init__(self, db: Session):
        self.db = db
        self.subscription_service = SubscriptionService(db)

    # ============ Customer Management ============

    def get_or_create_stripe_customer(self, user: User) -> str:
        """
        Get existing Stripe customer or create a new one.

        Returns the Stripe customer ID.
        """
        # Check if user already has a Stripe customer ID
        if user.stripe_customer_id:
            return user.stripe_customer_id

        # Create new Stripe customer
        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=f"{user.first_name} {user.last_name}",
                phone=user.phone,
                metadata={
                    "user_id": str(user.id),
                    "source": "cleaning_service"
                }
            )

            # Save customer ID to user
            user.stripe_customer_id = customer.id
            self.db.commit()

            logger.info(f"Created Stripe customer {customer.id} for user {user.id}")
            return customer.id

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe customer: {e}")
            raise

    def attach_payment_method(
        self,
        customer_id: str,
        payment_method_id: str,
        set_default: bool = True
    ) -> None:
        """Attach a payment method to a Stripe customer."""
        try:
            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id
            )

            if set_default:
                # Set as default payment method
                stripe.Customer.modify(
                    customer_id,
                    invoice_settings={
                        "default_payment_method": payment_method_id
                    }
                )

            logger.info(f"Attached payment method {payment_method_id} to customer {customer_id}")

        except stripe.error.StripeError as e:
            logger.error(f"Failed to attach payment method: {e}")
            raise

    # ============ Subscription Management ============

    def create_stripe_subscription(
        self,
        subscription: Subscription,
        payment_method_id: Optional[str] = None
    ) -> stripe.Subscription:
        """
        Create a Stripe subscription for the local subscription.

        This creates the subscription in Stripe and links it to our system.
        """
        user = subscription.user
        plan = subscription.plan

        # Get or create Stripe customer
        customer_id = self.get_or_create_stripe_customer(user)

        # Attach payment method if provided
        if payment_method_id:
            self.attach_payment_method(customer_id, payment_method_id)

        # Get or create Stripe price
        price_id = self._get_or_create_price(plan)

        try:
            # Create Stripe subscription
            stripe_sub = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                payment_behavior="default_incomplete",
                payment_settings={
                    "save_default_payment_method": "on_subscription"
                },
                expand=["latest_invoice.payment_intent"],
                metadata={
                    "subscription_id": str(subscription.id),
                    "subscription_number": subscription.subscription_number,
                    "plan_id": str(plan.id),
                    "plan_name": plan.name
                }
            )

            # Update local subscription with Stripe IDs
            subscription.stripe_subscription_id = stripe_sub.id
            subscription.stripe_customer_id = customer_id
            if payment_method_id:
                subscription.payment_method_id = payment_method_id

            self.db.commit()

            logger.info(f"Created Stripe subscription {stripe_sub.id} for {subscription.subscription_number}")
            return stripe_sub

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe subscription: {e}")
            raise

    def _get_or_create_price(self, plan: SubscriptionPlan) -> str:
        """
        Get or create a Stripe Price for the plan.

        In production, you'd typically create prices in the Stripe dashboard
        and store the price_id on the plan. This is a fallback.
        """
        # Check if plan has a stored Stripe price ID
        if hasattr(plan, 'stripe_price_id') and plan.stripe_price_id:
            return plan.stripe_price_id

        # Create a new price (or find existing by lookup_key)
        try:
            # Try to find existing price by lookup_key
            prices = stripe.Price.list(
                lookup_keys=[f"plan_{plan.slug}"],
                limit=1
            )

            if prices.data:
                return prices.data[0].id

            # Create new price
            price = stripe.Price.create(
                unit_amount=int(plan.monthly_price * 100),  # Convert to cents
                currency="aed",
                recurring={"interval": "month"},
                product_data={
                    "name": plan.name,
                    "metadata": {
                        "plan_id": str(plan.id),
                        "visits_per_month": str(plan.visits_per_month)
                    }
                },
                lookup_key=f"plan_{plan.slug}"
            )

            return price.id

        except stripe.error.StripeError as e:
            logger.error(f"Failed to get/create Stripe price: {e}")
            raise

    def cancel_stripe_subscription(
        self,
        subscription: Subscription,
        immediately: bool = False
    ) -> None:
        """Cancel a Stripe subscription."""
        if not subscription.stripe_subscription_id:
            return

        try:
            if immediately:
                stripe.Subscription.cancel(subscription.stripe_subscription_id)
            else:
                # Cancel at period end
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )

            logger.info(f"Cancelled Stripe subscription {subscription.stripe_subscription_id}")

        except stripe.error.StripeError as e:
            logger.error(f"Failed to cancel Stripe subscription: {e}")
            raise

    def pause_stripe_subscription(self, subscription: Subscription) -> None:
        """Pause billing for a Stripe subscription."""
        if not subscription.stripe_subscription_id:
            return

        try:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                pause_collection={"behavior": "void"}
            )

            logger.info(f"Paused Stripe subscription {subscription.stripe_subscription_id}")

        except stripe.error.StripeError as e:
            logger.error(f"Failed to pause Stripe subscription: {e}")
            raise

    def resume_stripe_subscription(self, subscription: Subscription) -> None:
        """Resume billing for a paused Stripe subscription."""
        if not subscription.stripe_subscription_id:
            return

        try:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                pause_collection=""  # Clear pause
            )

            logger.info(f"Resumed Stripe subscription {subscription.stripe_subscription_id}")

        except stripe.error.StripeError as e:
            logger.error(f"Failed to resume Stripe subscription: {e}")
            raise

    # ============ Webhook Handling ============

    def handle_webhook_event(self, event: stripe.Event) -> Dict[str, Any]:
        """
        Handle Stripe webhook events.

        Returns a dict with processing result.
        """
        event_type = event.type
        data = event.data.object

        handlers = {
            "invoice.payment_succeeded": self._handle_invoice_paid,
            "invoice.payment_failed": self._handle_invoice_failed,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_deleted,
        }

        handler = handlers.get(event_type)
        if handler:
            return handler(data)

        return {"status": "ignored", "event_type": event_type}

    def _handle_invoice_paid(self, invoice: stripe.Invoice) -> Dict[str, Any]:
        """Handle successful invoice payment."""
        stripe_sub_id = invoice.subscription

        if not stripe_sub_id:
            return {"status": "ignored", "reason": "not a subscription invoice"}

        # Find local subscription
        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub_id
        ).first()

        if not subscription:
            logger.warning(f"No local subscription found for Stripe sub {stripe_sub_id}")
            return {"status": "error", "reason": "subscription not found"}

        # If subscription is pending activation, activate it
        if subscription.status == SubscriptionStatus.PENDING_ACTIVATION:
            subscription = self.subscription_service.activate_subscription(
                subscription.id,
                stripe_subscription_id=stripe_sub_id
            )

        # Find or create billing record
        billing = self.db.query(SubscriptionBilling).filter(
            SubscriptionBilling.stripe_invoice_id == invoice.id
        ).first()

        if billing:
            # Update existing billing record
            self.subscription_service.mark_billing_paid(
                billing.id,
                stripe_invoice_id=invoice.id,
                stripe_payment_intent_id=invoice.payment_intent
            )
        else:
            # This might be for a new billing cycle
            # Process billing cycle
            if subscription.status == SubscriptionStatus.ACTIVE:
                subscription, billing = self.subscription_service.process_billing_cycle(
                    subscription.id
                )
                self.subscription_service.mark_billing_paid(
                    billing.id,
                    stripe_invoice_id=invoice.id,
                    stripe_payment_intent_id=invoice.payment_intent
                )

        logger.info(f"Processed successful payment for subscription {subscription.subscription_number}")
        return {"status": "success", "subscription_id": subscription.id}

    def _handle_invoice_failed(self, invoice: stripe.Invoice) -> Dict[str, Any]:
        """Handle failed invoice payment."""
        stripe_sub_id = invoice.subscription

        if not stripe_sub_id:
            return {"status": "ignored", "reason": "not a subscription invoice"}

        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub_id
        ).first()

        if not subscription:
            return {"status": "error", "reason": "subscription not found"}

        # Find billing record
        billing = self.db.query(SubscriptionBilling).filter(
            SubscriptionBilling.stripe_invoice_id == invoice.id
        ).first()

        if billing:
            self.subscription_service.mark_billing_failed(
                billing.id,
                error_message=f"Payment failed: {invoice.last_payment_error.message if invoice.last_payment_error else 'Unknown error'}"
            )

        logger.warning(f"Payment failed for subscription {subscription.subscription_number}")
        return {"status": "success", "subscription_id": subscription.id, "action": "payment_failed"}

    def _handle_subscription_updated(self, stripe_sub: stripe.Subscription) -> Dict[str, Any]:
        """Handle subscription status updates from Stripe."""
        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub.id
        ).first()

        if not subscription:
            return {"status": "error", "reason": "subscription not found"}

        # Map Stripe status to our status
        status_map = {
            "active": SubscriptionStatus.ACTIVE,
            "past_due": SubscriptionStatus.PAYMENT_FAILED,
            "canceled": SubscriptionStatus.CANCELLED,
            "unpaid": SubscriptionStatus.PAYMENT_FAILED,
            "paused": SubscriptionStatus.PAUSED,
        }

        new_status = status_map.get(stripe_sub.status)
        if new_status and subscription.status != new_status:
            subscription.status = new_status
            self.db.commit()

            logger.info(f"Updated subscription {subscription.subscription_number} status to {new_status}")

        return {"status": "success", "subscription_id": subscription.id}

    def _handle_subscription_deleted(self, stripe_sub: stripe.Subscription) -> Dict[str, Any]:
        """Handle subscription cancellation from Stripe."""
        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub.id
        ).first()

        if not subscription:
            return {"status": "error", "reason": "subscription not found"}

        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancelled_at = datetime.now(timezone.utc)
        self.db.commit()

        logger.info(f"Subscription {subscription.subscription_number} cancelled via Stripe")
        return {"status": "success", "subscription_id": subscription.id}

    # ============ Client Secret for Frontend ============

    def get_setup_intent(self, user: User) -> Dict[str, str]:
        """
        Create a SetupIntent for collecting payment method.

        Returns client_secret for Stripe.js on the frontend.
        """
        customer_id = self.get_or_create_stripe_customer(user)

        try:
            setup_intent = stripe.SetupIntent.create(
                customer=customer_id,
                payment_method_types=["card"],
                metadata={
                    "user_id": str(user.id)
                }
            )

            return {
                "client_secret": setup_intent.client_secret,
                "customer_id": customer_id
            }

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create SetupIntent: {e}")
            raise

    def get_subscription_payment_intent(
        self,
        subscription: Subscription
    ) -> Optional[Dict[str, str]]:
        """
        Get the payment intent for a pending subscription.

        Returns client_secret for confirming payment.
        """
        if not subscription.stripe_subscription_id:
            return None

        try:
            stripe_sub = stripe.Subscription.retrieve(
                subscription.stripe_subscription_id,
                expand=["latest_invoice.payment_intent"]
            )

            if stripe_sub.latest_invoice and stripe_sub.latest_invoice.payment_intent:
                return {
                    "client_secret": stripe_sub.latest_invoice.payment_intent.client_secret,
                    "amount": stripe_sub.latest_invoice.amount_due / 100  # Convert from cents
                }

            return None

        except stripe.error.StripeError as e:
            logger.error(f"Failed to get payment intent: {e}")
            raise
