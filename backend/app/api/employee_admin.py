"""
Employee Admin API

Admin endpoints for managing employees/cleaners.

Endpoints:
- POST /admin/employees - Create employee
- GET /admin/employees - List employees
- GET /admin/employees/{id} - Get employee details
- PUT /admin/employees/{id} - Update employee
- DELETE /admin/employees/{id} - Terminate employee
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

from app.database import get_db
from app.models.employee import (
    Employee, EmployeeAccountStatus, EmployeeCleanerStatus,
    EmployeeRefreshToken, RegionCode
)
from app.models import User, UserRole
from app.services.employee_id_generator import generate_employee_id, EmployeeIDGenerator
from app.services.sms_service import sms_service
from app.api.deps import require_admin
from app.core.security import hash_password
from fastapi import BackgroundTasks
from app.services.cleaner_assignment import assign_backlog_to_cleaner

router = APIRouter(prefix="/admin/employees", tags=["Employee Management"])


# Schemas
class CreateEmployeeRequest(BaseModel):
    """Request to create new employee."""
    phone_number: str = Field(..., example="+971501234567")
    full_name: str = Field(..., min_length=2, max_length=100, example="Ahmed Hassan Ali")
    email: Optional[str] = Field(None, example="employee@example.com")
    region_code: str = Field(..., example="DXB")
    
    @validator('phone_number')
    def validate_phone(cls, v):
        pattern = r'^\+971[0-9]{9}$'
        if not re.match(pattern, v):
            raise ValueError('Invalid UAE phone number. Format: +971XXXXXXXXX')
        return v
    
    @validator('region_code')
    def validate_region(cls, v):
        valid_regions = [r.value for r in RegionCode]
        if v.upper() not in valid_regions:
            raise ValueError(f'Invalid region. Must be one of: {", ".join(valid_regions)}')
        return v.upper()
    
    @validator('full_name')
    def validate_name(cls, v):
        # Only alphabets and spaces
        if not re.match(r'^[a-zA-Z\s]+$', v):
            raise ValueError('Full name must contain only letters and spaces')
        return v.strip()


class UpdateEmployeeRequest(BaseModel):
    """Request to update employee."""
    full_name: Optional[str] = None
    region_code: Optional[str] = None
    account_status: Optional[str] = None
    
    @validator('region_code')
    def validate_region(cls, v):
        if v is None:
            return v
        valid_regions = [r.value for r in RegionCode]
        if v.upper() not in valid_regions:
            raise ValueError(f'Invalid region. Must be one of: {", ".join(valid_regions)}')
        return v.upper()
    
    @validator('account_status')
    def validate_status(cls, v):
        if v is None:
            return v
        valid = [s.value for s in EmployeeAccountStatus]
        if v.lower() not in valid:
            raise ValueError(f'Invalid status. Must be one of: {", ".join(valid)}')
        return v.lower()


class EmployeeResponse(BaseModel):
    """Employee response schema."""
    id: str
    employee_id: str
    phone_number: str
    full_name: str
    region_code: str
    account_status: str
    cleaner_status: str
    rating: float
    total_jobs_completed: int
    total_jobs_failed: int
    created_at: str
    last_login_at: Optional[str]
    login_enabled: bool
    
    class Config:
        from_attributes = True


class EmployeeListResponse(BaseModel):
    """Paginated employee list response."""
    employees: List[EmployeeResponse]
    total: int
    page: int
    total_pages: int
    limit: int


def employee_to_response(emp: Employee) -> EmployeeResponse:
    """Convert Employee model to response."""
    return EmployeeResponse(
        id=str(emp.id),
        employee_id=emp.employee_id,
        phone_number=emp.phone_number,
        full_name=emp.full_name,
        region_code=emp.region_code,
        account_status=emp.account_status.value,
        cleaner_status=emp.cleaner_status.value,
        rating=float(emp.rating) if emp.rating else 5.0,
        total_jobs_completed=emp.total_jobs_completed or 0,
        total_jobs_failed=emp.total_jobs_failed or 0,
        created_at=emp.created_at.isoformat() if emp.created_at else "",
        last_login_at=emp.last_login_at.isoformat() if emp.last_login_at else None,
        login_enabled=emp.can_login
    )


# Endpoints
@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    request: CreateEmployeeRequest,
    background_tasks: BackgroundTasks,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new employee profile.
    
    - Generates unique ID (CLN-REGION-YYMM-SEQUENCE)
    - Sets default password (cleaner123)
    - Sends welcome SMS with credentials
    """
    # Check phone uniqueness
    existing = db.query(Employee).filter(
        Employee.phone_number == request.phone_number
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee with this phone number already exists"
        )
    
    # Check if email exists
    if request.email:
        existing_email = db.query(Employee).filter(Employee.email == request.email).first()
        if existing_email:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered."
            )

    # Generate employee ID
    try:
        employee_id = generate_employee_id(db, request.region_code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate employee ID: {str(e)}"
        )
    
    # Set default password
    default_password = "cleaner123"
    hashed = hash_password(default_password)
    
    # Create employee
    # Note: created_by is UUID type but User.id is integer, so we skip it for now
    # In production, you might want to create a UUID column or reference
    employee = Employee(
        employee_id=employee_id,
        phone_number=request.phone_number,
        email=request.email or None,  # Convert empty string to None for unique constraint
        full_name=request.full_name,
        region_code=request.region_code,
        account_status=EmployeeAccountStatus.ACTIVE,
        cleaner_status=EmployeeCleanerStatus.OFFLINE,
        hashed_password=hashed,
        created_by=None  # Admin tracking deferred - User table uses integers
    )
    
    db.add(employee)
    db.commit()
    db.refresh(employee)
    
    # Trigger auto-assignment of backlog jobs in background
    def run_backlog_assignment(emp_id: str):
        # Create new session for background task
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            # Re-fetch employee in new session
            emp = bg_db.query(Employee).filter(Employee.id == emp_id).first()
            if emp:
                count = assign_backlog_to_cleaner(emp, bg_db)
                if count > 0:
                    print(f"Auto-assigned {count} backlog jobs to new employee {emp.full_name}")
        except Exception as e:
            print(f"Error in backlog assignment: {e}")
        finally:
            bg_db.close()
            
    background_tasks.add_task(run_backlog_assignment, str(employee.id))
    
    # Send Welcome SMS with Credentials
    try:
        message = (
            f"Welcome to our team! Your Employee ID is {employee_id}. "
            f"Login with your phone number and password: {default_password}"
        )
        await sms_service.send_sms(employee.phone_number, message)
    except Exception as e:
        # Log error but don't fail request
        print(f"Failed to send welcome SMS: {e}")
        
    return employee_to_response(employee)


