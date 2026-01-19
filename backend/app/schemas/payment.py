from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal
from enum import Enum


class PaymentMethod(str, Enum):
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    CRYPTO = "crypto"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class RefundStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ============ Payment Schemas ============

class PaymentCreateRequest(BaseModel):
    booking_id: int
    origin_url: str  # For Stripe success/cancel URLs


class PaymentCreateResponse(BaseModel):
    checkout_url: str
    session_id: str


class PaymentStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    booking_id: int
    stripe_session_id: Optional[str]
    stripe_payment_intent_id: Optional[str]
    amount: Decimal
    currency: str
    payment_method: PaymentMethod
    status: PaymentStatus
    card_last_four: Optional[str]
    card_brand: Optional[str]
    paid_at: Optional[datetime]
    created_at: datetime


class PaymentVerifyRequest(BaseModel):
    session_id: str


class PaymentVerifyResponse(BaseModel):
    status: str
    payment_status: str
    booking_id: Optional[int] = None
    amount: Optional[Decimal] = None


# ============ Refund Schemas ============

class RefundCreateRequest(BaseModel):
    payment_id: int
    amount: Optional[Decimal] = None  # None = full refund
    reason: Optional[str] = None


class RefundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    payment_id: int
    stripe_refund_id: Optional[str]
    amount: Decimal
    reason: Optional[str]
    status: RefundStatus
    created_at: datetime
    processed_at: Optional[datetime]


# ============ Invoice Schemas ============

class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    invoice_number: str
    booking_id: int
    customer_id: int
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    status: str
    issue_date: datetime
    due_date: Optional[datetime]
    paid_date: Optional[datetime]
    pdf_url: Optional[str]


# ============ Discount Code Schemas ============

class DiscountCodeBase(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = None
    discount_type: str  # "percentage" or "fixed"
    discount_value: Decimal = Field(..., gt=0)
    min_order_amount: Decimal = Decimal("0")
    max_discount_amount: Optional[Decimal] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: bool = True


class DiscountCodeCreate(DiscountCodeBase):
    applicable_service_ids: Optional[list[int]] = None


class DiscountCodeUpdate(BaseModel):
    description: Optional[str] = None
    discount_value: Optional[Decimal] = None
    min_order_amount: Optional[Decimal] = None
    max_discount_amount: Optional[Decimal] = None
    max_uses: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class DiscountCodeResponse(DiscountCodeBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    uses_count: int
    created_at: datetime


class DiscountCodeValidateRequest(BaseModel):
    code: str
    service_id: int
    subtotal: Decimal


class DiscountCodeValidateResponse(BaseModel):
    valid: bool
    discount_amount: Decimal = Decimal("0")
    error_message: Optional[str] = None
