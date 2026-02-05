from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.service import booking_add_ons
import enum


class BookingType(str, enum.Enum):
    """Types of bookings supported by the platform."""
    INSTANT = "instant"        # Immediate service
    SINGLE = "single"          # Scheduled one-time
    MULTIPLE = "multiple"      # Scheduled multiple dates
    CUSTOM = "custom"          # Recurring custom pattern


class BookingStatus(str, enum.Enum):
    """Job lifecycle states for the state machine."""
    PENDING = "pending"                        # Created, awaiting payment
    PENDING_ASSIGNMENT = "pending_assignment"  # Paid, awaiting cleaner assignment
    CONFIRMED = "confirmed"                    # Paid, scheduled (legacy - maps to pending_assignment)
    ASSIGNED = "assigned"                      # Cleaner assigned, awaiting start
    IN_PROGRESS = "in_progress"                # Cleaning started by cleaner
    PAUSED = "paused"                          # Temporarily paused by cleaner
    COMPLETED = "completed"                    # Cleaning finished, confirmed by cleaner
    CANCELLED = "cancelled"                    # Cancelled by user, admin, or system
    FAILED = "failed"                          # Job failed, needs reassignment
    REFUNDED = "refunded"                      # Payment refunded
    NO_SHOW = "no_show"                        # Customer not available


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_number = Column(String(20), unique=True, nullable=False, index=True)
    
    # Booking Type & Pattern
    booking_type = Column(SQLEnum(BookingType), default=BookingType.SINGLE, nullable=False, index=True)
    recurrence_pattern = Column(JSON, nullable=True)  # { "days": ["mon", "wed"], "end_date": "2024-12-31" }

    # Optimistic locking
    version = Column(Integer, default=1, nullable=False)
    
    # Foreign keys
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cleaner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Legacy
    assigned_employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    address_id = Column(Integer, ForeignKey("addresses.id"), nullable=False)
    
    # Scheduling
    scheduled_date = Column(DateTime(timezone=True), nullable=False, index=True)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=True)
    sla_deadline = Column(DateTime(timezone=True), nullable=True)  # When job must start by
    
    # Job lifecycle timestamps
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    actual_start_time = Column(DateTime(timezone=True), nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    resumed_at = Column(DateTime(timezone=True), nullable=True)
    actual_end_time = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    failure_reason = Column(Text, nullable=True)
    
    # Property details at booking time (snapshot)
    property_size_sqft = Column(Integer, nullable=False)
    bedrooms = Column(Integer, default=0)
    bathrooms = Column(Integer, default=1)
    
    # Pricing (locked at booking time)
    base_price = Column(Numeric(10, 2), nullable=False)
    size_adjustment = Column(Numeric(10, 2), default=0)
    add_ons_total = Column(Numeric(10, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    tax_amount = Column(Numeric(10, 2), default=0)
    total_price = Column(Numeric(10, 2), nullable=False)
    
    # Discount code used
    discount_code = Column(String(50), nullable=True)

    # Dynamic pricing (captured at booking time)
    demand_multiplier = Column(Numeric(4, 2), default=1.00)  # e.g., 1.05 for 5% surge
    rush_premium = Column(Numeric(4, 2), default=1.00)  # e.g., 1.25 for same-day
    utilization_at_booking = Column(Numeric(5, 2), nullable=True)  # e.g., 0.75 for 75%
    pricing_tier = Column(String(20), nullable=True)  # standard, moderate, high, peak
    rush_tier = Column(String(20), nullable=True)  # same_day, next_day, short_notice, standard

    # Status
    status = Column(SQLEnum(BookingStatus), default=BookingStatus.PENDING, nullable=False, index=True)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False, index=True)
    
    # Notes
    customer_notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    cleaner_notes = Column(Text, nullable=True)
    
    # Subscription booking
    is_subscription_booking = Column(Boolean, default=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True, index=True)

    # Cancellation
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    customer = relationship("User", back_populates="bookings", foreign_keys=[customer_id])
    cleaner = relationship("User", back_populates="assigned_bookings", foreign_keys=[cleaner_id])
    assigned_employee = relationship("Employee", backref="bookings")
    service = relationship("Service", back_populates="bookings")
    address = relationship("Address", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False)
    review = relationship("Review", back_populates="booking", uselist=False)
    add_ons = relationship("AddOn", secondary=booking_add_ons, backref="bookings")


class BookingStatusHistory(Base):
    """Track all status changes for audit purposes."""
    __tablename__ = "booking_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    
    previous_status = Column(SQLEnum(BookingStatus), nullable=True)
    new_status = Column(SQLEnum(BookingStatus), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TimeSlot(Base):
    """Available time slots for bookings."""
    __tablename__ = "time_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(String(5), nullable=False)  # "08:00"
    end_time = Column(String(5), nullable=False)    # "09:00"
    
    is_active = Column(Boolean, default=True)
    max_bookings = Column(Integer, default=3)  # Max concurrent bookings
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
