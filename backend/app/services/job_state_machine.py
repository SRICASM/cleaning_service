"""
Job State Machine Service

Implements the job lifecycle state machine with:
- Valid transition definitions
- Pre-transition validations
- Post-transition actions
- Optimistic locking for concurrency control
- Audit logging
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
import json

from app.models import (
    Booking, BookingStatus, BookingStatusHistory,
    CleanerProfile, CleanerStatus,
    AuditLog, User
)
from app.core.exceptions import (
    BadRequestException, ForbiddenException, NotFoundException
)
from app.services.events import event_publisher, EventType
from app.services.cache import cache_service


class ConcurrentModificationError(Exception):
    """Raised when optimistic locking detects a concurrent modification."""
    def __init__(self, message: str = "Resource was modified by another request"):
        self.message = message
        super().__init__(self.message)


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    def __init__(self, current_status: str, requested_status: str):
        self.message = f"Invalid transition from {current_status} to {requested_status}"
        super().__init__(self.message)


class JobStateMachine:
    """
    Manages job lifecycle state transitions with validation and side effects.
    """
    
    # Valid state transitions: current_status -> [allowed_next_statuses]
    VALID_TRANSITIONS: Dict[BookingStatus, List[BookingStatus]] = {
        BookingStatus.PENDING: [
            BookingStatus.PENDING_ASSIGNMENT,  # After payment
            BookingStatus.CANCELLED,
        ],
        BookingStatus.PENDING_ASSIGNMENT: [
            BookingStatus.ASSIGNED,  # Cleaner assigned
            BookingStatus.CANCELLED,
        ],
        BookingStatus.CONFIRMED: [  # Legacy status, treat like PENDING_ASSIGNMENT
            BookingStatus.ASSIGNED,
            BookingStatus.CANCELLED,
        ],
        BookingStatus.ASSIGNED: [
            BookingStatus.IN_PROGRESS,  # Cleaner starts job
            BookingStatus.CANCELLED,
        ],
        BookingStatus.IN_PROGRESS: [
            BookingStatus.PAUSED,     # Cleaner pauses
            BookingStatus.COMPLETED,  # Cleaner completes
            BookingStatus.FAILED,     # Job failed
            BookingStatus.CANCELLED,
        ],
        BookingStatus.PAUSED: [
            BookingStatus.IN_PROGRESS,  # Cleaner resumes
            BookingStatus.CANCELLED,
        ],
        # Terminal states - no transitions out
        BookingStatus.COMPLETED: [],
        BookingStatus.CANCELLED: [BookingStatus.REFUNDED],
        BookingStatus.FAILED: [
            BookingStatus.PENDING_ASSIGNMENT,  # Reassignment
        ],
        BookingStatus.REFUNDED: [],
        BookingStatus.NO_SHOW: [],
    }
    
    # SLA threshold in minutes (job must start within this time of scheduled_date)
    SLA_START_THRESHOLD_MINUTES = 10
    
    # Max pause duration in minutes
    MAX_PAUSE_DURATION_MINUTES = 30
    
    # Cooldown duration after completing a job
    COOLDOWN_DURATION_MINUTES = 15
    
    def __init__(self, db: Session):
        self.db = db
    
    def can_transition(
        self,
        current_status: BookingStatus,
        new_status: BookingStatus
    ) -> bool:
        """Check if a transition is valid."""
        allowed = self.VALID_TRANSITIONS.get(current_status, [])
        return new_status in allowed
    
    def transition(
        self,
        job_id: int,
        new_status: BookingStatus,
        actor: User,
        expected_version: Optional[int] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Booking:
        """
        Execute a state transition with optimistic locking.
        
        Args:
            job_id: The booking/job ID
            new_status: Target status
            actor: User performing the action
            expected_version: Expected version for optimistic locking
            reason: Reason for the transition
            metadata: Additional context (idempotency key, etc.)
            
        Returns:
            Updated Booking object
            
        Raises:
            NotFoundException: Job not found
            InvalidTransitionError: Transition not allowed
            ConcurrentModificationError: Version mismatch
        """
        # Fetch the job
        job = self.db.query(Booking).filter(Booking.id == job_id).first()
        if not job:
            raise NotFoundException(f"Job {job_id} not found")
        
        current_status = job.status
        
        # Validate transition
        if not self.can_transition(current_status, new_status):
            raise InvalidTransitionError(current_status.value, new_status.value)
        
        # Optimistic locking check
        if expected_version is not None and job.version != expected_version:
            raise ConcurrentModificationError(
                f"Job was modified. Expected version {expected_version}, got {job.version}"
            )
        
        # Run pre-transition validations
        self._validate_transition(job, new_status, actor)
        
        # Capture previous state for audit
        previous_state = {
            "status": current_status.value,
            "version": job.version,
        }
        
        # Execute transition actions
        self._execute_transition_actions(job, current_status, new_status, actor, reason)
        
        # Update status and version
        job.status = new_status
        job.version += 1
        job.updated_at = datetime.now(timezone.utc)
        
        # Create status history record
        history = BookingStatusHistory(
            booking_id=job.id,
            previous_status=current_status,
            new_status=new_status,
            changed_by_id=actor.id,
            reason=reason or self._get_default_reason(current_status, new_status)
        )
        self.db.add(history)
        
        # Create audit log
        new_state = {
            "status": new_status.value,
            "version": job.version,
        }
        self._create_audit_log(
            entity_type="booking",
            entity_id=job.id,
            action=f"status_change_{new_status.value}",
            actor=actor,
            previous_state=previous_state,
            new_state=new_state,
            reason=reason,
            metadata=metadata
        )
        
        self.db.commit()
        self.db.refresh(job)

        # Publish event for the transition (async in background)
        self._publish_transition_event(job, current_status, new_status, actor)

        return job

    def _publish_transition_event(
        self,
        job: Booking,
        old_status: BookingStatus,
        new_status: BookingStatus,
        actor: User
    ) -> None:
        """Publish event for state transition (fire-and-forget)."""
        import asyncio

        event_type_map = {
            BookingStatus.ASSIGNED: EventType.JOB_ASSIGNED,
            BookingStatus.IN_PROGRESS: EventType.JOB_STARTED if old_status == BookingStatus.ASSIGNED else EventType.JOB_RESUMED,
            BookingStatus.PAUSED: EventType.JOB_PAUSED,
            BookingStatus.COMPLETED: EventType.JOB_COMPLETED,
            BookingStatus.CANCELLED: EventType.JOB_CANCELLED,
            BookingStatus.FAILED: EventType.JOB_FAILED,
        }

        event_type = event_type_map.get(new_status)
        if not event_type:
            return

        # Get cleaner info
        cleaner = self.db.query(User).filter(User.id == job.cleaner_id).first() if job.cleaner_id else None
        cleaner_name = cleaner.full_name if cleaner else None

        payload = {
            "job_id": job.id,
            "booking_number": job.booking_number,
            "status": new_status.value,
            "previous_status": old_status.value,
            "cleaner_id": job.cleaner_id,
            "cleaner_name": cleaner_name,
            "customer_id": job.customer_id,
        }

        # Add status-specific data
        if new_status == BookingStatus.IN_PROGRESS and job.actual_start_time:
            payload["started_at"] = job.actual_start_time.isoformat()
        elif new_status == BookingStatus.COMPLETED and job.actual_end_time:
            payload["completed_at"] = job.actual_end_time.isoformat()
            payload["total_price"] = float(job.total_price) if job.total_price else 0
        elif new_status == BookingStatus.PAUSED and job.paused_at:
            payload["paused_at"] = job.paused_at.isoformat()
        elif new_status == BookingStatus.FAILED:
            payload["failure_reason"] = job.failure_reason
        elif new_status == BookingStatus.CANCELLED:
            payload["cancellation_reason"] = job.cancellation_reason

        # Fire-and-forget event publishing
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(event_publisher.publish(event_type, payload))
            else:
                loop.run_until_complete(event_publisher.publish(event_type, payload))
        except RuntimeError:
            # No event loop, create one
            asyncio.run(event_publisher.publish(event_type, payload))
    
    def _validate_transition(
        self,
        job: Booking,
        new_status: BookingStatus,
        actor: User
    ) -> None:
        """Run pre-transition validations."""
        
        # ASSIGNED -> IN_PROGRESS: Cleaner must be the assigned cleaner
        if new_status == BookingStatus.IN_PROGRESS:
            if actor.role.value == "cleaner":
                if job.cleaner_id != actor.id:
                    raise ForbiddenException("You are not assigned to this job")
        
        # PAUSED -> IN_PROGRESS: Check max pause duration
        if job.status == BookingStatus.PAUSED and new_status == BookingStatus.IN_PROGRESS:
            if job.paused_at:
                pause_duration = datetime.now(timezone.utc) - job.paused_at
                if pause_duration > timedelta(minutes=self.MAX_PAUSE_DURATION_MINUTES):
                    # Auto-fail the job if paused too long
                    raise BadRequestException(
                        f"Job was paused for more than {self.MAX_PAUSE_DURATION_MINUTES} minutes"
                    )
    
    def _execute_transition_actions(
        self,
        job: Booking,
        old_status: BookingStatus,
        new_status: BookingStatus,
        actor: User,
        reason: Optional[str]
    ) -> None:
        """Execute side effects for the transition."""
        now = datetime.now(timezone.utc)
        
        # PENDING_ASSIGNMENT -> ASSIGNED
        if new_status == BookingStatus.ASSIGNED:
            job.assigned_at = now
            job.sla_deadline = job.scheduled_date + timedelta(minutes=self.SLA_START_THRESHOLD_MINUTES)
            
            # Update cleaner status
            if job.cleaner_id:
                self._update_cleaner_status(job.cleaner_id, CleanerStatus.BUSY)
        
        # ASSIGNED -> IN_PROGRESS
        elif new_status == BookingStatus.IN_PROGRESS:
            if old_status == BookingStatus.ASSIGNED:
                job.actual_start_time = now
            elif old_status == BookingStatus.PAUSED:
                job.resumed_at = now
        
        # IN_PROGRESS -> PAUSED
        elif new_status == BookingStatus.PAUSED:
            job.paused_at = now
        
        # IN_PROGRESS -> COMPLETED
        elif new_status == BookingStatus.COMPLETED:
            job.actual_end_time = now

            # Update cleaner to cooling down
            if job.cleaner_id:
                self._update_cleaner_status(
                    job.cleaner_id,
                    CleanerStatus.COOLING_DOWN,
                    cooldown_minutes=self.COOLDOWN_DURATION_MINUTES
                )
                self._increment_cleaner_stats(job.cleaner_id, completed=True)

            # Process completion rewards (cashback + referral completion)
            self._process_completion_rewards(job)
        
        # IN_PROGRESS -> FAILED
        elif new_status == BookingStatus.FAILED:
            job.failed_at = now
            job.failure_reason = reason
            
            # Release cleaner
            if job.cleaner_id:
                self._update_cleaner_status(job.cleaner_id, CleanerStatus.AVAILABLE)
                self._increment_cleaner_stats(job.cleaner_id, completed=False)
        
        # ANY -> CANCELLED
        elif new_status == BookingStatus.CANCELLED:
            job.cancelled_at = now
            job.cancelled_by_id = actor.id
            job.cancellation_reason = reason
            
            # Release cleaner if assigned
            if job.cleaner_id and old_status in [
                BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS, BookingStatus.PAUSED
            ]:
                self._update_cleaner_status(job.cleaner_id, CleanerStatus.AVAILABLE)
    
    def _update_cleaner_status(
        self,
        cleaner_id: int,
        status: CleanerStatus,
        cooldown_minutes: int = 0
    ) -> None:
        """Update cleaner profile status."""
        import asyncio

        profile = self.db.query(CleanerProfile).filter(
            CleanerProfile.user_id == cleaner_id
        ).first()

        if profile:
            old_status = profile.status
            profile.status = status
            profile.updated_at = datetime.now(timezone.utc)

            if status == CleanerStatus.COOLING_DOWN and cooldown_minutes > 0:
                profile.cooldown_expires_at = datetime.now(timezone.utc) + timedelta(minutes=cooldown_minutes)
            elif status == CleanerStatus.AVAILABLE:
                profile.cooldown_expires_at = None
                profile.active_job_count = 0
            elif status == CleanerStatus.BUSY:
                profile.active_job_count = 1

            # Update cache (fire-and-forget)
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(cache_service.set_cleaner_status(cleaner_id, status.value))
                else:
                    loop.run_until_complete(cache_service.set_cleaner_status(cleaner_id, status.value))
            except RuntimeError:
                asyncio.run(cache_service.set_cleaner_status(cleaner_id, status.value))

            # Publish cleaner status change event
            if old_status != status:
                cleaner = self.db.query(User).filter(User.id == cleaner_id).first()
                cleaner_name = cleaner.full_name if cleaner else "Unknown"
                payload = {
                    "cleaner_id": cleaner_id,
                    "cleaner_name": cleaner_name,
                    "status": status.value,
                    "previous_status": old_status.value if old_status else None,
                }
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.create_task(event_publisher.publish(EventType.CLEANER_STATUS_CHANGED, payload))
                    else:
                        loop.run_until_complete(event_publisher.publish(EventType.CLEANER_STATUS_CHANGED, payload))
                except RuntimeError:
                    asyncio.run(event_publisher.publish(EventType.CLEANER_STATUS_CHANGED, payload))
    
    def _increment_cleaner_stats(self, cleaner_id: int, completed: bool) -> None:
        """Increment cleaner job statistics."""
        profile = self.db.query(CleanerProfile).filter(
            CleanerProfile.user_id == cleaner_id
        ).first()

        if profile:
            if completed:
                profile.total_jobs_completed = (profile.total_jobs_completed or 0) + 1
            else:
                profile.total_jobs_failed = (profile.total_jobs_failed or 0) + 1

    def _process_completion_rewards(self, job: Booking) -> None:
        """Process cashback and referral rewards on booking completion."""
        from decimal import Decimal

        try:
            from app.api.wallet import get_or_create_wallet, create_transaction
            from app.models.wallet import TransactionType, Referral, ReferralStatus
        except ImportError:
            # Wallet module not available, skip rewards processing
            return

        CASHBACK_PERCENTAGE = Decimal("0.05")  # 5% cashback

        # 1. Add cashback to customer wallet
        if job.total_price and float(job.total_price) > 0:
            try:
                cashback_amount = (Decimal(str(job.total_price)) * CASHBACK_PERCENTAGE).quantize(Decimal("0.01"))
                if cashback_amount > 0:
                    wallet = get_or_create_wallet(self.db, job.customer_id)
                    create_transaction(
                        db=self.db,
                        wallet=wallet,
                        type=TransactionType.CASHBACK,
                        amount=cashback_amount,
                        description=f"5% cashback from booking #{job.booking_number}",
                        reference_type="booking",
                        reference_id=str(job.id)
                    )
            except Exception as e:
                # Log error but don't fail the job completion
                print(f"Error processing cashback for booking {job.id}: {e}")

        # 2. Check and complete pending referral
        self._complete_pending_referral(job.customer_id, job.id)

    def _complete_pending_referral(self, customer_id: int, booking_id: int) -> None:
        """Complete referral if this is customer's first completed booking."""
        try:
            from app.models.wallet import Referral, ReferralStatus
            from app.api.referrals import add_referral_reward, REFERRAL_REWARD_AMOUNT
        except ImportError:
            # Referral module not available
            return

        # Find pending referral for this user
        referral = self.db.query(Referral).filter(
            Referral.referred_id == customer_id,
            Referral.status == ReferralStatus.PENDING
        ).first()

        if not referral:
            return

        # Check if expired
        if referral.expires_at and datetime.now(timezone.utc) > referral.expires_at:
            referral.status = ReferralStatus.EXPIRED
            return

        # Check if first completed booking
        completed_count = self.db.query(Booking).filter(
            Booking.customer_id == customer_id,
            Booking.status == BookingStatus.COMPLETED
        ).count()

        if completed_count == 1:  # First completed booking
            try:
                referral.status = ReferralStatus.COMPLETED
                referral.completed_at = datetime.now(timezone.utc)
                referral.first_booking_id = booking_id

                # Reward referrer
                add_referral_reward(
                    db=self.db,
                    user_id=referral.referrer_id,
                    amount=REFERRAL_REWARD_AMOUNT,
                    description="Referral reward - friend completed first booking",
                    referral_id=referral.id
                )
            except Exception as e:
                # Log error but don't fail the job completion
                print(f"Error completing referral for customer {customer_id}: {e}")

    def _create_audit_log(
        self,
        entity_type: str,
        entity_id: int,
        action: str,
        actor: User,
        previous_state: Dict,
        new_state: Dict,
        reason: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> None:
        """Create an audit log entry."""
        audit = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=actor.id,
            actor_type=actor.role.value if actor.role else "user",
            previous_state=json.dumps(previous_state),
            new_state=json.dumps(new_state),
            reason=reason,
            extra_data=json.dumps(metadata) if metadata else None
        )
        self.db.add(audit)
    
    def _get_default_reason(
        self,
        old_status: BookingStatus,
        new_status: BookingStatus
    ) -> str:
        """Get a default reason for common transitions."""
        reasons = {
            (BookingStatus.PENDING, BookingStatus.PENDING_ASSIGNMENT): "Payment completed",
            (BookingStatus.PENDING_ASSIGNMENT, BookingStatus.ASSIGNED): "Cleaner assigned",
            (BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS): "Job started by cleaner",
            (BookingStatus.IN_PROGRESS, BookingStatus.PAUSED): "Job paused by cleaner",
            (BookingStatus.PAUSED, BookingStatus.IN_PROGRESS): "Job resumed by cleaner",
            (BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED): "Job completed by cleaner",
        }
        return reasons.get((old_status, new_status), f"Status changed to {new_status.value}")
    
    # Convenience methods for common transitions
    
    def start_job(
        self,
        job_id: int,
        cleaner: User,
        expected_version: Optional[int] = None,
        idempotency_key: Optional[str] = None
    ) -> Booking:
        """Cleaner starts a job (ASSIGNED -> IN_PROGRESS)."""
        return self.transition(
            job_id=job_id,
            new_status=BookingStatus.IN_PROGRESS,
            actor=cleaner,
            expected_version=expected_version,
            reason="Job started by cleaner",
            metadata={"idempotency_key": idempotency_key} if idempotency_key else None
        )
    
    def pause_job(
        self,
        job_id: int,
        cleaner: User,
        reason: Optional[str] = None
    ) -> Booking:
        """Cleaner pauses a job (IN_PROGRESS -> PAUSED)."""
        return self.transition(
            job_id=job_id,
            new_status=BookingStatus.PAUSED,
            actor=cleaner,
            reason=reason or "Job paused by cleaner"
        )
    
    def resume_job(
        self,
        job_id: int,
        cleaner: User
    ) -> Booking:
        """Cleaner resumes a job (PAUSED -> IN_PROGRESS)."""
        return self.transition(
            job_id=job_id,
            new_status=BookingStatus.IN_PROGRESS,
            actor=cleaner,
            reason="Job resumed by cleaner"
        )
    
    def complete_job(
        self,
        job_id: int,
        cleaner: User,
        expected_version: Optional[int] = None,
        idempotency_key: Optional[str] = None
    ) -> Booking:
        """Cleaner completes a job (IN_PROGRESS -> COMPLETED)."""
        return self.transition(
            job_id=job_id,
            new_status=BookingStatus.COMPLETED,
            actor=cleaner,
            expected_version=expected_version,
            reason="Job completed by cleaner",
            metadata={"idempotency_key": idempotency_key} if idempotency_key else None
        )
    
    def fail_job(
        self,
        job_id: int,
        actor: User,
        reason: str
    ) -> Booking:
        """Mark a job as failed (IN_PROGRESS -> FAILED)."""
        return self.transition(
            job_id=job_id,
            new_status=BookingStatus.FAILED,
            actor=actor,
            reason=reason
        )
    
    def assign_cleaner(
        self,
        job_id: int,
        cleaner_id: int,
        admin: User
    ) -> Booking:
        """Admin assigns a cleaner to a job."""
        job = self.db.query(Booking).filter(Booking.id == job_id).first()
        if not job:
            raise NotFoundException(f"Job {job_id} not found")
        
        # Validate cleaner
        cleaner_profile = self.db.query(CleanerProfile).filter(
            CleanerProfile.user_id == cleaner_id
        ).first()
        
        if cleaner_profile and cleaner_profile.status != CleanerStatus.AVAILABLE:
            raise BadRequestException(f"Cleaner is not available (status: {cleaner_profile.status.value})")
        
        # Update job with cleaner
        job.cleaner_id = cleaner_id
        
        # Transition to ASSIGNED
        return self.transition(
            job_id=job_id,
            new_status=BookingStatus.ASSIGNED,
            actor=admin,
            reason=f"Cleaner assigned by admin"
        )
