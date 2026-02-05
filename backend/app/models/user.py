from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    CLEANER = "cleaner"
    ADMIN = "admin"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Profile
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Role and status
    role = Column(SQLEnum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    status = Column(SQLEnum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    
    # Email verification
    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(100), nullable=True)
    
    # Password reset
    password_reset_token = Column(String(100), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)

    # Stripe integration
    stripe_customer_id = Column(String(100), nullable=True, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="customer", foreign_keys="Booking.customer_id")
    assigned_bookings = relationship("Booking", back_populates="cleaner", foreign_keys="Booking.cleaner_id")
    reviews = relationship("Review", back_populates="customer", foreign_keys="Review.customer_id")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    cleaner_profile = relationship("CleanerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Address(Base):
    __tablename__ = "addresses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Address details
    label = Column(String(50), default="Home")  # Home, Office, etc.
    street_address = Column(String(255), nullable=False)
    apartment = Column(String(50), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), default="USA")
    
    # Property details
    property_type = Column(String(50), nullable=True)  # apartment, house, office, commercial
    property_size_sqft = Column(Integer, nullable=True)
    bedrooms = Column(Integer, nullable=True)
    bathrooms = Column(Integer, nullable=True)
    
    # Flags
    is_default = Column(Boolean, default=False)
    
    # Access instructions
    access_instructions = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="addresses")
    bookings = relationship("Booking", back_populates="address")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="refresh_tokens")
