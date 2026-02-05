from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.core.security import (
    hash_password, verify_password, 
    create_access_token, create_refresh_token,
    decode_token, generate_verification_token
)
from app.core.exceptions import (
    UserAlreadyExistsException, InvalidCredentialsException,
    UnauthorizedException, NotFoundException, BadRequestException
)
from app.models import User, RefreshToken, UserRole, UserStatus
from app.schemas import (
    UserRegister, UserLogin, TokenResponse, RefreshTokenRequest,
    PasswordResetRequest, PasswordResetConfirm, UserResponse
)
from app.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current authenticated user with addresses."""
    from app.models import Address
    
    # Fetch user's addresses
    addresses = db.query(Address).filter(
        Address.user_id == current_user.id
    ).order_by(Address.is_default.desc()).all()
    
    # Convert addresses to dict
    addresses_list = []
    default_address = None
    for addr in addresses:
        addr_dict = {
            "id": addr.id,
            "label": addr.label,
            "address": addr.street_address,
            "city": addr.city,
            "postal_code": addr.postal_code,
            "property_type": addr.property_type,
            "bedrooms": addr.bedrooms,
            "bathrooms": addr.bathrooms,
            "is_default": addr.is_default
        }
        addresses_list.append(addr_dict)
        if addr.is_default:
            default_address = addr_dict
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": f"{current_user.first_name} {current_user.last_name}".strip(),
        "phone": current_user.phone,
        "role": current_user.role.value,
        "user_type": "CUSTOMER",  # Regular users are customers
        "addresses": addresses_list,
        "default_address": default_address,
        "property_type": default_address.get("property_type") if default_address else None,
        "bedrooms": default_address.get("bedrooms") if default_address else 2,
        "bathrooms": default_address.get("bathrooms") if default_address else 1
    }


@router.post("/register")
async def register(
    data: UserRegister,
    db: Session = Depends(get_db)
):
    """Register a new user account."""
    # Check if email exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise UserAlreadyExistsException(data.email)
    
    # Parse name into first_name and last_name
    first_name = data.first_name
    last_name = data.last_name
    
    if data.name and not (first_name and last_name):
        # Split name into first and last
        name_parts = data.name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    if not first_name:
        first_name = "User"
    if not last_name:
        last_name = ""
    
    # Create user
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=first_name,
        last_name=last_name,
        phone=data.phone,
        role=UserRole.CUSTOMER,
        status=UserStatus.ACTIVE,
        email_verification_token=generate_verification_token()
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create address if provided
    if data.address and data.city and data.postal_code:
        from app.models import Address
        address = Address(
            user_id=user.id,
            label="Home",
            street_address=data.address,
            city=data.city,
            postal_code=data.postal_code,
            is_default=True
        )
        db.add(address)
        db.commit()
    
    # Create tokens
    access_token = create_access_token(user.id, user.email, user.role.value)
    refresh_token, expires_at = create_refresh_token(user.id)
    
    # Store refresh token
    token_record = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at
    )
    db.add(token_record)
    db.commit()
    
    # Return token and user data in format expected by frontend
    return {
        "token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "phone": user.phone,
            "role": user.role.value
        }
    }


@router.post("/login")
async def login(
    data: UserLogin,
    db: Session = Depends(get_db)
):
    """Login with email and password."""
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise InvalidCredentialsException()
    
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("Account is not active")
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    
    # Create tokens
    access_token = create_access_token(user.id, user.email, user.role.value)
    refresh_token, expires_at = create_refresh_token(user.id)
    
    # Store refresh token
    token_record = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at
    )
    db.add(token_record)
    db.commit()
    
    # Return token and user data in format expected by frontend
    return {
        "token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}",
            "phone": user.phone,
            "role": user.role.value
        }
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Get new access token using refresh token."""
    # Decode refresh token
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise UnauthorizedException("Invalid refresh token")
    
    user_id = int(payload.get("sub"))
    
    # Check if token exists and not revoked
    token_record = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None)
    ).first()
    
    if not token_record:
        raise UnauthorizedException("Refresh token not found or revoked")
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("User not found or inactive")
    
    # Revoke old refresh token
    token_record.revoked_at = datetime.now(timezone.utc)
    
    # Create new tokens
    access_token = create_access_token(user.id, user.email, user.role.value)
    new_refresh_token, expires_at = create_refresh_token(user.id)
    
    # Store new refresh token
    new_token_record = RefreshToken(
        user_id=user.id,
        token=new_refresh_token,
        expires_at=expires_at
    )
    db.add(new_token_record)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout")
async def logout(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Logout by revoking refresh token."""
    token_record = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token
    ).first()
    
    if token_record:
        token_record.revoked_at = datetime.now(timezone.utc)
        db.commit()
    
    return {"message": "Logged out successfully"}


@router.post("/password-reset/request")
async def request_password_reset(
    data: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request a password reset email."""
    user = db.query(User).filter(User.email == data.email).first()
    
    if user:
        # Generate reset token
        reset_token = generate_verification_token()
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        
        # TODO: Send email in background
        # background_tasks.add_task(send_password_reset_email, user.email, reset_token)
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using token."""
    user = db.query(User).filter(
        User.password_reset_token == data.token
    ).first()
    
    if not user:
        raise BadRequestException("Invalid or expired reset token")
    
    if user.password_reset_expires < datetime.now(timezone.utc):
        raise BadRequestException("Reset token has expired")
    
    # Update password
    user.password_hash = hash_password(data.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    
    # Revoke all refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": datetime.now(timezone.utc)})
    
    db.commit()
    
    return {"message": "Password has been reset successfully"}
