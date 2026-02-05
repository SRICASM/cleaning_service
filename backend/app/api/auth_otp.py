"""
OTP Authentication API

Phone-based authentication for employees and customers.

Endpoints:
- POST /auth/otp/request - Request OTP
- POST /auth/otp/verify - Verify OTP and get tokens
- POST /auth/otp/resend - Resend OTP
- POST /auth/otp/refresh - Refresh access token
- POST /auth/otp/logout - Logout
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import re
import jwt
import secrets

from app.database import get_db
from app.models.employee import (
    Employee, EmployeeAccountStatus,
    EmployeeRefreshToken
)
from app.models import User, UserStatus
from app.services.otp_service import (
    OTPService, OTPError, RateLimitExceeded, 
    OTPExpired, OTPInvalid, MaxAttemptsExceeded, CooldownActive
)
from app.services.sms_service import sms_service
from app.core.security import decode_token
from app.config import settings

router = APIRouter(prefix="/auth/otp", tags=["OTP Authentication"])


# Custom token functions for OTP auth
def create_otp_access_token(
    user_id: str,
    phone: str,
    user_type: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token for OTP auth."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=1)
    
    payload = {
        "sub": user_id,
        "phone": phone,
        "user_type": user_type,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def create_otp_refresh_token(user_id: str, user_type: str) -> str:
    """Create refresh token for OTP auth."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    payload = {
        "sub": user_id,
        "user_type": user_type,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": secrets.token_urlsafe(32)
    }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


# Request/Response Schemas
class OTPRequestSchema(BaseModel):
    """Request OTP schema."""
    phone_number: str = Field(..., example="+971501234567")
    user_type: str = Field(..., example="EMPLOYEE")  # EMPLOYEE or CUSTOMER
    
    @validator('phone_number')
    def validate_phone(cls, v):
        # UAE phone format: +971XXXXXXXXX
        pattern = r'^\+971[0-9]{9}$'
        if not re.match(pattern, v):
            raise ValueError('Invalid UAE phone number. Format: +971XXXXXXXXX')
        return v
    
    @validator('user_type')
    def validate_user_type(cls, v):
        if v.upper() not in ['EMPLOYEE', 'CUSTOMER']:
            raise ValueError('user_type must be EMPLOYEE or CUSTOMER')
        return v.upper()


class OTPRequestResponse(BaseModel):
    """Response for OTP request."""
    message: str
    otp_id: str
    expires_at: str
    can_resend_after: str


class OTPVerifySchema(BaseModel):
    """Verify OTP schema."""
    phone_number: str
    otp: str = Field(..., min_length=6, max_length=6)
    otp_id: str
    user_type: str
    
    @validator('otp')
    def validate_otp(cls, v):
        if not v.isdigit():
            raise ValueError('OTP must be numeric')
        return v


class OTPVerifyResponse(BaseModel):
    """Response for OTP verification."""
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: dict


class OTPResendSchema(BaseModel):
    """Resend OTP schema."""
    phone_number: str
    otp_id: str
    user_type: str


class RefreshTokenSchema(BaseModel):
    """Refresh token schema."""
    refresh_token: str


class LogoutSchema(BaseModel):
    """Logout schema."""
    refresh_token: str


# Helper functions
def hash_token(token: str) -> str:
    """Hash a token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


async def get_employee_by_phone(db: Session, phone_number: str) -> Optional[Employee]:
    """Get employee by phone number."""
    return db.query(Employee).filter(
        Employee.phone_number == phone_number
    ).first()


async def get_or_create_customer(db: Session, phone_number: str) -> User:
    """Get customer by phone or create new one."""
    customer = db.query(User).filter(
        User.phone == phone_number
    ).first()
    
    if not customer:
        # Auto-create customer on first login attempt
        customer = User(
            phone=phone_number,
            email=f"{phone_number.replace('+', '')}@temp.user",  # Temp email
            full_name="",  # Will be updated later
            password_hash="OTP_AUTH",  # Marker for OTP-only auth
            status=UserStatus.ACTIVE
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    
    return customer


# Endpoints
@router.post("/request", response_model=OTPRequestResponse)
async def request_otp(
    request: OTPRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Request OTP for phone-based login.
    
    - Validates phone exists (for employees) or auto-creates (for customers)
    - Sends OTP via SMS
    - Returns otp_id for verification
    """
    phone = request.phone_number
    user_type = request.user_type
    
    # Validate user exists
    if user_type == "EMPLOYEE":
        employee = await get_employee_by_phone(db, phone)
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Phone number not registered. Contact admin."
            )
        
        if employee.account_status == EmployeeAccountStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is suspended. Contact admin."
            )
        
        if employee.account_status == EmployeeAccountStatus.TERMINATED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is no longer active. Contact admin."
            )
    
    elif user_type == "CUSTOMER":
        # Customers can be auto-created
        await get_or_create_customer(db, phone)
    
    # Generate and send OTP
    otp_service = OTPService(db)
    
    try:
        result = await otp_service.request_otp(phone, user_type)
        
        # Send SMS
        otp = result.pop("otp")  # Remove OTP from response
        await sms_service.send_otp(phone, otp)
        
        return OTPRequestResponse(
            message="OTP sent successfully",
            otp_id=result["otp_id"],
            expires_at=result["expires_at"],
            can_resend_after=result["can_resend_after"]
        )
        
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except CooldownActive as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMS service unavailable. Please try again."
        )


