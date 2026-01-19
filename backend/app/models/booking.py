from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.service import booking_add_ons
import enum


class BookingStatus(str, enum.Enum):
    PENDING = "pending"              # Created, awaiting payment
    CONFIRMED = "confirmed"          # Paid, scheduled
    ASSIGNED = "assigned"            # Cleaner assigned
    IN_PROGRESS = "in_progress"      # Cleaning started
    COMPLETED = "completed"          # Cleaning finished
    CANCELLED = "cancelled"          # Cancelled by user or admin
    REFUNDED = "refunded"            # Payment refunded
    NO_SHOW = "no_show"              # Customer not available


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
    
    # Foreign keys
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cleaner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    address_id = Column(Integer, ForeignKey("addresses.id"), nullable=False)
    
    # Scheduling
    scheduled_date = Column(DateTime(timezone=True), nullable=False, index=True)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=True)
    actual_start_time = Column(DateTime(timezone=True), nullable=True)
    actual_end_time = Column(DateTime(timezone=True), nullable=True)
    
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
    
    # Status
    status = Column(SQLEnum(BookingStatus), default=BookingStatus.PENDING, nullable=False, index=True)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False, index=True)
    
    # Notes
    customer_notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    cleaner_notes = Column(Text, nullable=True)
    
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
