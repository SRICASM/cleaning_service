from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ServiceCategory(Base):
    __tablename__ = "service_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    services = relationship("Service", back_populates="category")


class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=False)
    
    # Basic info
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    short_description = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    image_url = Column(String(500), nullable=True)
    
    # Pricing
    base_price = Column(Numeric(10, 2), nullable=False)
    price_per_sqft = Column(Numeric(10, 4), default=0)
    price_per_bedroom = Column(Numeric(10, 2), default=0)
    price_per_bathroom = Column(Numeric(10, 2), default=0)
    
    # Duration
    base_duration_hours = Column(Numeric(4, 2), nullable=False)
    duration_per_sqft_hours = Column(Numeric(6, 4), default=0)
    
    # Features (stored as JSON-like text, or use JSONB in PostgreSQL)
    features = Column(Text, nullable=True)  # JSON array of feature strings
    
    # Status
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    category = relationship("ServiceCategory", back_populates="services")
    bookings = relationship("Booking", back_populates="service")


class AddOn(Base):
    __tablename__ = "add_ons"
    
    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    duration_hours = Column(Numeric(4, 2), default=0)
    icon = Column(String(50), nullable=True)
    
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Association table for booking add-ons
booking_add_ons = Table(
    'booking_add_ons',
    Base.metadata,
    Column('booking_id', Integer, ForeignKey('bookings.id', ondelete='CASCADE'), primary_key=True),
    Column('add_on_id', Integer, ForeignKey('add_ons.id', ondelete='CASCADE'), primary_key=True),
    Column('price_at_booking', Numeric(10, 2), nullable=False),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)
