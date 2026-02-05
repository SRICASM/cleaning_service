"""
Employee Authentication API (Password-based)

Endpoints:
- POST /auth/employee/login - Login with phone & password
- POST /auth/employee/change-password - Change default password
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import uuid

from app.database import get_db
from app.models.employee import Employee, EmployeeAccountStatus, EmployeeRefreshToken
from app.core.security import verify_password, hash_password
from app.api.auth_otp import create_otp_access_token, create_otp_refresh_token, hash_token
from app.api.deps import require_employee

router = APIRouter(prefix="/auth/employee", tags=["Employee Authentication"])


class EmployeeLoginSchema(BaseModel):
    phone_number: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: dict

class ChangePasswordSchema(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


@router.post("/login", response_model=TokenResponse)
async def login(
    request: EmployeeLoginSchema,
    db: Session = Depends(get_db)
):
    """
    Login with phone number and password.
    """
    # Normalize phone
    phone = request.phone_number
    if not phone.startswith('+'):
        phone = f"+{phone.strip()}"
        
    employee = db.query(Employee).filter(Employee.phone_number == phone).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    if not employee.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password authentication not set up for this user. Use OTP."
        )
        
    if not verify_password(request.password, employee.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    if employee.account_status != EmployeeAccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
        
    # Update last login
    employee.last_login_at = datetime.now(timezone.utc)
    db.commit()
    
    # Generate tokens
    user_id = str(employee.id)
    access_token = create_otp_access_token(
        user_id=user_id,
        phone=employee.phone_number,
        user_type="EMPLOYEE"
    )
    
    refresh_token_str = create_otp_refresh_token(
        user_id=user_id,
        user_type="EMPLOYEE"
    )
    
    # Store refresh token
    token_record = EmployeeRefreshToken(
        user_id=employee.id,
        user_type="EMPLOYEE",
        token_hash=hash_token(refresh_token_str),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30)
    )
    db.add(token_record)
    db.commit()
    
    user_data = {
        "id": user_id,
        "phone_number": employee.phone_number,
        "email": employee.email,
        "user_type": "EMPLOYEE",
        "employee_id": employee.employee_id,
        "full_name": employee.full_name,
        "region_code": employee.region_code,
        "account_status": employee.account_status.value
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": user_data
    }


@router.get("/me")
async def get_current_employee_profile(
    current_employee: Employee = Depends(require_employee)
):
    """Get current employee profile."""
    return {
        "id": str(current_employee.id),
        "phone_number": current_employee.phone_number,
        "email": current_employee.email,
        "user_type": "EMPLOYEE",
        "employee_id": current_employee.employee_id,
        "full_name": current_employee.full_name,
        "region_code": current_employee.region_code,
        "account_status": current_employee.account_status.value
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordSchema,
    current_employee: Employee = Depends(require_employee),
    db: Session = Depends(get_db)
):
    """Change employee password."""
    if not verify_password(request.current_password, current_employee.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
        
    current_employee.hashed_password = hash_password(request.new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}
