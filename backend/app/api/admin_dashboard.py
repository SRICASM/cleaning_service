"""
Admin Dashboard APIs

Enhanced endpoints for admin dashboard v2:
- Cleaner status overview
- Delayed jobs alerts
- Real-time stats
- Manual job assignment
- Cursor-based pagination
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_admin_user
from app.models import (
    User, Booking, BookingStatus, BookingStatusHistory,
    CleanerProfile, CleanerStatus, UserRole
)
from app.models.employee import Employee, EmployeeAccountStatus, EmployeeCleanerStatus
from uuid import UUID
from app.services.job_state_machine import JobStateMachine
from app.services.events import event_publisher, EventType
from app.services.cache import cache_service
from app.core.exceptions import NotFoundException, BadRequestException


router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# ============ Response Schemas ============

class CleanerStatusDTO(BaseModel):
    """Cleaner status information."""
    id: int
    user_id: int
    name: str
    status: str
    active_job_count: int
    cooldown_expires_at: Optional[str] = None
    total_jobs_completed: int
    total_jobs_failed: int
    average_rating: Optional[str] = None
    last_active_at: Optional[str] = None


class DelayedJobDTO(BaseModel):
    """Delayed job information."""
    id: int
    booking_number: str
    status: str
    scheduled_date: str
    sla_deadline: Optional[str] = None
    delay_minutes: int
    cleaner_name: Optional[str] = None
    customer_name: str
    city: str


class JobListItem(BaseModel):
    """Job item for list view."""
    id: int
    booking_number: str
    customer_name: str
    customer_email: str
    cleaner_name: Optional[str] = None
    service_name: str
    city: str
    scheduled_date: str
    status: str
    payment_status: str
    total_price: float
    version: int
    created_at: str
    add_ons: List[str] = []


class PaginatedJobsResponse(BaseModel):
    """Paginated response with cursor."""
    jobs: List[JobListItem]
    next_cursor: Optional[str] = None
    total_count: int


class DashboardStats(BaseModel):
    """Real-time dashboard statistics."""
    active_jobs_count: int
    available_cleaners_count: int
    busy_cleaners_count: int
    delayed_jobs_count: int
    pending_assignment_count: int
    completed_today_count: int
    revenue_today: float


class AssignCleanerRequest(BaseModel):
    """Request to assign a cleaner to a job."""
    employee_id: str  # UUID of the employee (cleaner)
    legacy_cleaner_id: Optional[int] = None  # Legacy: User-based cleaner ID


# ============ Endpoints ============

@router.get("/cleaners/status", response_model=List[CleanerStatusDTO])
async def get_cleaners_status(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all cleaners with their current status.
    
    Optionally filter by status: available, busy, cooling_down, offline
    """
    # Get all cleaners with profiles
    query = db.query(User, CleanerProfile).outerjoin(
        CleanerProfile, User.id == CleanerProfile.user_id
    ).filter(User.role == UserRole.CLEANER)
    
    if status:
        query = query.filter(CleanerProfile.status == status)
    
    results = query.all()
    
    cleaners = []
    for user, profile in results:
        cleaners.append(CleanerStatusDTO(
            id=profile.id if profile else 0,
            user_id=user.id,
            name=user.full_name,
            status=profile.status.value if profile else "offline",
            active_job_count=profile.active_job_count if profile else 0,
            cooldown_expires_at=profile.cooldown_expires_at.isoformat() if profile and profile.cooldown_expires_at else None,
            total_jobs_completed=profile.total_jobs_completed if profile else 0,
            total_jobs_failed=profile.total_jobs_failed if profile else 0,
            average_rating=profile.average_rating if profile else None,
            last_active_at=profile.last_active_at.isoformat() if profile and profile.last_active_at else None
        ))
    
    return cleaners


