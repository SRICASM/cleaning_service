"""
Cleaner Action APIs

Endpoints for cleaners to manage their job lifecycle:
- Start job
- Pause job
- Resume job
- Complete job
- Report failure
"""
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_user
from app.models import User, Booking, BookingStatus, CleanerProfile, CleanerStatus
from app.services.job_state_machine import (
    JobStateMachine,
    InvalidTransitionError,
    ConcurrentModificationError
)
from app.services.events import event_publisher, EventType
from app.services.cache import cache_service
from app.core.exceptions import (
    ForbiddenException, NotFoundException, BadRequestException
)


router = APIRouter(prefix="/cleaner", tags=["Cleaner Actions"])


# ============ Request/Response Schemas ============

class StartJobRequest(BaseModel):
    """Request to start a job."""
    expected_version: Optional[int] = None


class PauseJobRequest(BaseModel):
    """Request to pause a job."""
    reason: Optional[str] = None


class CompleteJobRequest(BaseModel):
    """Request to complete a job."""
    expected_version: Optional[int] = None
    photo_ids: list[str] = []  # Optional photo IDs for verification
    notes: Optional[str] = None


class FailJobRequest(BaseModel):
    """Request to report a job failure."""
    reason: str


class JobResponse(BaseModel):
    """Response with job details."""
    id: int
    booking_number: str
    status: str
    version: int
    scheduled_date: str
    actual_start_time: Optional[str] = None
    actual_end_time: Optional[str] = None
    sla_deadline: Optional[str] = None
    message: str


# ============ Helper Functions ============

def validate_cleaner_role(user: User) -> None:
    """Ensure user is a cleaner."""
    if user.role.value not in ["cleaner", "admin"]:
        raise ForbiddenException("Only cleaners can perform this action")


def format_job_response(job: Booking, message: str) -> JobResponse:
    """Format a job into a response."""
    return JobResponse(
        id=job.id,
        booking_number=job.booking_number,
        status=job.status.value,
        version=job.version,
        scheduled_date=job.scheduled_date.isoformat() if job.scheduled_date else None,
        actual_start_time=job.actual_start_time.isoformat() if job.actual_start_time else None,
        actual_end_time=job.actual_end_time.isoformat() if job.actual_end_time else None,
        sla_deadline=job.sla_deadline.isoformat() if job.sla_deadline else None,
        message=message
    )


# ============ Endpoints ============

