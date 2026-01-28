from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    CUSTOMER = "customer"
    CLEANER = "cleaner"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


# ============ Auth Schemas ============

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    # Accept either name (from frontend) or first_name/last_name
    name: Optional[str] = None  # Full name from frontend
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    # Address fields from frontend (stored separately after registration)
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


# ============ User Schemas ============

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.CUSTOMER


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    role: UserRole
    status: UserStatus
    email_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class UserListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    role: UserRole
    status: UserStatus
    created_at: datetime
    booking_count: int = 0


# ============ Address Schemas ============

class AddressBase(BaseModel):
    label: str = "Home"
    street_address: str = Field(..., min_length=5, max_length=255)
    apartment: Optional[str] = None
    city: str = Field(..., min_length=2, max_length=100)
    state: Optional[str] = None
    postal_code: str = Field(..., min_length=3, max_length=20)
    country: str = "USA"
    property_type: Optional[str] = None
    property_size_sqft: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    access_instructions: Optional[str] = None
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    street_address: Optional[str] = None
    apartment: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    property_type: Optional[str] = None
    property_size_sqft: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    access_instructions: Optional[str] = None
    is_default: Optional[bool] = None


class AddressResponse(AddressBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
