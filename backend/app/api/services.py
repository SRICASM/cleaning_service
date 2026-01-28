from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
import json
from app.database import get_db
from app.api.deps import get_current_user_optional, get_admin_user
from app.core.exceptions import NotFoundException
from app.models import ServiceCategory, Service, AddOn, User, DiscountCode
from app.schemas import (
    ServiceCategoryCreate, ServiceCategoryUpdate, ServiceCategoryResponse,
    ServiceCreate, ServiceUpdate, ServiceResponse, ServiceListResponse,
    AddOnCreate, AddOnUpdate, AddOnResponse,
    PriceCalculationRequest, PriceCalculationResponse,
    DiscountCodeValidateRequest, DiscountCodeValidateResponse
)
from datetime import datetime, timezone

router = APIRouter(prefix="/services", tags=["Services"])


# ============ Public: Service Discovery ============

@router.get("/categories", response_model=List[ServiceCategoryResponse])
async def list_categories(
    db: Session = Depends(get_db)
):
    """Get all active service categories."""
    categories = db.query(ServiceCategory).filter(
        ServiceCategory.is_active == True
    ).order_by(ServiceCategory.display_order).all()
    return categories


@router.get("/", response_model=List[ServiceListResponse])
async def list_services(
    category: Optional[str] = Query(None, description="Filter by category slug"),
    featured: Optional[bool] = Query(None, description="Filter featured services"),
    db: Session = Depends(get_db)
):
    """Get all active services with optional filters."""
    query = db.query(Service).filter(Service.is_active == True)
    
    if category:
        query = query.join(ServiceCategory).filter(
            ServiceCategory.slug == category
        )
    
    if featured is not None:
        query = query.filter(Service.is_featured == featured)
    
    services = query.order_by(Service.display_order).all()
    
    result = []
    for service in services:
        category_name = service.category.name if service.category else None
        result.append(ServiceListResponse(
            id=service.id,
            name=service.name,
            slug=service.slug,
            short_description=service.short_description,
            icon=service.icon,
            base_price=service.base_price,
            base_duration_hours=service.base_duration_hours,
            category_name=category_name,
            is_featured=service.is_featured
        ))
    
    return result


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: int,
    db: Session = Depends(get_db)
):
    """Get service details by ID."""
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.is_active == True
    ).first()
    
    if not service:
        raise NotFoundException("Service not found")
    
    # Parse features from JSON
    features = None
    if service.features:
        try:
            features = json.loads(service.features)
        except (json.JSONDecodeError, ValueError, TypeError):
            features = []
    
    return ServiceResponse(
        id=service.id,
        name=service.name,
        slug=service.slug,
        short_description=service.short_description,
        description=service.description,
        icon=service.icon,
        image_url=service.image_url,
        base_price=service.base_price,
        price_per_sqft=service.price_per_sqft,
        price_per_bedroom=service.price_per_bedroom,
        price_per_bathroom=service.price_per_bathroom,
        base_duration_hours=service.base_duration_hours,
        duration_per_sqft_hours=service.duration_per_sqft_hours,
        is_active=service.is_active,
        is_featured=service.is_featured,
        display_order=service.display_order,
        category_id=service.category_id,
        features=features,
        created_at=service.created_at,
        updated_at=service.updated_at
    )


# ============ Add-Ons ============

@router.get("/add-ons/", response_model=List[AddOnResponse])
async def list_add_ons(
    db: Session = Depends(get_db)
):
    """Get all active add-ons."""
    add_ons = db.query(AddOn).filter(
        AddOn.is_active == True
    ).order_by(AddOn.display_order).all()
    return add_ons


# ============ Price Calculation ============

@router.post("/calculate-price", response_model=PriceCalculationResponse)
async def calculate_price(
    data: PriceCalculationRequest,
    db: Session = Depends(get_db)
):
    """Calculate total price for a service configuration."""
    service = db.query(Service).filter(Service.id == data.service_id).first()
    if not service:
        raise NotFoundException("Service not found")
    
    # Base calculations
    base_price = Decimal(str(service.base_price))
    size_adjustment = Decimal(str(service.price_per_sqft)) * data.property_size_sqft
    bedroom_adjustment = Decimal(str(service.price_per_bedroom)) * data.bedrooms
    bathroom_adjustment = Decimal(str(service.price_per_bathroom)) * data.bathrooms
    
    # Add-ons
    add_ons_total = Decimal("0")
    if data.add_on_ids:
        add_ons = db.query(AddOn).filter(
            AddOn.id.in_(data.add_on_ids),
            AddOn.is_active == True
        ).all()
        for addon in add_ons:
            add_ons_total += Decimal(str(addon.price))
    
    subtotal = base_price + size_adjustment + bedroom_adjustment + bathroom_adjustment + add_ons_total
    
    # Discount
    discount_amount = Decimal("0")
    discount_code_applied = None
    
    if data.discount_code:
        discount = db.query(DiscountCode).filter(
            DiscountCode.code == data.discount_code.upper(),
            DiscountCode.is_active == True
        ).first()
        
        if discount and _is_discount_valid(discount, subtotal):
            if discount.discount_type == "percentage":
                discount_amount = subtotal * (Decimal(str(discount.discount_value)) / 100)
                if discount.max_discount_amount:
                    discount_amount = min(discount_amount, Decimal(str(discount.max_discount_amount)))
            else:
                discount_amount = Decimal(str(discount.discount_value))
            
            discount_code_applied = discount.code
    
    # Tax (example: 8.5%)
    tax_rate = Decimal("0.085")
    tax_amount = (subtotal - discount_amount) * tax_rate
    
    total = subtotal - discount_amount + tax_amount
    
    # Duration estimation
    base_duration = Decimal(str(service.base_duration_hours))
    sqft_duration = Decimal(str(service.duration_per_sqft_hours)) * data.property_size_sqft
    estimated_duration = base_duration + sqft_duration
    
    return PriceCalculationResponse(
        base_price=base_price.quantize(Decimal("0.01")),
        size_adjustment=size_adjustment.quantize(Decimal("0.01")),
        bedroom_adjustment=bedroom_adjustment.quantize(Decimal("0.01")),
        bathroom_adjustment=bathroom_adjustment.quantize(Decimal("0.01")),
        add_ons_total=add_ons_total.quantize(Decimal("0.01")),
        subtotal=subtotal.quantize(Decimal("0.01")),
        discount_amount=discount_amount.quantize(Decimal("0.01")),
        tax_amount=tax_amount.quantize(Decimal("0.01")),
        total=total.quantize(Decimal("0.01")),
        estimated_duration_hours=estimated_duration.quantize(Decimal("0.1")),
        discount_code_applied=discount_code_applied
    )


