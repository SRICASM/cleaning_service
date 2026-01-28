from fastapi import Depends, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models import User, UserRole, UserStatus


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    
    if not payload:
        raise UnauthorizedException("Invalid or expired token")
    
    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type")
    
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise UnauthorizedException("User not found")
    
    if user.status != UserStatus.ACTIVE:
        raise ForbiddenException("User account is not active")
    
    return user


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
    """Require cleaner role."""
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
