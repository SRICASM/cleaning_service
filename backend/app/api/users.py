from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.api.deps import get_current_user, get_admin_user
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.models import User, Address, Booking, UserRole, UserStatus
from app.schemas import (
    UserResponse, UserUpdate, UserListResponse,
    AddressCreate, AddressUpdate, AddressResponse
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user's profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile."""
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/profile")
async def update_user_profile_with_property(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile including property details (for setup flow)."""
    # Update user fields if provided
    if "first_name" in data:
        current_user.first_name = data["first_name"]
    if "last_name" in data:
        current_user.last_name = data["last_name"]
    if "phone" in data:
        current_user.phone = data["phone"]
    
    # Update default address with property details
    property_type = data.get("property_type")
    bedrooms = data.get("bedrooms")
    bathrooms = data.get("bathrooms")
    
    if property_type or bedrooms is not None or bathrooms is not None:
        # Find or create default address
        default_address = db.query(Address).filter(
            Address.user_id == current_user.id,
            Address.is_default == True
        ).first()
        
        if default_address:
            if property_type:
                default_address.property_type = property_type
            if bedrooms is not None:
                default_address.bedrooms = bedrooms
            if bathrooms is not None:
                default_address.bathrooms = bathrooms
        else:
            # Create a placeholder address with property info
            default_address = Address(
                user_id=current_user.id,
                label="Home",
                street_address="Please update your address",
                city="Unknown",
                postal_code="00000",
                property_type=property_type,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                is_default=True
            )
            db.add(default_address)
    
    db.commit()
    db.refresh(current_user)
    
    # Return user in format frontend expects
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": f"{current_user.first_name} {current_user.last_name}".strip(),
        "phone": current_user.phone,
        "role": current_user.role.value
    }


# ============ Addresses ============

@router.get("/me/addresses", response_model=List[AddressResponse])
async def get_my_addresses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's addresses."""
    addresses = db.query(Address).filter(
        Address.user_id == current_user.id
    ).order_by(Address.is_default.desc(), Address.created_at.desc()).all()
    return addresses


@router.post("/me/addresses", response_model=AddressResponse)
async def create_address(
    data: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new address for current user."""
    # If this is the first address or marked as default, handle defaults
    if data.is_default:
        db.query(Address).filter(
            Address.user_id == current_user.id
        ).update({"is_default": False})
    
    address = Address(
        user_id=current_user.id,
        **data.model_dump()
    )
    
    # If first address, make it default
    existing_count = db.query(Address).filter(
        Address.user_id == current_user.id
    ).count()
    if existing_count == 0:
        address.is_default = True
    
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.put("/me/addresses/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: int,
    data: AddressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an address."""
    address = db.query(Address).filter(
        Address.id == address_id,
        Address.user_id == current_user.id
    ).first()
    
    if not address:
        raise NotFoundException("Address not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle default flag
    if update_data.get("is_default"):
        db.query(Address).filter(
            Address.user_id == current_user.id,
            Address.id != address_id
        ).update({"is_default": False})
    
    for field, value in update_data.items():
        setattr(address, field, value)
    
    db.commit()
    db.refresh(address)
    return address


@router.delete("/me/addresses/{address_id}")
async def delete_address(
    address_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an address."""
    address = db.query(Address).filter(
        Address.id == address_id,
        Address.user_id == current_user.id
    ).first()
    
    if not address:
        raise NotFoundException("Address not found")
    
    # Check if address is used in pending bookings
    pending_bookings = db.query(Booking).filter(
        Booking.address_id == address_id,
        Booking.status.in_(["pending", "confirmed", "assigned"])
    ).count()
    
    if pending_bookings > 0:
        raise ForbiddenException("Cannot delete address with pending bookings")
    
    was_default = address.is_default
    db.delete(address)
    
    # If deleted default, make another address default
    if was_default:
        next_address = db.query(Address).filter(
            Address.user_id == current_user.id
        ).first()
        if next_address:
            next_address.is_default = True
    
    db.commit()
    return {"message": "Address deleted"}


# ============ Admin: User Management ============

@router.get("/admin/customers")
async def list_customers(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: List all customers with booking counts."""
    query = db.query(User).filter(User.role == UserRole.CUSTOMER)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) |
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term))
        )
    
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    
    # Get booking counts and format response
    result = []
    for user in users:
        booking_count = db.query(Booking).filter(
            Booking.customer_id == user.id
        ).count()
        
        result.append({
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "phone": user.phone,
            "booking_count": booking_count,
            "created_at": user.created_at
        })
    
    return result

@router.get("/", response_model=List[UserListResponse])
async def list_users(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: List all users with filters."""
    query = db.query(User)

    if role:
        try:
            role_enum = UserRole(role)
            query = query.filter(User.role == role_enum)
        except ValueError:
            pass  # Invalid role, skip filter
    if status:
        try:
            status_enum = UserStatus(status)
            query = query.filter(User.status == status_enum)
        except ValueError:
            pass  # Invalid status, skip filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) |
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term))
        )
    
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    
    # Get booking counts
    result = []
    for user in users:
        booking_count = db.query(Booking).filter(
            Booking.customer_id == user.id
        ).count()
        
        user_data = UserListResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            role=user.role,
            status=user.status,
            created_at=user.created_at,
            booking_count=booking_count
        )
        result.append(user_data)
    
    return result


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Get user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")
    return user


@router.put("/{user_id}/status")
async def update_user_status(
    user_id: int,
    status: str,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Update user status (active, inactive, suspended)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    try:
        status_enum = UserStatus(status)
    except ValueError:
        raise BadRequestException("Invalid status. Must be 'active', 'inactive', or 'suspended'")

    user.status = status_enum
    db.commit()

    return {"message": f"User status updated to {status}"}


@router.put("/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Update user role."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    try:
        role_enum = UserRole(role)
    except ValueError:
        raise BadRequestException("Invalid role. Must be 'customer', 'cleaner', or 'admin'")

    user.role = role_enum
    db.commit()

    return {"message": f"User role updated to {role}"}
