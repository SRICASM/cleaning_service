from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cleaner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Ratings (1-5 scale)
    overall_rating = Column(Integer, nullable=False)
    cleanliness_rating = Column(Integer, nullable=True)
    punctuality_rating = Column(Integer, nullable=True)
    communication_rating = Column(Integer, nullable=True)
    value_rating = Column(Integer, nullable=True)
    
    # Review content
    title = Column(String(200), nullable=True)
    comment = Column(Text, nullable=True)
    
    # Response from company
    response = Column(Text, nullable=True)
    response_at = Column(DateTime(timezone=True), nullable=True)
    response_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Moderation
    is_verified = Column(Boolean, default=False)
    is_published = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Constraints
    __table_args__ = (
        CheckConstraint('overall_rating >= 1 AND overall_rating <= 5', name='check_overall_rating'),
        CheckConstraint('cleanliness_rating IS NULL OR (cleanliness_rating >= 1 AND cleanliness_rating <= 5)', name='check_cleanliness_rating'),
        CheckConstraint('punctuality_rating IS NULL OR (punctuality_rating >= 1 AND punctuality_rating <= 5)', name='check_punctuality_rating'),
        CheckConstraint('communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)', name='check_communication_rating'),
        CheckConstraint('value_rating IS NULL OR (value_rating >= 1 AND value_rating <= 5)', name='check_value_rating'),
    )
    
    # Relationships
    booking = relationship("Booking", back_populates="review")
    customer = relationship("User", back_populates="reviews", foreign_keys=[customer_id])


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Contact info
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    
    # Message
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # Status
    status = Column(String(20), default="new")  # new, read, replied, closed
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Reply
    reply = Column(Text, nullable=True)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    replied_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AuditLog(Base):
    """Track all important actions for compliance and debugging."""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # user, booking, payment, etc.
    entity_id = Column(Integer, nullable=True)
    
    # Request info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Change details
    old_values = Column(Text, nullable=True)  # JSON
    new_values = Column(Text, nullable=True)  # JSON
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    type = Column(String(50), nullable=False)  # booking_confirmed, reminder, review_request, etc.
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # Related entity
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    
    # Delivery
    channel = Column(String(20), default="in_app")  # in_app, email, sms, push
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Email/SMS tracking
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
