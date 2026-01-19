from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.booking import PaymentStatus
import enum


class PaymentMethod(str, enum.Enum):
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    CRYPTO = "crypto"


class RefundStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    
    # Stripe fields
    stripe_session_id = Column(String(255), unique=True, nullable=True, index=True)
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True, index=True)
    stripe_charge_id = Column(String(255), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    payment_method = Column(SQLEnum(PaymentMethod), default=PaymentMethod.CARD)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False, index=True)
    
    # Card details (last 4 digits for reference)
    card_last_four = Column(String(4), nullable=True)
    card_brand = Column(String(20), nullable=True)
    
    # Timestamps
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    booking = relationship("Booking", back_populates="payment")
    refunds = relationship("Refund", back_populates="payment")


class Refund(Base):
    __tablename__ = "refunds"
    
    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)
    
    stripe_refund_id = Column(String(255), unique=True, nullable=True)
    
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(SQLEnum(RefundStatus), default=RefundStatus.PENDING, nullable=False)
    
    initiated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    payment = relationship("Payment", back_populates="refunds")


class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(20), unique=True, nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Amounts
    subtotal = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), default=0)
    tax = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    
    # Status
    status = Column(String(20), default="draft")  # draft, sent, paid, overdue, cancelled
    
    # Dates
    issue_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)
    paid_date = Column(DateTime(timezone=True), nullable=True)
    
    # PDF
    pdf_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DiscountCode(Base):
    __tablename__ = "discount_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Discount type
    discount_type = Column(String(20), nullable=False)  # percentage, fixed
    discount_value = Column(Numeric(10, 2), nullable=False)
    
    # Constraints
    min_order_amount = Column(Numeric(10, 2), default=0)
    max_discount_amount = Column(Numeric(10, 2), nullable=True)
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, default=0)
    max_uses_per_user = Column(Integer, default=1)
    
    # Validity
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Service restrictions
    applicable_service_ids = Column(Text, nullable=True)  # JSON array or comma-separated
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
