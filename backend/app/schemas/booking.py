from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from enum import Enum


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    NO_SHOW = "no_show"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


# ============ Booking Schemas ============

class BookingCreate(BaseModel):
    service_id: int
    address_id: int
    scheduled_date: datetime
    property_size_sqft: int = Field(..., ge=100, le=50000)
    bedrooms: int = Field(default=0, ge=0)
    bathrooms: int = Field(default=1, ge=1)
    add_on_ids: List[int] = []
    customer_notes: Optional[str] = None
    discount_code: Optional[str] = None


class BookingUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    customer_notes: Optional[str] = None
    internal_notes: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    reason: Optional[str] = None


class BookingAssignCleaner(BaseModel):
    cleaner_id: int


class BookingReschedule(BaseModel):
    new_date: datetime
    reason: Optional[str] = None


class BookingCancel(BaseModel):
    reason: Optional[str] = None
    request_refund: bool = False


# ============ Response Schemas ============

class AddressInBooking(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    label: str
    street_address: str
    apartment: Optional[str]
    city: str
    state: Optional[str]
    postal_code: str


class ServiceInBooking(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    icon: Optional[str]


class CustomerInBooking(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]


class CleanerInBooking(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    first_name: str
    last_name: str
    phone: Optional[str]


class AddOnInBooking(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    price: Decimal


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    booking_number: str
    
    # Relationships
    customer: CustomerInBooking
    cleaner: Optional[CleanerInBooking] = None
    service: ServiceInBooking
    address: AddressInBooking
    add_ons: List[AddOnInBooking] = []
    
    # Schedule
    scheduled_date: datetime
    scheduled_end_time: Optional[datetime]
    actual_start_time: Optional[datetime]
    actual_end_time: Optional[datetime]
    
    # Property
    property_size_sqft: int
    bedrooms: int
    bathrooms: int
    
    # Pricing
    base_price: Decimal
    size_adjustment: Decimal
    add_ons_total: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_price: Decimal
    discount_code: Optional[str]
    
    # Status
    status: BookingStatus
    payment_status: PaymentStatus
    
    # Notes
    customer_notes: Optional[str]
    internal_notes: Optional[str]
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]


class BookingListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)
    
    id: int
    booking_number: str
    customer_name: str
    customer_email: str
    service_name: str
    city: str
    scheduled_date: str  # Formatted date string
    scheduled_time: str  # Formatted time string
    status: str  # String value of enum
    payment_status: str  # String value of enum
    total_price: Decimal
    created_at: datetime


# ============ Time Slot Schemas ============

class TimeSlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool
    max_bookings: int


class AvailableSlot(BaseModel):
    date: str  # YYYY-MM-DD
    time_slots: List[str]  # ["08:00", "09:00", ...]


class AvailabilityRequest(BaseModel):
    service_id: int
    property_size_sqft: int
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD


class AvailabilityResponse(BaseModel):
    available_slots: List[AvailableSlot]