@router.get("/alerts/delayed-jobs", response_model=List[DelayedJobDTO])
async def get_delayed_jobs(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get jobs that have breached their SLA deadline.
    
    Returns jobs where:
    - Status is ASSIGNED or IN_PROGRESS
    - SLA deadline has passed OR scheduled time + 10 minutes has passed
    """
    now = datetime.now(timezone.utc)
    sla_threshold = timedelta(minutes=10)
    
    # Query for delayed jobs
    delayed_jobs = db.query(Booking).filter(
        Booking.status.in_([BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS]),
        or_(
            Booking.sla_deadline < now,
            Booking.scheduled_date + sla_threshold < now
        )
    ).order_by(Booking.scheduled_date.asc()).all()
    
    result = []
    for job in delayed_jobs:
        # Calculate delay
        deadline = job.sla_deadline or (job.scheduled_date + sla_threshold)
        delay = now - deadline
        delay_minutes = max(0, int(delay.total_seconds() / 60))
        
        result.append(DelayedJobDTO(
            id=job.id,
            booking_number=job.booking_number,
            status=job.status.value,
            scheduled_date=job.scheduled_date.isoformat(),
            sla_deadline=job.sla_deadline.isoformat() if job.sla_deadline else None,
            delay_minutes=delay_minutes,
            cleaner_name=job.cleaner.full_name if job.cleaner else None,
            customer_name=job.customer.full_name if job.customer else "Unknown",
            city=job.address.city if job.address else "Unknown"
        ))
    
    return result


@router.get("/stats/realtime", response_model=DashboardStats)
async def get_realtime_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get real-time dashboard statistics.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    sla_threshold = timedelta(minutes=10)

    # Active jobs (in progress or assigned)
    active_jobs_count = db.query(func.count(Booking.id)).filter(
        Booking.status.in_([BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS, BookingStatus.PAUSED])
    ).scalar()

    # Available cleaners
    available_cleaners_count = db.query(func.count(CleanerProfile.id)).filter(
        CleanerProfile.status == CleanerStatus.AVAILABLE
    ).scalar()

    # Busy cleaners
    busy_cleaners_count = db.query(func.count(CleanerProfile.id)).filter(
        CleanerProfile.status == CleanerStatus.BUSY
    ).scalar()

    # Delayed jobs
    delayed_jobs_count = db.query(func.count(Booking.id)).filter(
        Booking.status.in_([BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS]),
        or_(
            Booking.sla_deadline < now,
            Booking.scheduled_date + sla_threshold < now
        )
    ).scalar()

    # Pending assignment
    pending_assignment_count = db.query(func.count(Booking.id)).filter(
        Booking.status.in_([BookingStatus.PENDING_ASSIGNMENT, BookingStatus.CONFIRMED])
    ).scalar()

    # Completed today
    completed_today_count = db.query(func.count(Booking.id)).filter(
        Booking.status == BookingStatus.COMPLETED,
        Booking.actual_end_time >= today_start
    ).scalar()

    # Revenue today
    revenue_today = db.query(func.sum(Booking.total_price)).filter(
        Booking.status == BookingStatus.COMPLETED,
        Booking.actual_end_time >= today_start
    ).scalar() or 0

    stats = DashboardStats(
        active_jobs_count=active_jobs_count or 0,
        available_cleaners_count=available_cleaners_count or 0,
        busy_cleaners_count=busy_cleaners_count or 0,
        delayed_jobs_count=delayed_jobs_count or 0,
        pending_assignment_count=pending_assignment_count or 0,
        completed_today_count=completed_today_count or 0,
        revenue_today=float(revenue_today)
    )

    # Update cache with current stats
    await cache_service.set_dashboard_stats({
        "active_jobs": stats.active_jobs_count,
        "available_cleaners": stats.available_cleaners_count,
        "busy_cleaners": stats.busy_cleaners_count,
        "delayed_jobs": stats.delayed_jobs_count,
        "pending_assignment": stats.pending_assignment_count,
        "completed_today": stats.completed_today_count,
    })

    # Publish stats update event
    await event_publisher.publish(EventType.STATS_UPDATED, {
        "active_jobs_count": stats.active_jobs_count,
        "available_cleaners_count": stats.available_cleaners_count,
        "busy_cleaners_count": stats.busy_cleaners_count,
        "delayed_jobs_count": stats.delayed_jobs_count,
        "pending_assignment_count": stats.pending_assignment_count,
        "completed_today_count": stats.completed_today_count,
        "revenue_today": stats.revenue_today,
    })

    return stats


@router.get("/jobs", response_model=PaginatedJobsResponse)
async def list_jobs_paginated(
    status: Optional[str] = None,
    cleaner_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get jobs with cursor-based pagination and filtering.
    
    Cursor is the last job ID from previous page.
    """
    query = db.query(Booking)
    
    # Apply filters
    if status:
        query = query.filter(Booking.status == status)
    
    if cleaner_id:
        query = query.filter(Booking.cleaner_id == cleaner_id)
    
    if from_date:
        from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        query = query.filter(Booking.scheduled_date >= from_dt)
    
    if to_date:
        to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
        query = query.filter(Booking.scheduled_date <= to_dt)
    
    # Cursor pagination
    if cursor:
        try:
            cursor_id = int(cursor)
            query = query.filter(Booking.id < cursor_id)
        except ValueError:
            pass
    
    # Get total count (without pagination)
    total_count = query.count()
    
    # Order and limit
    jobs = query.options(joinedload(Booking.add_ons)).order_by(Booking.id.desc()).limit(limit + 1).all()
    
    # Check if there's a next page
    has_next = len(jobs) > limit
    if has_next:
        jobs = jobs[:limit]
    
    next_cursor = str(jobs[-1].id) if has_next and jobs else None
    
    # Format response
    job_list = []
    for job in jobs:
        job_list.append(JobListItem(
            id=job.id,
            booking_number=job.booking_number,
            customer_name=job.customer.full_name if job.customer else "Unknown",
            customer_email=job.customer.email if job.customer else "",
            cleaner_name=job.cleaner.full_name if job.cleaner else None,
            service_name=job.service.name if job.service else "Unknown",
            city=job.address.city if job.address else "Unknown",
            scheduled_date=job.scheduled_date.isoformat(),
            status=job.status.value,
            payment_status=job.payment_status.value,
            total_price=float(job.total_price) if job.total_price else 0,
            version=job.version,
            created_at=job.created_at.isoformat(),
            add_ons=[addon.name for addon in job.add_ons]
        ))
    
    return PaginatedJobsResponse(
        jobs=job_list,
        next_cursor=next_cursor,
        total_count=total_count
    )


@router.get("/jobs/{job_id}/available-cleaners")
async def get_available_cleaners_for_job(
    job_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get list of available employees who can be assigned to this job.

    Returns employees who:
    - Are ACTIVE
    - Match the job's region
    - Don't have time conflicts
    """
    from app.services.cleaner_assignment import get_region_from_city, has_time_conflict

    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")

    # Get job region
    region = None
    if job.address and job.address.city:
        region = get_region_from_city(job.address.city)

    # Get duration
    service = job.service
    duration_hours = float(service.base_duration_hours or 2.5) if service else 2.5

    # Query active employees
    query = db.query(Employee).filter(
        Employee.account_status == EmployeeAccountStatus.ACTIVE
    )

    # Filter by region if available
    if region:
        query = query.filter(Employee.region_code == region)

    employees = query.all()

    # Filter by availability
    available = []
    for emp in employees:
        # Skip if busy
        if emp.cleaner_status == EmployeeCleanerStatus.BUSY:
            continue

        # Skip if time conflict
        if has_time_conflict(emp, job.scheduled_date, duration_hours, db):
            continue

        available.append({
            "id": str(emp.id),
            "employee_id": emp.employee_id,
            "full_name": emp.full_name,
            "region_code": emp.region_code,
            "status": emp.cleaner_status.value,
            "rating": float(emp.rating) if emp.rating else 5.0,
            "total_jobs_completed": emp.total_jobs_completed or 0
        })

    # Sort by rating (descending) then by jobs completed (descending)
    available.sort(key=lambda x: (-x["rating"], -x["total_jobs_completed"]))

    return {
        "job_id": job_id,
        "booking_number": job.booking_number,
        "scheduled_date": job.scheduled_date.isoformat() if job.scheduled_date else None,
        "region": region,
        "available_cleaners": available,
        "total_available": len(available)
    }


@router.post("/jobs/{job_id}/assign")
async def assign_cleaner_to_job(
    job_id: int,
    data: AssignCleanerRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Manually assign an employee (cleaner) to a job.

    - Job must be in PENDING, PENDING_ASSIGNMENT, or CONFIRMED status
    - Employee must be ACTIVE and AVAILABLE/OFFLINE (not BUSY)
    """
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")

    valid_statuses = [BookingStatus.PENDING, BookingStatus.PENDING_ASSIGNMENT, BookingStatus.CONFIRMED]
    if job.status not in valid_statuses:
        raise BadRequestException(
            f"Cannot assign cleaner to job in {job.status.value} status. "
            f"Job must be in: {', '.join(s.value for s in valid_statuses)}"
        )

    # Parse employee UUID
    try:
        employee_uuid = UUID(data.employee_id)
    except ValueError:
        raise BadRequestException("Invalid employee_id format. Must be a valid UUID.")

    # Verify employee exists and is active
    employee = db.query(Employee).filter(
        Employee.id == employee_uuid,
        Employee.account_status == EmployeeAccountStatus.ACTIVE
    ).first()

    if not employee:
        raise NotFoundException(f"Employee {data.employee_id} not found or not active")

    # Check if employee is not currently busy with another job
    if employee.cleaner_status == EmployeeCleanerStatus.BUSY:
        raise BadRequestException(
            f"Employee {employee.full_name} is currently busy with another job"
        )

    # Check for time conflicts
    from app.services.cleaner_assignment import has_time_conflict
    service = job.service
    duration_hours = float(service.base_duration_hours or 2.5) if service else 2.5

    if has_time_conflict(employee, job.scheduled_date, duration_hours, db):
        raise BadRequestException(
            f"Employee {employee.full_name} has a scheduling conflict at this time"
        )

    # Assign the employee
    now = datetime.now(timezone.utc)
    previous_status = job.status

    job.assigned_employee_id = employee.id
    job.status = BookingStatus.ASSIGNED
    job.assigned_at = now

    # Record status history
    history = BookingStatusHistory(
        booking_id=job.id,
        previous_status=previous_status,
        new_status=BookingStatus.ASSIGNED,
        changed_by_id=current_user.id,
        reason=f"Manually assigned by admin to {employee.full_name} ({employee.employee_id})"
    )
    db.add(history)
    db.commit()

    # Publish event
    await event_publisher.publish(EventType.JOB_ASSIGNED, {
        "job_id": job.id,
        "booking_number": job.booking_number,
        "cleaner_id": str(employee.id),
        "cleaner_name": employee.full_name,
        "employee_id": employee.employee_id,
        "assigned_by": current_user.full_name,
        "manual_assignment": True
    })

    # Update cache
    await cache_service.set(f"job:{job.id}:status", job.status.value, ttl=3600)

    return {
        "message": "Cleaner assigned successfully",
        "job_id": job.id,
        "booking_number": job.booking_number,
        "employee_id": str(employee.id),
        "employee_code": employee.employee_id,
        "cleaner_name": employee.full_name,
        "status": job.status.value
    }


@router.post("/jobs/{job_id}/unassign")
async def unassign_cleaner_from_job(
    job_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Unassign a cleaner from a job.

    - Job must be in ASSIGNED status (not yet started)
    - Cleaner is released and becomes available
    """
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")

    if job.status != BookingStatus.ASSIGNED:
        raise BadRequestException(f"Can only unassign from ASSIGNED jobs (current: {job.status.value})")

    old_cleaner_id = job.cleaner_id
    old_cleaner_name = None

    # Release cleaner
    if old_cleaner_id:
        cleaner = db.query(User).filter(User.id == old_cleaner_id).first()
        old_cleaner_name = cleaner.full_name if cleaner else None

        profile = db.query(CleanerProfile).filter(
            CleanerProfile.user_id == old_cleaner_id
        ).first()
        if profile:
            profile.status = CleanerStatus.AVAILABLE
            profile.active_job_count = 0

        # Update cache for cleaner status
        await cache_service.set_cleaner_status(old_cleaner_id, "available")

        # Publish cleaner status change event
        await event_publisher.publish(EventType.CLEANER_STATUS_CHANGED, {
            "cleaner_id": old_cleaner_id,
            "cleaner_name": old_cleaner_name,
            "status": "available",
            "previous_status": "busy"
        })

    # Reset job to pending assignment
    job.cleaner_id = None
    job.status = BookingStatus.PENDING_ASSIGNMENT
    job.assigned_at = None
    job.version += 1

    db.commit()

    # Publish job unassigned event (use JOB_CANCELLED or a custom approach)
    await event_publisher.publish(EventType.JOB_ASSIGNED, {
        "job_id": job.id,
        "booking_number": job.booking_number,
        "status": job.status.value,
        "cleaner_id": None,
        "cleaner_name": None,
        "customer_id": job.customer_id,
        "unassigned_from_cleaner_id": old_cleaner_id,
        "unassigned_from_cleaner_name": old_cleaner_name,
        "action": "unassigned"
    })

    return {
        "message": "Cleaner unassigned successfully",
        "job_id": job.id,
        "booking_number": job.booking_number,
        "status": job.status.value
    }


@router.get("/jobs/{job_id}/history")
async def get_job_history(
    job_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get status change history for a job.
    """
    from app.models import BookingStatusHistory

    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")

    history = db.query(BookingStatusHistory).filter(
        BookingStatusHistory.booking_id == job_id
    ).order_by(BookingStatusHistory.created_at.desc()).all()

    return {
        "job_id": job_id,
        "booking_number": job.booking_number,
        "current_status": job.status.value,
        "current_version": job.version,
        "history": [
            {
                "id": h.id,
                "previous_status": h.previous_status.value if h.previous_status else None,
                "new_status": h.new_status.value,
                "changed_by": h.changed_by_id,
                "reason": h.reason,
                "timestamp": h.created_at.isoformat()
            }
            for h in history
        ]
    }


# ============ Allocation Metrics Endpoints ============

@router.get("/allocation/metrics")
async def get_allocation_metrics(
    region_code: Optional[str] = Query(None, description="Filter by region code (DXB, AUH, etc.)"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get allocation metrics for the dashboard.

    Returns:
    - Total allocations
    - Success/failure counts
    - Success rate percentage
    - Average allocation time
    - Breakdown by region
    """
    from app.services.allocation_engine import AllocationEngine

    engine = AllocationEngine(db)
    metrics = await engine.get_allocation_metrics(region_code, date)

    return metrics


@router.get("/allocation/queue/{region_code}")
async def get_queue_status(
    region_code: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get current queue status for a region.

    Shows all cleaners in the region with:
    - Queue position
    - Current status (available/busy/offline)
    - Rating
    - Today's booking count
    """
    from app.services.allocation_engine import AllocationEngine

    engine = AllocationEngine(db)
    queue_status = await engine.get_queue_status(region_code)

    return {
        "region_code": region_code,
        "queue": queue_status,
        "total_cleaners": len(queue_status)
    }


@router.get("/allocation/regions")
async def get_available_regions(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get list of all regions with cleaner counts.
    """
    from app.services.allocation_engine import REGION_COORDINATES

    regions = []
    for region_code, coords in REGION_COORDINATES.items():
        # Count active cleaners in region
        cleaner_count = db.query(func.count(Employee.id)).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE,
            Employee.region_code == region_code
        ).scalar() or 0

        # Count available cleaners
        available_count = db.query(func.count(Employee.id)).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE,
            Employee.region_code == region_code,
            Employee.cleaner_status == EmployeeCleanerStatus.AVAILABLE
        ).scalar() or 0

        regions.append({
            "code": region_code,
            "coordinates": {"lat": coords[0], "lng": coords[1]},
            "total_cleaners": cleaner_count,
            "available_cleaners": available_count
        })

    return {
        "regions": regions,
        "total_regions": len(regions)
    }
