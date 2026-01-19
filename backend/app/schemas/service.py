from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ============ Category Schemas ============

class ServiceCategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class ServiceCategoryResponse(ServiceCategoryBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime


# ============ Service Schemas ============

class ServiceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100)
    short_description: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    base_price: Decimal = Field(..., ge=0)
    price_per_sqft: Decimal = Field(default=Decimal("0"))
    price_per_bedroom: Decimal = Field(default=Decimal("0"))
    price_per_bathroom: Decimal = Field(default=Decimal("0"))
    base_duration_hours: Decimal = Field(..., gt=0)
    duration_per_sqft_hours: Decimal = Field(default=Decimal("0"))
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0


class ServiceCreate(ServiceBase):
    category_id: int
    features: Optional[List[str]] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    base_price: Optional[Decimal] = None
    price_per_sqft: Optional[Decimal] = None
    price_per_bedroom: Optional[Decimal] = None
    price_per_bathroom: Optional[Decimal] = None
    base_duration_hours: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = None
    features: Optional[List[str]] = None


class ServiceResponse(ServiceBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    category_id: int
    features: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime


class ServiceListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    slug: str
    short_description: Optional[str]
    icon: Optional[str]
    base_price: Decimal
    base_duration_hours: Decimal
    category_name: Optional[str] = None
    is_featured: bool


# ============ Add-On Schemas ============

class AddOnBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0)
    duration_hours: Decimal = Field(default=Decimal("0"))
    icon: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class AddOnCreate(AddOnBase):
    pass


class AddOnUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    duration_hours: Optional[Decimal] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class AddOnResponse(AddOnBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime


# ============ Price Calculation ============

class PriceCalculationRequest(BaseModel):
    service_id: int
    property_size_sqft: int = Field(..., ge=100, le=50000)
    bedrooms: int = Field(default=0, ge=0)
    bathrooms: int = Field(default=1, ge=1)
    add_on_ids: List[int] = []
    discount_code: Optional[str] = None


class PriceCalculationResponse(BaseModel):
    base_price: Decimal
    size_adjustment: Decimal
    bedroom_adjustment: Decimal
    bathroom_adjustment: Decimal
    add_ons_total: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    estimated_duration_hours: Decimal
    discount_code_applied: Optional[str] = None
