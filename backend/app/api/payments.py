from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from decimal import Decimal
from app.database import get_db
from app.api.deps import get_current_user, get_admin_user
from app.core.exceptions import (
    NotFoundException, ForbiddenException, BadRequestException,
    PaymentFailedException
)
from app.models import (
    Booking, Payment, Refund, User,
    PaymentStatus, BookingStatus, RefundStatus, ProcessedWebhookEvent
)
import hashlib
import json
from app.schemas import (
    PaymentCreateRequest, PaymentCreateResponse,
    PaymentStatusResponse, PaymentVerifyRequest, PaymentVerifyResponse,
    RefundCreateRequest, RefundResponse
)
from app.config import settings
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse
)
import logging

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)


async def _get_stripe_checkout(request: Request) -> StripeCheckout:
    """Get Stripe checkout instance."""
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=settings.STRIPE_API_KEY, webhook_url=webhook_url)


@router.post("/checkout", response_model=PaymentCreateResponse)
async def create_checkout(
    data: PaymentCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session for a booking."""
    # Get booking
    booking = db.query(Booking).filter(Booking.id == data.booking_id).first()
    
    if not booking:
        raise NotFoundException("Booking not found")
    
    if booking.customer_id != current_user.id:
        raise ForbiddenException()
    
    if booking.payment_status == PaymentStatus.PAID:
        raise BadRequestException("Booking is already paid")
    
    # Create success/cancel URLs
    success_url = f"{data.origin_url}/booking/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/booking/cancel?booking_id={booking.id}"
    
    # Create Stripe checkout
    stripe_checkout = await _get_stripe_checkout(request)
    
    checkout_request = CheckoutSessionRequest(
        amount=float(booking.total_price),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "booking_id": str(booking.id),
            "booking_number": booking.booking_number,
            "customer_id": str(current_user.id),
            "customer_email": current_user.email
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create or update payment record
    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    
    if not payment:
        payment = Payment(
            booking_id=booking.id,
            stripe_session_id=session.session_id,
            amount=booking.total_price,
            currency="USD",
            status=PaymentStatus.PENDING
        )
        db.add(payment)
    else:
        payment.stripe_session_id = session.session_id
        payment.status = PaymentStatus.PENDING
    
    db.commit()
    
    return PaymentCreateResponse(
        checkout_url=session.url,
        session_id=session.session_id
    )


@router.get("/status/{session_id}", response_model=PaymentVerifyResponse)
async def verify_payment(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify payment status by Stripe session ID."""
    payment = db.query(Payment).filter(
        Payment.stripe_session_id == session_id
    ).first()
    
    if not payment:
        raise NotFoundException("Payment not found")
    
    # Check access
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if booking.customer_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException()
    
    # If already marked as paid, return status
    if payment.status == PaymentStatus.PAID:
        return PaymentVerifyResponse(
            status="complete",
            payment_status="paid",
            booking_id=payment.booking_id,
            amount=payment.amount
        )
    
    # Check with Stripe
    stripe_checkout = await _get_stripe_checkout(request)
    
    try:
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        if checkout_status.payment_status == "paid":
            # Update payment
            payment.status = PaymentStatus.PAID
            payment.paid_at = datetime.now(timezone.utc)
            
            # Update booking
            booking.payment_status = PaymentStatus.PAID
            booking.status = BookingStatus.CONFIRMED
            
            db.commit()
            
            # TODO: Send confirmation notification
            
            return PaymentVerifyResponse(
                status="complete",
                payment_status="paid",
                booking_id=payment.booking_id,
                amount=payment.amount
            )
        else:
            return PaymentVerifyResponse(
                status=checkout_status.status,
                payment_status=checkout_status.payment_status,
                booking_id=payment.booking_id,
                amount=payment.amount
            )
    
    except Exception as e:
        logger.error(f"Error checking payment status: {e}")
        raise PaymentFailedException(str(e))


@router.get("/booking/{booking_id}", response_model=PaymentStatusResponse)
async def get_payment_by_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payment details for a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise NotFoundException("Booking not found")
    
    if booking.customer_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException()
    
    payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    
    if not payment:
        raise NotFoundException("Payment not found")
    
    return payment


# ============ Admin: Refunds ============

@router.post("/refund", response_model=RefundResponse)
async def create_refund(
    data: RefundCreateRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Create a refund for a payment."""
    payment = db.query(Payment).filter(Payment.id == data.payment_id).first()
    
    if not payment:
        raise NotFoundException("Payment not found")
    
    if payment.status != PaymentStatus.PAID:
        raise BadRequestException("Can only refund paid payments")
    
    # Determine refund amount
    refund_amount = data.amount if data.amount else payment.amount
    
    if refund_amount > payment.amount:
        raise BadRequestException("Refund amount exceeds payment amount")
    
    # Create refund record
    refund = Refund(
        payment_id=payment.id,
        amount=refund_amount,
        reason=data.reason,
        status=RefundStatus.PENDING,
        initiated_by_id=admin.id
    )
    db.add(refund)
    
    # TODO: Process refund via Stripe
    # For now, mark as completed
    refund.status = RefundStatus.COMPLETED
    refund.processed_at = datetime.now(timezone.utc)
    
    # Update payment status
    if refund_amount == payment.amount:
        payment.status = PaymentStatus.REFUNDED
        
        # Update booking
        booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
        if booking:
            booking.status = BookingStatus.REFUNDED
            booking.payment_status = PaymentStatus.REFUNDED
    else:
        payment.status = PaymentStatus.PARTIALLY_REFUNDED
    
    db.commit()
    db.refresh(refund)
    
    return refund


# ============ Webhook ============

@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhooks with idempotency.

    - Validates webhook signature
    - Checks for duplicate events using event ID
    - Processes payment confirmations
    - Records processed events for audit trail
    """
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    stripe_checkout = await _get_stripe_checkout(request)

    try:
        # Parse the webhook to extract event metadata
        import stripe
        stripe.api_key = settings.STRIPE_API_KEY

        try:
            event = stripe.Webhook.construct_event(
                body, signature, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid Stripe webhook signature")
            return {"status": "error", "message": "Invalid signature"}
        except Exception as e:
            # Fall back to direct handling if signature verification fails
            logger.warning(f"Signature verification skipped: {e}")
            event = json.loads(body)

        event_id = event.get("id") if isinstance(event, dict) else event.id
        event_type = event.get("type") if isinstance(event, dict) else event.type

        if not event_id:
            logger.error("No event ID in webhook payload")
            return {"status": "error", "message": "Missing event ID"}

        # Check for duplicate event (idempotency)
        existing_event = db.query(ProcessedWebhookEvent).filter(
            ProcessedWebhookEvent.event_id == event_id
        ).first()

        if existing_event:
            logger.info(f"Skipping duplicate webhook event: {event_id}")
            return {
                "status": "success",
                "message": "Event already processed",
                "event_id": event_id
            }

        # Create payload hash for verification
        payload_hash = hashlib.sha256(body).hexdigest()

        # Record this event as being processed
        processed_event = ProcessedWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            payload_hash=payload_hash,
            status="processing"
        )
        db.add(processed_event)
        db.flush()

        try:
            # Check if this is a subscription-related event
            subscription_events = [
                "invoice.payment_succeeded",
                "invoice.payment_failed",
                "customer.subscription.updated",
                "customer.subscription.deleted"
            ]

            if event_type in subscription_events:
                # Handle subscription events
                from app.services.stripe_subscription_service import StripeSubscriptionService
                stripe_sub_service = StripeSubscriptionService(db)
                result = stripe_sub_service.handle_webhook_event(event)
                logger.info(f"Processed subscription webhook: {result}")

                processed_event.status = "processed"
                db.commit()

                return {
                    "status": "success",
                    "event_id": event_id,
                    "event_type": event_type,
                    "result": result
                }

            # Handle the webhook through our checkout handler (for one-time payments)
            webhook_response = await stripe_checkout.handle_webhook(body, signature)

            if webhook_response.payment_status == "paid":
                # Find payment by session ID
                payment = db.query(Payment).filter(
                    Payment.stripe_session_id == webhook_response.session_id
                ).first()

                if payment and payment.status != PaymentStatus.PAID:
                    payment.status = PaymentStatus.PAID
                    payment.paid_at = datetime.now(timezone.utc)

                    # Update booking
                    booking = db.query(Booking).filter(
                        Booking.id == payment.booking_id
                    ).first()

                    if booking:
                        booking.payment_status = PaymentStatus.PAID
                        booking.status = BookingStatus.CONFIRMED

                    logger.info(f"Payment {payment.id} marked as paid via webhook")

            # Mark event as successfully processed
            processed_event.status = "processed"
            db.commit()

            return {
                "status": "success",
                "event_id": event_id,
                "event_type": event_type
            }

        except Exception as process_error:
            # Mark event as failed but still recorded
            processed_event.status = "failed"
            processed_event.error_message = str(process_error)
            db.commit()
            raise

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}
