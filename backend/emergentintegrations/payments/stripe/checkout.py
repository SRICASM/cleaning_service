"""
Mock Stripe Checkout module - replaces the proprietary emergentintegrations package.
Uses the official stripe library directly.
"""

import stripe
from pydantic import BaseModel
from typing import Optional, Dict, Any


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str = "usd"
    success_url: str
    cancel_url: str
    metadata: Optional[Dict[str, Any]] = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str
    session_id: str


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str = None):
        self.api_key = api_key
        self.webhook_url = webhook_url
        stripe.api_key = api_key

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        """Create a Stripe checkout session."""
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": request.currency,
                    "product_data": {
                        "name": "Cleaning Service Booking",
                    },
                    "unit_amount": int(request.amount * 100),  # Convert to cents
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata=request.metadata or {},
        )
        return CheckoutSessionResponse(session_id=session.id, url=session.url)

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        """Get the status of a checkout session."""
        session = stripe.checkout.Session.retrieve(session_id)
        return CheckoutStatusResponse(
            status=session.status,
            payment_status=session.payment_status,
            session_id=session_id
        )

    async def handle_webhook(self, payload: bytes, signature: str):
        """Handle Stripe webhook events."""
        # For local development, we'll skip signature verification
        import json
        event = json.loads(payload)
        
        if event.get("type") == "checkout.session.completed":
            session = event["data"]["object"]
            return CheckoutStatusResponse(
                status="complete",
                payment_status="paid",
                session_id=session.get("id", "")
            )
        
        return CheckoutStatusResponse(
            status="unknown",
            payment_status="unpaid",
            session_id=""
        )
