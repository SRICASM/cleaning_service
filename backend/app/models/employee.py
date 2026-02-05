"""
Employee Model

Represents cleaners/employees in the system with:
- Unique employee ID (CLN-DXB-2501-00042 format)
- Phone-based authentication
- Regional assignment
- Status tracking
"""
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, DECIMAL, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum

from app.database import Base


class RegionCode(str, enum.Enum):
    """UAE region codes for employee assignment."""
    DXB = "DXB"  # Dubai
    AUH = "AUH"  # Abu Dhabi
    SHJ = "SHJ"  # Sharjah
    AJM = "AJM"  # Ajman
    RAK = "RAK"  # Ras Al Khaimah
    FUJ = "FUJ"  # Fujairah
    UAQ = "UAQ"  # Umm Al Quwain


class EmployeeAccountStatus(str, enum.Enum):
    """Employee account status."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class EmployeeCleanerStatus(str, enum.Enum):
    """Cleaner availability status."""
    AVAILABLE = "available"
    BUSY = "busy"
    COOLING_DOWN = "cooling_down"
    OFFLINE = "offline"


class Employee(Base):
    """
    Employee/Cleaner model.
    
    Separate from User table to allow:
    - Different authentication flow (OTP-based)
    - Employee-specific fields
    - Clean separation of concerns
    """
    __tablename__ = "employees"
    
    # Primary key - UUID for security
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Human-readable employee ID: CLN-DXB-2501-00042
    employee_id = Column(String(20), unique=True, nullable=False, index=True)
    
    # Authentication fields
    phone_number = Column(String(15), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=True)
    
    # Basic info
    full_name = Column(String(100), nullable=False)
    
    # Regional assignment
    region_code = Column(String(5), nullable=False, index=True)
    
    # Account status
    account_status = Column(
        SQLEnum(EmployeeAccountStatus),
        default=EmployeeAccountStatus.ACTIVE,
        nullable=False
    )
    
    # Cleaner operational status
    cleaner_status = Column(
        SQLEnum(EmployeeCleanerStatus),
        default=EmployeeCleanerStatus.OFFLINE,
        nullable=False
    )
    
    # Performance metrics
    rating = Column(DECIMAL(2, 1), default=5.0)
    total_jobs_completed = Column(Integer, default=0)
    total_jobs_failed = Column(Integer, default=0)
    
    # Cleaner profile link (optional, for detailed profile)
    # profile_id = Column(Integer, ForeignKey("cleaner_profiles.id"), nullable=True)
    
    # Admin tracking
    created_by = Column(UUID(as_uuid=True), nullable=True)  # Admin who created
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.full_name}>"
    
    @property
    def can_login(self) -> bool:
        """Check if employee can login."""
        return self.account_status == EmployeeAccountStatus.ACTIVE
    
    @property
    def is_available(self) -> bool:
        """Check if employee is available for jobs."""
        return (
            self.account_status == EmployeeAccountStatus.ACTIVE and
            self.cleaner_status == EmployeeCleanerStatus.AVAILABLE
        )


class OTPRequest(Base):
    """
    OTP request tracking for audit and rate limiting.
    """
    __tablename__ = "otp_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number = Column(String(15), nullable=False, index=True)
    user_type = Column(String(20), nullable=False)  # EMPLOYEE, CUSTOMER
    
    # OTP storage (hashed for security)
    otp_hash = Column(String(255), nullable=False)
    
    # Attempt tracking
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    # Status
    verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<OTPRequest {self.phone_number} - {'verified' if self.verified else 'pending'}>"


class EmployeeRefreshToken(Base):
    """
    Refresh token storage for employee authentication.
    """
    __tablename__ = "employee_refresh_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User reference
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_type = Column(String(20), nullable=False)  # EMPLOYEE, CUSTOMER
    
    # Token storage (hashed)
    token_hash = Column(String(255), nullable=False, index=True)
    
    # Validity
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Revocation
    revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    device_info = Column(Text, nullable=True)  # Optional device fingerprint
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<RefreshToken {self.user_id} - {'revoked' if self.revoked else 'active'}>"


class EmployeeIDSequence(Base):
    """
    Counter table for employee ID generation.
    Used as fallback when Redis is not available.
    """
    __tablename__ = "employee_id_sequences"
    
    id = Column(Integer, primary_key=True)
    region_code = Column(String(5), nullable=False)
    year_month = Column(String(4), nullable=False)  # YYMM format
    sequence = Column(Integer, default=0)
    
    # Composite unique constraint
    __table_args__ = (
        # Unique per region per month
        {'postgresql_partition_by': None},  # Placeholder, will add constraint in migration
    )
    
    def __repr__(self):
        return f"<Sequence {self.region_code}-{self.year_month}: {self.sequence}>"
