"""
Cleaner Dashboard API (Employee System)

Endpoints for the cleaner mobile app.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import require_employee
from app.models.employee import Employee, EmployeeCleanerStatus
from app.models.booking import Booking, BookingStatus

router = APIRouter(prefix="/cleaner", tags=["Cleaner Dashboard"])


# Schemas
class StatusUpdate(BaseModel):
    status: str

class JobSummary(BaseModel):
    id: int
    booking_number: str
    status: str
    start_time: str
    end_time: str
    customer_name: str
    customer_phone: str
    address: str

class DashboardData(BaseModel):
    status: str
    jobs: List[JobSummary]


@router.get("/status")
async def get_cleaner_status(
    current_employee: Employee = Depends(require_employee),
    db: Session = Depends(get_db)
):
    """Get cleaner's current status."""
    return {"status": current_employee.cleaner_status.value}


@router.put("/status")
async def update_cleaner_status(
    update: StatusUpdate,
    current_employee: Employee = Depends(require_employee),
    db: Session = Depends(get_db)
):
    """Update cleaner's status (available/offline)."""
    try:
        new_status = EmployeeCleanerStatus(update.status.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status"
        )
    
    # Don't allow manual setting of busy/cooling_down? 
    # For MVP, allowing toggle between available/offline is fine.
    if new_status not in [EmployeeCleanerStatus.AVAILABLE, EmployeeCleanerStatus.OFFLINE]:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only switch between available and offline manually"
        )
        
    current_employee.cleaner_status = new_status
    db.commit()
    
    return {"status": current_employee.cleaner_status.value}


@router.get("/jobs/today")
async def get_today_jobs(
    current_employee: Employee = Depends(require_employee),
    db: Session = Depends(get_db)
):
    """Get jobs assigned to cleaner for today."""
    today = date.today()
    
    # In a real app, query by date range of scheduled_date
    # For now, just getting all assigned jobs for demo
    jobs = db.query(Booking).filter(
        Booking.assigned_employee_id == current_employee.id,
        Booking.status.in_([
            BookingStatus.ASSIGNED,
            BookingStatus.IN_PROGRESS, 
            BookingStatus.PAUSED,
            BookingStatus.COMPLETED
        ])
    ).all()
    
    # Filter for today in python if needed, or rely on query
    # Simple check:
    today_jobs = []
    for job in jobs:
        # Check if job is today (ignoring timezone complexity for MVP)
        if job.scheduled_date.date() == today:
             today_jobs.append(job)
             
    # Format response
    response_jobs = []
    for job in jobs: # Return all for now to see data
        # Get address string
        address_str = "Unknown Address"
        if job.address:
            address_str = f"{job.address.apartment_number or ''} {job.address.street_address}, {job.address.city}"
            
        # Get times
        start_time = job.scheduled_date.strftime("%H:%M")
        end_time = job.scheduled_end_time.strftime("%H:%M") if job.scheduled_end_time else "??:??"
        
        response_jobs.append(JobSummary(
            id=job.id,
            booking_number=job.booking_number,
            status=job.status.value,
            start_time=start_time,
            end_time=end_time,
            customer_name=job.customer.full_name if job.customer else "Unknown",
            customer_phone=job.customer.phone if job.customer else "",
            address=address_str
        ))
        
    return {"jobs": response_jobs}
