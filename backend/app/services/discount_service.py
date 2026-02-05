"""
Discount Code Service

Handles validation and application of discount codes.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple
from sqlalchemy.orm import Session
import json

from app.models.payment import DiscountCode
from app.models.booking import Booking


class DiscountValidationError(Exception):
    """Raised when a discount code cannot be applied."""
    pass


class DiscountService:
    """Service for validating and applying discount codes."""

    def __init__(self, db: Session):
        self.db = db

    def validate_code(
        self,
        code: str,
        user_id: int,
        service_id: int,
        subtotal: Decimal
    ) -> Tuple[DiscountCode, Decimal]:
        """
        Validate a discount code and calculate the discount amount.

        Args:
            code: The discount code string
            user_id: The customer's user ID
            service_id: The service being booked
            subtotal: The order subtotal (before discount)

        Returns:
            Tuple of (DiscountCode object, discount amount)

        Raises:
            DiscountValidationError: If the code is invalid or cannot be applied
        """
        # Find the discount code
        discount = self.db.query(DiscountCode).filter(
            DiscountCode.code == code.upper().strip(),
            DiscountCode.is_active == True
        ).first()

        if not discount:
            raise DiscountValidationError("Invalid discount code")

        now = datetime.now(timezone.utc)

        # Check validity period
        if discount.valid_from and discount.valid_from > now:
            raise DiscountValidationError("This discount code is not yet active")

        if discount.valid_until and discount.valid_until < now:
            raise DiscountValidationError("This discount code has expired")

        # Check max uses
        if discount.max_uses and discount.uses_count >= discount.max_uses:
            raise DiscountValidationError("This discount code has reached its usage limit")

        # Check per-user limit
        if discount.max_uses_per_user:
            user_uses = self.db.query(Booking).filter(
                Booking.customer_id == user_id,
                Booking.discount_code == code.upper().strip(),
                Booking.status != 'cancelled'
            ).count()

            if user_uses >= discount.max_uses_per_user:
                raise DiscountValidationError(
                    f"You have already used this discount code {user_uses} time(s)"
                )

        # Check minimum order amount
        if discount.min_order_amount and subtotal < discount.min_order_amount:
            raise DiscountValidationError(
                f"Minimum order amount of ${discount.min_order_amount} required for this code"
            )

        # Check service applicability
        if discount.applicable_service_ids:
            try:
                # Try parsing as JSON array
                applicable_ids = json.loads(discount.applicable_service_ids)
            except json.JSONDecodeError:
                # Fall back to comma-separated
                applicable_ids = [
                    int(x.strip()) for x in discount.applicable_service_ids.split(',')
                    if x.strip().isdigit()
                ]

            if service_id not in applicable_ids:
                raise DiscountValidationError(
                    "This discount code is not applicable to the selected service"
                )

        # Calculate discount amount
        discount_amount = self._calculate_discount(discount, subtotal)

        return discount, discount_amount

    def _calculate_discount(self, discount: DiscountCode, subtotal: Decimal) -> Decimal:
        """Calculate the discount amount based on type and constraints."""
        if discount.discount_type == 'percentage':
            amount = (subtotal * Decimal(discount.discount_value)) / Decimal(100)
        elif discount.discount_type == 'fixed':
            amount = Decimal(discount.discount_value)
        else:
            amount = Decimal(0)

        # Apply max discount cap
        if discount.max_discount_amount and amount > discount.max_discount_amount:
            amount = Decimal(discount.max_discount_amount)

        # Ensure discount doesn't exceed subtotal
        if amount > subtotal:
            amount = subtotal

        return amount.quantize(Decimal('0.01'))

    def apply_code(self, discount: DiscountCode) -> None:
        """
        Increment the usage count for a discount code.
        Call this after a booking is successfully created.
        """
        discount.uses_count = (discount.uses_count or 0) + 1
        self.db.add(discount)
        # Don't commit here - let the caller handle the transaction

    def get_code_info(self, code: str) -> Optional[dict]:
        """Get discount code information for display."""
        discount = self.db.query(DiscountCode).filter(
            DiscountCode.code == code.upper().strip(),
            DiscountCode.is_active == True
        ).first()

        if not discount:
            return None

        now = datetime.now(timezone.utc)
        is_valid = True
        status_message = "Valid"

        if discount.valid_from and discount.valid_from > now:
            is_valid = False
            status_message = "Not yet active"
        elif discount.valid_until and discount.valid_until < now:
            is_valid = False
            status_message = "Expired"
        elif discount.max_uses and discount.uses_count >= discount.max_uses:
            is_valid = False
            status_message = "Usage limit reached"

        return {
            "code": discount.code,
            "description": discount.description,
            "discount_type": discount.discount_type,
            "discount_value": float(discount.discount_value),
            "min_order_amount": float(discount.min_order_amount) if discount.min_order_amount else None,
            "max_discount_amount": float(discount.max_discount_amount) if discount.max_discount_amount else None,
            "valid_until": discount.valid_until.isoformat() if discount.valid_until else None,
            "is_valid": is_valid,
            "status_message": status_message
        }