@router.post("/jobs/{job_id}/start", response_model=JobResponse)
async def start_job(
    job_id: int,
    data: StartJobRequest,
    x_idempotency_key: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a job (ASSIGNED → IN_PROGRESS).
    
    - Only the assigned cleaner can start a job
    - Use idempotency key to prevent duplicate starts
    - Returns 409 if version mismatch (concurrent modification)
    """
    validate_cleaner_role(current_user)
    
    # Verify this cleaner is assigned to the job
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")
    
    if job.cleaner_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException("You are not assigned to this job")
    
    # Idempotency check: if already in progress, return success
    if job.status == BookingStatus.IN_PROGRESS:
        return format_job_response(job, "Job is already in progress")
    
    try:
        state_machine = JobStateMachine(db)
        updated_job = state_machine.start_job(
            job_id=job_id,
            cleaner=current_user,
            expected_version=data.expected_version,
            idempotency_key=x_idempotency_key
        )
        return format_job_response(updated_job, "Job started successfully")
        
    except InvalidTransitionError as e:
        raise BadRequestException(str(e))
    except ConcurrentModificationError as e:
        raise BadRequestException(str(e))


@router.post("/jobs/{job_id}/pause", response_model=JobResponse)
async def pause_job(
    job_id: int,
    data: PauseJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pause a job (IN_PROGRESS → PAUSED).
    
    - Only the assigned cleaner can pause a job
    - Max pause duration is 30 minutes
    """
    validate_cleaner_role(current_user)
    
    # Verify this cleaner is assigned to the job
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")
    
    if job.cleaner_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException("You are not assigned to this job")
    
    # Idempotency: if already paused, return success
    if job.status == BookingStatus.PAUSED:
        return format_job_response(job, "Job is already paused")
    
    try:
        state_machine = JobStateMachine(db)
        updated_job = state_machine.pause_job(
            job_id=job_id,
            cleaner=current_user,
            reason=data.reason
        )
        return format_job_response(updated_job, "Job paused successfully")
        
    except InvalidTransitionError as e:
        raise BadRequestException(str(e))


@router.post("/jobs/{job_id}/resume", response_model=JobResponse)
async def resume_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resume a paused job (PAUSED → IN_PROGRESS).
    
    - Only the assigned cleaner can resume a job
    - Fails if paused for more than 30 minutes
    """
    validate_cleaner_role(current_user)
    
    # Verify this cleaner is assigned to the job
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")
    
    if job.cleaner_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException("You are not assigned to this job")
    
    # Idempotency: if already in progress, return success
    if job.status == BookingStatus.IN_PROGRESS:
        return format_job_response(job, "Job is already in progress")
    
    try:
        state_machine = JobStateMachine(db)
        updated_job = state_machine.resume_job(
            job_id=job_id,
            cleaner=current_user
        )
        return format_job_response(updated_job, "Job resumed successfully")
        
    except InvalidTransitionError as e:
        raise BadRequestException(str(e))


@router.post("/jobs/{job_id}/complete", response_model=JobResponse)
async def complete_job(
    job_id: int,
    data: CompleteJobRequest,
    x_idempotency_key: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete a job (IN_PROGRESS → COMPLETED).
    
    - Only the assigned cleaner can complete a job
    - Use idempotency key to prevent duplicate completions
    - Puts cleaner in cooldown state
    """
    validate_cleaner_role(current_user)
    
    # Verify this cleaner is assigned to the job
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")
    
    if job.cleaner_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException("You are not assigned to this job")
    
    # Idempotency: if already completed, return success
    if job.status == BookingStatus.COMPLETED:
        return format_job_response(job, "Job is already completed")
    
    # Update cleaner notes if provided
    if data.notes:
        job.cleaner_notes = data.notes
    
    try:
        state_machine = JobStateMachine(db)
        updated_job = state_machine.complete_job(
            job_id=job_id,
            cleaner=current_user,
            expected_version=data.expected_version,
            idempotency_key=x_idempotency_key
        )
        return format_job_response(updated_job, "Job completed successfully")
        
    except InvalidTransitionError as e:
        raise BadRequestException(str(e))
    except ConcurrentModificationError as e:
        raise BadRequestException(str(e))


@router.post("/jobs/{job_id}/fail", response_model=JobResponse)
async def fail_job(
    job_id: int,
    data: FailJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Report a job failure (IN_PROGRESS → FAILED).
    
    - Cleaner or admin can report failure
    - Job is released and available for reassignment
    - Cleaner becomes available again
    """
    validate_cleaner_role(current_user)
    
    job = db.query(Booking).filter(Booking.id == job_id).first()
    if not job:
        raise NotFoundException(f"Job {job_id} not found")
    
    if job.cleaner_id != current_user.id and current_user.role.value != "admin":
        raise ForbiddenException("You are not assigned to this job")
    
    # Idempotency: if already failed, return success
    if job.status == BookingStatus.FAILED:
        return format_job_response(job, "Job is already marked as failed")
    
    try:
        state_machine = JobStateMachine(db)
        updated_job = state_machine.fail_job(
            job_id=job_id,
            actor=current_user,
            reason=data.reason
        )
        return format_job_response(updated_job, "Job marked as failed")
        
    except InvalidTransitionError as e:
        raise BadRequestException(str(e))


# ============ Cleaner Status Endpoints ============

@router.get("/me/status")
async def get_my_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current cleaner's status and active job."""
    validate_cleaner_role(current_user)

    # Try cache first for status
    cached_status = await cache_service.get_cleaner_status(current_user.id)

    profile = db.query(CleanerProfile).filter(
        CleanerProfile.user_id == current_user.id
    ).first()

    # Use cached status if available, otherwise from DB
    status = cached_status or (profile.status.value if profile else "offline")

    # Update cache if we got from DB
    if not cached_status and profile:
        await cache_service.set_cleaner_status(current_user.id, profile.status.value)

    # Get active job if any
    active_job = db.query(Booking).filter(
        Booking.cleaner_id == current_user.id,
        Booking.status.in_([
            BookingStatus.ASSIGNED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.PAUSED
        ])
    ).first()

    return {
        "cleaner_id": current_user.id,
        "name": current_user.full_name,
        "status": status,
        "active_job_count": profile.active_job_count if profile else 0,
        "cooldown_expires_at": profile.cooldown_expires_at.isoformat() if profile and profile.cooldown_expires_at else None,
        "total_jobs_completed": profile.total_jobs_completed if profile else 0,
        "active_job": {
            "id": active_job.id,
            "booking_number": active_job.booking_number,
            "status": active_job.status.value,
            "scheduled_date": active_job.scheduled_date.isoformat()
        } if active_job else None
    }


@router.post("/me/go-online")
async def go_online(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set cleaner status to available."""
    validate_cleaner_role(current_user)

    profile = db.query(CleanerProfile).filter(
        CleanerProfile.user_id == current_user.id
    ).first()

    old_status = profile.status.value if profile else "offline"

    if not profile:
        # Create profile if doesn't exist
        profile = CleanerProfile(
            user_id=current_user.id,
            status=CleanerStatus.AVAILABLE
        )
        db.add(profile)
    else:
        profile.status = CleanerStatus.AVAILABLE

    db.commit()

    # Update cache
    await cache_service.set_cleaner_status(current_user.id, "available")

    # Publish event
    await event_publisher.publish(EventType.CLEANER_ONLINE, {
        "cleaner_id": current_user.id,
        "cleaner_name": current_user.full_name,
        "status": "available",
        "previous_status": old_status
    })

    return {"message": "You are now online and available for jobs", "status": "available"}


@router.post("/me/go-offline")
async def go_offline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set cleaner status to offline."""
    validate_cleaner_role(current_user)

    # Check if cleaner has active jobs
    active_job = db.query(Booking).filter(
        Booking.cleaner_id == current_user.id,
        Booking.status.in_([
            BookingStatus.IN_PROGRESS,
            BookingStatus.PAUSED
        ])
    ).first()

    if active_job:
        raise BadRequestException("Cannot go offline while a job is in progress")

    profile = db.query(CleanerProfile).filter(
        CleanerProfile.user_id == current_user.id
    ).first()

    old_status = profile.status.value if profile else "offline"

    if profile:
        profile.status = CleanerStatus.OFFLINE
        db.commit()

    # Update cache
    await cache_service.set_cleaner_status(current_user.id, "offline")

    # Publish event
    await event_publisher.publish(EventType.CLEANER_OFFLINE, {
        "cleaner_id": current_user.id,
        "cleaner_name": current_user.full_name,
        "status": "offline",
        "previous_status": old_status
    })

    return {"message": "You are now offline", "status": "offline"}


@router.get("/me/jobs")
async def get_my_jobs(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cleaner's assigned jobs."""
    validate_cleaner_role(current_user)
    
    query = db.query(Booking).filter(Booking.cleaner_id == current_user.id)
    
    if status:
        query = query.filter(Booking.status == status)
    else:
        # Default: show active and recent jobs
        query = query.filter(Booking.status.in_([
            BookingStatus.ASSIGNED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.PAUSED,
            BookingStatus.COMPLETED
        ]))
    
    jobs = query.order_by(Booking.scheduled_date.desc()).limit(20).all()
    
    return {
        "jobs": [
            {
                "id": job.id,
                "booking_number": job.booking_number,
                "status": job.status.value,
                "scheduled_date": job.scheduled_date.isoformat(),
                "actual_start_time": job.actual_start_time.isoformat() if job.actual_start_time else None,
                "actual_end_time": job.actual_end_time.isoformat() if job.actual_end_time else None,
                "total_price": float(job.total_price) if job.total_price else 0
            }
            for job in jobs
        ]
    }
