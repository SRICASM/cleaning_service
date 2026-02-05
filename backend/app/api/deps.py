from fastapi import Depends, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models import User, UserRole, UserStatus
from app.models.employee import Employee, EmployeeAccountStatus
import uuid


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user (customer/admin) from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    
    if not payload:
        raise UnauthorizedException("Invalid or expired token")
    
    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type")
        
    # Check User Type
    user_type = payload.get("user_type")
    if user_type == "EMPLOYEE":
        raise UnauthorizedException("Use employee endpoints for employee tokens")
        
    try:
        user_id = int(payload.get("sub"))
    except (ValueError, TypeError):
        raise UnauthorizedException("Invalid user ID in token")
        
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise UnauthorizedException("User not found")
    
    if user.status != UserStatus.ACTIVE:
        raise ForbiddenException("User account is not active")
    
    return user


async def get_current_employee(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Employee:
    """Get current authenticated employee from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    
    if not payload:
        raise UnauthorizedException("Invalid or expired token")
    
    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type")
        
    if payload.get("user_type") != "EMPLOYEE":
        raise UnauthorizedException("Not an employee token")
    
    try:
        employee_id = uuid.UUID(payload.get("sub"))
    except (ValueError, TypeError):
        raise UnauthorizedException("Invalid employee ID in token")
        
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee:
        raise UnauthorizedException("Employee not found")
    
    if employee.account_status != EmployeeAccountStatus.ACTIVE:
        raise ForbiddenException("Employee account is not active")
    
    return employee


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, None otherwise."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        return await get_current_user(authorization, db)
    except UnauthorizedException:
        return None


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Admin access required")
    return current_user


async def get_cleaner_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require cleaner role (Legacy User model)."""
    if current_user.role not in [UserRole.CLEANER, UserRole.ADMIN]:
        raise ForbiddenException("Cleaner access required")
    return current_user


async def get_staff_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require admin or cleaner role."""
    if current_user.role not in [UserRole.ADMIN, UserRole.CLEANER]:
        raise ForbiddenException("Staff access required")
    return current_user


# Alias for consistency
get_current_admin_user = get_admin_user
require_admin = get_admin_user
require_cleaner = get_cleaner_user
require_employee = get_current_employee