@router.post("/verify", response_model=OTPVerifyResponse)
async def verify_otp(
    request: OTPVerifySchema,
    db: Session = Depends(get_db)
):
    """
    Verify OTP and issue JWT tokens.
    
    - Validates OTP
    - Issues access token (1 hour) and refresh token (30 days)
    - Returns user profile
    """
    otp_service = OTPService(db)
    
    try:
        # Verify OTP
        await otp_service.verify_otp(
            request.phone_number,
            request.otp,
            request.otp_id,
            request.user_type
        )
    except OTPExpired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )
    except OTPInvalid as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except MaxAttemptsExceeded:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum attempts exceeded. Please request a new OTP."
        )
    
    # Get user details
    if request.user_type == "EMPLOYEE":
        employee = await get_employee_by_phone(db, request.phone_number)
        
        # Update last login
        employee.last_login_at = datetime.now(timezone.utc)
        db.commit()
        
        user_data = {
            "id": str(employee.id),
            "phone_number": employee.phone_number,
            "user_type": "EMPLOYEE",
            "employee_id": employee.employee_id,
            "full_name": employee.full_name,
            "region_code": employee.region_code,
            "account_status": employee.account_status.value
        }
        user_id = str(employee.id)
        
    else:  # CUSTOMER
        customer = await get_or_create_customer(db, request.phone_number)
        
        # Update last login
        customer.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        user_data = {
            "id": str(customer.id),
            "phone_number": customer.phone,
            "user_type": "CUSTOMER",
            "full_name": customer.full_name or "",
            "email": customer.email if not customer.email.endswith("@temp.user") else "",
            "account_status": customer.status.value
        }
        user_id = str(customer.id)
    
    # Generate tokens using OTP-specific functions
    access_token = create_otp_access_token(
        user_id=user_id,
        phone=request.phone_number,
        user_type=request.user_type
    )
    
    refresh_token_str = create_otp_refresh_token(
        user_id=user_id,
        user_type=request.user_type
    )
    
    # Store refresh token
    token_record = EmployeeRefreshToken(
        user_id=uuid.UUID(user_id) if request.user_type == "EMPLOYEE" else uuid.uuid4(),
        user_type=request.user_type,
        token_hash=hash_token(refresh_token_str),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30)
    )
    db.add(token_record)
    db.commit()
    
    return OTPVerifyResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="Bearer",
        expires_in=3600,  # 1 hour
        user=user_data
    )


@router.post("/resend", response_model=OTPRequestResponse)
async def resend_otp(
    request: OTPResendSchema,
    db: Session = Depends(get_db)
):
    """
    Resend OTP (after cooldown period).
    
    Invalidates the previous OTP and sends a new one.
    """
    otp_service = OTPService(db)
    
    try:
        result = await otp_service.resend_otp(
            request.phone_number,
            request.otp_id,
            request.user_type
        )
        
        # Send SMS
        otp = result.pop("otp")
        await sms_service.send_otp(request.phone_number, otp)
        
        return OTPRequestResponse(
            message="OTP resent successfully",
            otp_id=result["otp_id"],
            expires_at=result["expires_at"],
            can_resend_after=result["can_resend_after"]
        )
        
    except CooldownActive as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )


@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenSchema,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    """
    # Decode refresh token
    payload = decode_token(request.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Verify token exists and not revoked
    token_hash = hash_token(request.refresh_token)
    token_record = db.query(EmployeeRefreshToken).filter(
        EmployeeRefreshToken.token_hash == token_hash,
        EmployeeRefreshToken.revoked == False
    ).first()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked"
        )
    
    # Check expiry
    if datetime.now(timezone.utc) > token_record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    
    # Generate new access token
    new_access_token = create_otp_access_token(
        user_id=payload["sub"],
        phone=payload.get("phone", ""),
        user_type=payload.get("user_type", "EMPLOYEE")
    )
    
    return {
        "access_token": new_access_token,
        "token_type": "Bearer",
        "expires_in": 3600
    }


@router.post("/logout")
async def logout(
    request: LogoutSchema,
    db: Session = Depends(get_db)
):
    """
    Logout and revoke refresh token.
    """
    token_hash = hash_token(request.refresh_token)
    
    token_record = db.query(EmployeeRefreshToken).filter(
        EmployeeRefreshToken.token_hash == token_hash
    ).first()
    
    if token_record:
        token_record.revoked = True
        token_record.revoked_at = datetime.now(timezone.utc)
        db.commit()
    
    return {"message": "Logged out successfully"}
