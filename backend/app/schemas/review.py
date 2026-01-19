from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


# ============ Review Schemas ============

class ReviewCreate(BaseModel):
    booking_id: int
    overall_rating: int = Field(..., ge=1, le=5)
    cleanliness_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    value_rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    comment: Optional[str] = None


class ReviewUpdate(BaseModel):
    overall_rating: Optional[int] = Field(None, ge=1, le=5)
    cleanliness_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    value_rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = None
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    booking_id: int
    customer_id: int
    customer_name: str
    
    overall_rating: int
    cleanliness_rating: Optional[int]
    punctuality_rating: Optional[int]
    communication_rating: Optional[int]
    value_rating: Optional[int]
    
    title: Optional[str]
    comment: Optional[str]
    
    response: Optional[str]
    response_at: Optional[datetime]
    
    is_verified: bool
    is_published: bool
    
    created_at: datetime


class ReviewResponseAdd(BaseModel):
    """Admin response to a review."""
    response: str = Field(..., min_length=10)


class ReviewStats(BaseModel):
    total_reviews: int
    average_rating: float
    rating_distribution: dict  # {1: count, 2: count, ...}
    average_cleanliness: Optional[float]
    average_punctuality: Optional[float]
    average_communication: Optional[float]
    average_value: Optional[float]


# ============ Contact Message Schemas ============

class ContactMessageCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    subject: str = Field(..., min_length=5, max_length=200)
    message: str = Field(..., min_length=10)


class ContactMessageUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to_id: Optional[int] = None


class ContactMessageReply(BaseModel):
    reply: str = Field(..., min_length=10)


class ContactMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    email: str
    phone: Optional[str]
    subject: str
    message: str
    status: str
    assigned_to_id: Optional[int]
    reply: Optional[str]
    replied_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# ============ Notification Schemas ============

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    type: str
    title: str
    message: str
    entity_type: Optional[str]
    entity_id: Optional[int]
    channel: str
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime


class NotificationMarkRead(BaseModel):
    notification_ids: list[int]
