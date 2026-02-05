"""
Wallet and Referral Models
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum
import uuid


class TransactionType(str, enum.Enum):
    """Types of wallet transactions."""
    CREDIT = "credit"           # Money added to wallet
    DEBIT = "debit"             # Money used from wallet
    CASHBACK = "cashback"       # Cashback from bookings
    REFERRAL = "referral"       # Referral bonus
    REFUND = "refund"           # Refund from cancelled booking
    PROMO = "promo"             # Promotional credit
    TOPUP = "topup"             # Manual top-up
    WITHDRAWAL = "withdrawal"   # Withdrawal (future)


class TransactionStatus(str, enum.Enum):
    """Status of wallet transactions."""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class ReferralStatus(str, enum.Enum):
    """Status of referrals."""
    PENDING = "pending"         # Referred user registered but hasn't booked
    COMPLETED = "completed"     # Referred user completed first booking and rewards given
    EXPIRED = "expired"         # Referral expired (30 days)


class Wallet(Base):
    """User wallet for storing credits and managing transactions."""
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Balance
    balance = Column(Numeric(10, 2), default=0.00, nullable=False)
    currency = Column(String(3), default="AED", nullable=False)

    # Lifetime stats
    total_credits = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_debits = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_cashback = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_referral_earnings = Column(Numeric(10, 2), default=0.00, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="wallet")
    transactions = relationship("WalletTransaction", back_populates="wallet", order_by="desc(WalletTransaction.created_at)")


class WalletTransaction(Base):
    """Individual wallet transactions."""
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Transaction details
    transaction_id = Column(String(36), unique=True, nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    type = Column(SQLEnum(TransactionType), nullable=False)
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.COMPLETED, nullable=False)

    # Amount
    amount = Column(Numeric(10, 2), nullable=False)
    balance_before = Column(Numeric(10, 2), nullable=False)
    balance_after = Column(Numeric(10, 2), nullable=False)

    # Description and reference
    description = Column(String(255), nullable=False)
    reference_type = Column(String(50), nullable=True)  # 'booking', 'referral', 'promo', etc.
    reference_id = Column(String(100), nullable=True)   # ID of related entity

    # Extra data
    extra_data = Column(Text, nullable=True)  # JSON string for extra data

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    wallet = relationship("Wallet", back_populates="transactions")


class Referral(Base):
    """Referral tracking."""
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)

    # Referrer (existing user who shared code)
    referrer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Referred user (new user who used code)
    referred_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Referral code used
    referral_code = Column(String(20), nullable=False, index=True)
    referral_code_id = Column(Integer, ForeignKey("referral_codes.id", ondelete="SET NULL"), nullable=True)

    # Status and rewards
    status = Column(SQLEnum(ReferralStatus), default=ReferralStatus.PENDING, nullable=False)
    referrer_reward = Column(Numeric(10, 2), default=50.00, nullable=False)  # AED 50 default
    referred_bonus = Column(Numeric(10, 2), default=25.00, nullable=False)  # AED 25 default

    # Tracking
    referred_email = Column(String(255), nullable=True)  # Track before user registers
    first_booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    registered_at = Column(DateTime(timezone=True), nullable=True)  # When referred user registered
    completed_at = Column(DateTime(timezone=True), nullable=True)   # When first booking completed and rewarded
    expires_at = Column(DateTime(timezone=True), nullable=True)     # Expiry date (30 days from creation)

    # Relationships
    referrer = relationship("User", foreign_keys=[referrer_id], backref="referrals_made")
    referred = relationship("User", foreign_keys=[referred_id], backref="referred_by")


class ReferralCode(Base):
    """User's referral codes."""
    __tablename__ = "referral_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Code
    code = Column(String(20), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Usage stats
    usage_count = Column(Integer, default=0, nullable=False)
    total_rewards_earned = Column(Numeric(10, 2), default=0.00, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", backref="referral_codes")


class Promotion(Base):
    """Promotional codes and offers."""
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)

    # Code and details
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Type: percentage, fixed, cashback, wallet_credit
    type = Column(String(20), nullable=False)
    value = Column(Numeric(10, 2), nullable=False)  # Percentage or fixed amount

    # Conditions
    min_order_amount = Column(Numeric(10, 2), default=0.00, nullable=False)
    max_discount = Column(Numeric(10, 2), nullable=True)  # Cap for percentage discounts
    applicable_services = Column(Text, nullable=True)  # JSON array of service IDs

    # Limits
    usage_limit = Column(Integer, nullable=True)  # Total uses allowed
    per_user_limit = Column(Integer, default=1, nullable=False)  # Uses per user
    current_usage = Column(Integer, default=0, nullable=False)

    # Validity
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # New user only flag
    new_users_only = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PromotionUsage(Base):
    """Track promotion code usage."""
    __tablename__ = "promotion_usages"

    id = Column(Integer, primary_key=True, index=True)
    promotion_id = Column(Integer, ForeignKey("promotions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)

    # Discount applied
    discount_amount = Column(Numeric(10, 2), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    promotion = relationship("Promotion", backref="usages")
    user = relationship("User", backref="promotion_usages")