@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    region_code: Optional[str] = Query(None, description="Filter by region"),
    status: Optional[str] = Query(None, description="Filter by account status"),
    search: Optional[str] = Query(None, description="Search by name or phone"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    List all employees with pagination and filters.
    """
    query = db.query(Employee)
    
    # Apply filters
    if region_code:
        query = query.filter(Employee.region_code == region_code.upper())
    
    if status:
        try:
            status_enum = EmployeeAccountStatus(status.lower())
            query = query.filter(Employee.account_status == status_enum)
        except ValueError:
            pass
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Employee.full_name.ilike(search_term),
                Employee.phone_number.ilike(search_term),
                Employee.employee_id.ilike(search_term)
            )
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * limit
    employees = query.order_by(Employee.created_at.desc()).offset(offset).limit(limit).all()
    
    # Calculate total pages
    total_pages = (total + limit - 1) // limit
    
    return EmployeeListResponse(
        employees=[employee_to_response(e) for e in employees],
        total=total,
        page=page,
        total_pages=total_pages,
        limit=limit
    )


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get employee details by employee_id (CLN-DXB-2501-00042 format).
    """
    # Try to find by employee_id first
    employee = db.query(Employee).filter(
        Employee.employee_id == employee_id
    ).first()
    
    # If not found, try by UUID
    if not employee:
        try:
            uuid_id = uuid.UUID(employee_id)
            employee = db.query(Employee).filter(Employee.id == uuid_id).first()
        except ValueError:
            pass
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    return employee_to_response(employee)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    request: UpdateEmployeeRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update employee details.
    
    - Can update name, region, status
    - Changing status to SUSPENDED/TERMINATED disables login
    """
    # Find employee
    employee = db.query(Employee).filter(
        Employee.employee_id == employee_id
    ).first()
    
    if not employee:
        try:
            uuid_id = uuid.UUID(employee_id)
            employee = db.query(Employee).filter(Employee.id == uuid_id).first()
        except ValueError:
            pass
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    old_status = employee.account_status
    
    # Update fields
    if request.full_name:
        employee.full_name = request.full_name
    
    if request.region_code:
        employee.region_code = request.region_code
    
    if request.account_status:
        employee.account_status = EmployeeAccountStatus(request.account_status)
        
        # If suspending/terminating, revoke all tokens
        new_status = EmployeeAccountStatus(request.account_status)
        if new_status != EmployeeAccountStatus.ACTIVE:
            db.query(EmployeeRefreshToken).filter(
                EmployeeRefreshToken.user_id == employee.id,
                EmployeeRefreshToken.revoked == False
            ).update({
                EmployeeRefreshToken.revoked: True,
                EmployeeRefreshToken.revoked_at: datetime.now(timezone.utc)
            })
            
            # Also set cleaner status to offline
            employee.cleaner_status = EmployeeCleanerStatus.OFFLINE
            
            # Send notification
            await sms_service.send_account_suspended(employee.phone_number)
        
        elif old_status != EmployeeAccountStatus.ACTIVE:
            # Reactivating
            await sms_service.send_account_reactivated(employee.phone_number)
    
    employee.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(employee)
    
    return employee_to_response(employee)


@router.delete("/{employee_id}")
async def terminate_employee(
    employee_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Terminate an employee (soft delete).
    
    - Sets status to TERMINATED
    - Revokes all tokens
    - Sends notification
    """
    # Find employee
    employee = db.query(Employee).filter(
        Employee.employee_id == employee_id
    ).first()
    
    if not employee:
        try:
            uuid_id = uuid.UUID(employee_id)
            employee = db.query(Employee).filter(Employee.id == uuid_id).first()
        except ValueError:
            pass
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Terminate
    employee.account_status = EmployeeAccountStatus.TERMINATED
    employee.cleaner_status = EmployeeCleanerStatus.OFFLINE
    employee.updated_at = datetime.now(timezone.utc)
    
    # Revoke all tokens
    db.query(EmployeeRefreshToken).filter(
        EmployeeRefreshToken.user_id == employee.id,
        EmployeeRefreshToken.revoked == False
    ).update({
        EmployeeRefreshToken.revoked: True,
        EmployeeRefreshToken.revoked_at: datetime.now(timezone.utc)
    })
    
    db.commit()
    
    return {"message": f"Employee {employee.employee_id} terminated successfully"}


@router.get("/{employee_id}/preview-next-id")
async def preview_next_employee_id(
    region_code: str = Query(..., description="Region code"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Preview what the next employee ID would be for a region.
    """
    generator = EmployeeIDGenerator(db)
    next_id = generator.peek_next_id(region_code.upper())
    
    return {"next_employee_id": next_id}