def _is_discount_valid(discount: DiscountCode, subtotal: Decimal) -> bool:
    """Check if discount code is valid."""
    now = datetime.now(timezone.utc)
    
    if discount.valid_from and now < discount.valid_from:
        return False
    if discount.valid_until and now > discount.valid_until:
        return False
    if discount.max_uses and discount.uses_count >= discount.max_uses:
        return False
    if subtotal < Decimal(str(discount.min_order_amount)):
        return False
    
    return True


@router.post("/validate-discount", response_model=DiscountCodeValidateResponse)
async def validate_discount_code(
    data: DiscountCodeValidateRequest,
    db: Session = Depends(get_db)
):
    """Validate a discount code."""
    discount = db.query(DiscountCode).filter(
        DiscountCode.code == data.code.upper(),
        DiscountCode.is_active == True
    ).first()
    
    if not discount:
        return DiscountCodeValidateResponse(
            valid=False,
            error_message="Invalid discount code"
        )
    
    if not _is_discount_valid(discount, data.subtotal):
        return DiscountCodeValidateResponse(
            valid=False,
            error_message="Discount code is not valid for this order"
        )
    
    # Calculate discount amount
    if discount.discount_type == "percentage":
        discount_amount = data.subtotal * (Decimal(str(discount.discount_value)) / 100)
        if discount.max_discount_amount:
            discount_amount = min(discount_amount, Decimal(str(discount.max_discount_amount)))
    else:
        discount_amount = Decimal(str(discount.discount_value))
    
    return DiscountCodeValidateResponse(
        valid=True,
        discount_amount=discount_amount.quantize(Decimal("0.01"))
    )


# ============ Admin: Service Management ============

@router.post("/categories", response_model=ServiceCategoryResponse)
async def create_category(
    data: ServiceCategoryCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Create a new service category."""
    category = ServiceCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=ServiceCategoryResponse)
async def update_category(
    category_id: int,
    data: ServiceCategoryUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Update a service category."""
    category = db.query(ServiceCategory).filter(
        ServiceCategory.id == category_id
    ).first()
    
    if not category:
        raise NotFoundException("Category not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    return category


@router.post("/", response_model=ServiceResponse)
async def create_service(
    data: ServiceCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Create a new service."""
    service_data = data.model_dump()
    
    # Convert features list to JSON string
    if service_data.get("features"):
        service_data["features"] = json.dumps(service_data["features"])
    
    service = Service(**service_data)
    db.add(service)
    db.commit()
    db.refresh(service)
    
    return await get_service(service.id, db)


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    data: ServiceUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Update a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    
    if not service:
        raise NotFoundException("Service not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Convert features list to JSON string
    if "features" in update_data and update_data["features"]:
        update_data["features"] = json.dumps(update_data["features"])
    
    for field, value in update_data.items():
        setattr(service, field, value)
    
    db.commit()
    db.refresh(service)
    
    return await get_service(service.id, db)


@router.delete("/{service_id}")
async def delete_service(
    service_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Soft delete a service (set inactive)."""
    service = db.query(Service).filter(Service.id == service_id).first()
    
    if not service:
        raise NotFoundException("Service not found")
    
    service.is_active = False
    db.commit()
    
    return {"message": "Service deactivated"}


# Admin: Add-on Management
@router.post("/add-ons/", response_model=AddOnResponse)
async def create_add_on(
    data: AddOnCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Create a new add-on."""
    addon = AddOn(**data.model_dump())
    db.add(addon)
    db.commit()
    db.refresh(addon)
    return addon


@router.put("/add-ons/{addon_id}", response_model=AddOnResponse)
async def update_add_on(
    addon_id: int,
    data: AddOnUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: Update an add-on."""
    addon = db.query(AddOn).filter(AddOn.id == addon_id).first()
    
    if not addon:
        raise NotFoundException("Add-on not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(addon, field, value)
    
    db.commit()
    db.refresh(addon)
    return addon
