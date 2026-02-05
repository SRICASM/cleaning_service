"""
SLA Monitoring Service

Monitors job SLAs and triggers alerts for delayed jobs.
Can be run as a background task or scheduled cron job.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import asyncio
import logging

from app.models import Booking, BookingStatus, BookingStatusHistory, CleanerProfile, CleanerStatus, PaymentStatus
from app.models.employee import Employee, EmployeeCleanerStatus
from app.services.events import event_publisher, EventType

logger = logging.getLogger(__name__)


class SLAMonitor:
    """
    Monitors job SLAs and detects delayed jobs.
    
    SLA Thresholds:
    - Job Start SLA: Job must start within 10 minutes of scheduled time
    - Job Completion SLA: Job must complete within 1.5x estimated duration
    """
    
    # SLA Thresholds
    JOB_START_THRESHOLD_MINUTES = 10
    COMPLETION_MULTIPLIER = 1.5

    # Payment timeout (auto-cancel unpaid bookings)
    PAYMENT_TIMEOUT_MINUTES = 15

    # Monitoring intervals
    CHECK_INTERVAL_SECONDS = 30
    
    def __init__(self, db: Session):
        self.db = db
        self._running = False
    
    def get_delayed_jobs(self) -> List[Dict[str, Any]]:
        """
        Find jobs that have breached their SLA.
        
        Returns jobs where:
        - Status is ASSIGNED and scheduled_time + threshold has passed
        - Status is IN_PROGRESS and started too late
        """
        now = datetime.now(timezone.utc)
        sla_threshold = timedelta(minutes=self.JOB_START_THRESHOLD_MINUTES)
        
        delayed_jobs = []
        
        # Query for assigned jobs that should have started
        assigned_delayed = self.db.query(Booking).filter(
            Booking.status == BookingStatus.ASSIGNED,
            or_(
                Booking.sla_deadline < now,
                Booking.scheduled_date + sla_threshold < now
            )
        ).all()
        
        for job in assigned_delayed:
            deadline = job.sla_deadline or (job.scheduled_date + sla_threshold)
            delay_seconds = (now - deadline).total_seconds()
            
            delayed_jobs.append({
                "job_id": job.id,
                "booking_number": job.booking_number,
                "status": job.status.value,
                "scheduled_date": job.scheduled_date.isoformat(),
                "sla_deadline": deadline.isoformat(),
                "delay_minutes": int(delay_seconds / 60),
                "cleaner_id": job.cleaner_id,
                "cleaner_name": job.cleaner.full_name if job.cleaner else None,
                "customer_id": job.customer_id,
                "customer_name": job.customer.full_name if job.customer else None,
                "type": "start_delayed"
            })
        
        # Query for in-progress jobs that haven't started on time
        in_progress_late = self.db.query(Booking).filter(
            Booking.status == BookingStatus.IN_PROGRESS,
            Booking.actual_start_time != None,
            Booking.sla_deadline != None,
            Booking.actual_start_time > Booking.sla_deadline
        ).all()
        
        for job in in_progress_late:
            delay_seconds = (job.actual_start_time - job.sla_deadline).total_seconds()
            
            delayed_jobs.append({
                "job_id": job.id,
                "booking_number": job.booking_number,
                "status": job.status.value,
                "scheduled_date": job.scheduled_date.isoformat(),
                "actual_start_time": job.actual_start_time.isoformat(),
                "sla_deadline": job.sla_deadline.isoformat(),
                "delay_minutes": int(delay_seconds / 60),
                "cleaner_id": job.cleaner_id,
                "cleaner_name": job.cleaner.full_name if job.cleaner else None,
                "customer_id": job.customer_id,
                "type": "started_late"
            })
        
        return delayed_jobs
    
    async def check_and_alert(self) -> int:
        """
        Check for SLA breaches and emit events.
        
        Returns the number of delayed jobs found.
        """
        delayed_jobs = self.get_delayed_jobs()
        
        for job in delayed_jobs:
            await event_publisher.publish(
                EventType.JOB_DELAYED,
                {
                    "job_id": job["job_id"],
                    "booking_number": job["booking_number"],
                    "delay_minutes": job["delay_minutes"],
                    "type": job["type"],
                    "cleaner_id": job.get("cleaner_id"),
                    "cleaner_name": job.get("cleaner_name"),
                    "customer_id": job.get("customer_id"),
                }
            )
        
        if delayed_jobs:
            logger.warning(f"SLA Alert: {len(delayed_jobs)} delayed jobs detected")
        
        return len(delayed_jobs)
    
    def get_orphaned_jobs(self, max_duration_hours: int = 4) -> List[Booking]:
        """
        Find jobs that have been in progress for too long.
        
        These may indicate a cleaner who forgot to complete the job.
        """
        now = datetime.now(timezone.utc)
        max_duration = timedelta(hours=max_duration_hours)
        
        orphaned = self.db.query(Booking).filter(
            Booking.status == BookingStatus.IN_PROGRESS,
            Booking.actual_start_time != None,
            Booking.actual_start_time < now - max_duration
        ).all()
        
        return orphaned
    
    def release_expired_cooldowns(self) -> int:
        """
        Release cleaners whose cooldown has expired.
        
        Returns the number of cleaners released.
        """
        now = datetime.now(timezone.utc)
        
        expired_profiles = self.db.query(CleanerProfile).filter(
            CleanerProfile.status == CleanerStatus.COOLING_DOWN,
            CleanerProfile.cooldown_expires_at != None,
            CleanerProfile.cooldown_expires_at < now
        ).all()
        
        for profile in expired_profiles:
            profile.status = CleanerStatus.AVAILABLE
            profile.cooldown_expires_at = None
            profile.active_job_count = 0
            logger.info(f"Released cleaner {profile.user_id} from cooldown")
        
        if expired_profiles:
            self.db.commit()

        return len(expired_profiles)

    def cancel_unpaid_bookings(self) -> int:
        """
        Cancel bookings that have been in PENDING status without payment
        for longer than PAYMENT_TIMEOUT_MINUTES.

        Returns the number of bookings cancelled.
        """
        now = datetime.now(timezone.utc)
        timeout = timedelta(minutes=self.PAYMENT_TIMEOUT_MINUTES)

        # Find bookings that are:
        # - Status PENDING (waiting for payment)
        # - Payment status PENDING
        # - Created more than 15 minutes ago
        stale_bookings = self.db.query(Booking).filter(
            Booking.status == BookingStatus.PENDING,
            Booking.payment_status == PaymentStatus.PENDING,
            Booking.created_at < now - timeout
        ).all()

        cancelled_count = 0
        for booking in stale_bookings:
            try:
                # Update booking status
                booking.status = BookingStatus.CANCELLED
                booking.cancelled_at = now
                booking.cancellation_reason = "Payment timeout - booking auto-cancelled after 15 minutes"

                # Record status history
                history = BookingStatusHistory(
                    booking_id=booking.id,
                    previous_status=BookingStatus.PENDING,
                    new_status=BookingStatus.CANCELLED,
                    changed_by_id=None,  # System action
                    reason="Auto-cancelled: Payment not received within 15 minutes"
                )
                self.db.add(history)

                cancelled_count += 1
                logger.info(
                    f"Auto-cancelled booking {booking.booking_number} due to payment timeout"
                )
            except Exception as e:
                logger.error(
                    f"Failed to auto-cancel booking {booking.booking_number}: {e}"
                )

        if cancelled_count > 0:
            self.db.commit()
            logger.warning(f"Payment timeout: {cancelled_count} bookings auto-cancelled")

        return cancelled_count

    def detect_offline_cleaners_with_active_jobs(self) -> List[Dict[str, Any]]:
        """
        Detect cleaners who are offline but have active jobs.

        This can happen due to:
        - App crash
        - Network disconnection
        - Cleaner forgetting to complete job

        Returns list of alerts for admin dashboard.
        """
        alerts = []

        # Check Employee-based cleaners (new system)
        # Find active jobs where assigned employee is OFFLINE
        active_employee_jobs = self.db.query(Booking).filter(
            Booking.assigned_employee_id != None,
            Booking.status.in_([BookingStatus.IN_PROGRESS])
        ).all()

        for job in active_employee_jobs:
            employee = self.db.query(Employee).filter(
                Employee.id == job.assigned_employee_id
            ).first()

            if employee and employee.cleaner_status == EmployeeCleanerStatus.OFFLINE:
                alerts.append({
                    "type": "cleaner_offline_active_job",
                    "job_id": job.id,
                    "booking_number": job.booking_number,
                    "job_status": job.status.value,
                    "cleaner_id": str(employee.id),
                    "cleaner_name": employee.full_name,
                    "employee_id": employee.employee_id,
                    "cleaner_status": employee.cleaner_status.value,
                    "scheduled_date": job.scheduled_date.isoformat() if job.scheduled_date else None,
                    "customer_id": job.customer_id,
                    "severity": "high",
                    "message": f"Cleaner {employee.full_name} is OFFLINE but has active job {job.booking_number}"
                })

        # Check User-based cleaners (legacy system)
        active_user_jobs = self.db.query(Booking).filter(
            Booking.cleaner_id != None,
            Booking.assigned_employee_id == None,  # Legacy only
            Booking.status.in_([BookingStatus.IN_PROGRESS])
        ).all()

        for job in active_user_jobs:
            profile = self.db.query(CleanerProfile).filter(
                CleanerProfile.user_id == job.cleaner_id
            ).first()

            if profile and profile.status == CleanerStatus.OFFLINE:
                alerts.append({
                    "type": "cleaner_offline_active_job",
                    "job_id": job.id,
                    "booking_number": job.booking_number,
                    "job_status": job.status.value,
                    "cleaner_id": job.cleaner_id,
                    "cleaner_name": job.cleaner.full_name if job.cleaner else "Unknown",
                    "cleaner_status": profile.status.value,
                    "scheduled_date": job.scheduled_date.isoformat() if job.scheduled_date else None,
                    "customer_id": job.customer_id,
                    "severity": "high",
                    "message": f"Cleaner is OFFLINE but has active job {job.booking_number}"
                })

        return alerts


# Background task runner
class BackgroundTaskRunner:
    """
    Runs background monitoring tasks.
    """
    
    def __init__(self):
        self._running = False
        self._tasks: List[asyncio.Task] = []
    
    async def start(self, db_session_factory):
        """Start background tasks."""
        self._running = True
        
        # Start SLA monitoring task
        self._tasks.append(
            asyncio.create_task(self._run_sla_monitor(db_session_factory))
        )
        
        # Start cooldown release task
        self._tasks.append(
            asyncio.create_task(self._run_cooldown_releaser(db_session_factory))
        )

        # Start payment timeout checker
        self._tasks.append(
            asyncio.create_task(self._run_payment_timeout_checker(db_session_factory))
        )

        # Start offline cleaner alert checker
        self._tasks.append(
            asyncio.create_task(self._run_offline_cleaner_checker(db_session_factory))
        )

        logger.info("Background tasks started")
    
    async def stop(self):
        """Stop all background tasks."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Background tasks stopped")
    
    async def _run_sla_monitor(self, db_session_factory):
        """Run SLA monitoring every 30 seconds."""
        while self._running:
            try:
                db = db_session_factory()
                try:
                    monitor = SLAMonitor(db)
                    await monitor.check_and_alert()
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"SLA monitor error: {e}")
            
            await asyncio.sleep(SLAMonitor.CHECK_INTERVAL_SECONDS)
    
    async def _run_cooldown_releaser(self, db_session_factory):
        """Release expired cooldowns every 60 seconds."""
        while self._running:
            try:
                db = db_session_factory()
                try:
                    monitor = SLAMonitor(db)
                    released = monitor.release_expired_cooldowns()
                    if released > 0:
                        logger.info(f"Released {released} cleaners from cooldown")
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Cooldown releaser error: {e}")

            await asyncio.sleep(60)

    async def _run_payment_timeout_checker(self, db_session_factory):
        """Cancel unpaid bookings every 5 minutes."""
        while self._running:
            try:
                db = db_session_factory()
                try:
                    monitor = SLAMonitor(db)
                    cancelled = monitor.cancel_unpaid_bookings()
                    if cancelled > 0:
                        # Publish events for cancelled bookings
                        await event_publisher.publish(
                            EventType.JOB_CANCELLED,
                            {
                                "reason": "payment_timeout",
                                "count": cancelled,
                                "message": f"{cancelled} bookings auto-cancelled due to payment timeout"
                            }
                        )
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Payment timeout checker error: {e}")

            await asyncio.sleep(300)  # Check every 5 minutes

    async def _run_offline_cleaner_checker(self, db_session_factory):
        """Check for offline cleaners with active jobs every 2 minutes."""
        while self._running:
            try:
                db = db_session_factory()
                try:
                    monitor = SLAMonitor(db)
                    alerts = monitor.detect_offline_cleaners_with_active_jobs()
                    if alerts:
                        # Publish alert for each problematic situation
                        for alert in alerts:
                            await event_publisher.publish(
                                EventType.CLEANER_OFFLINE_ALERT,
                                alert
                            )
                        logger.warning(
                            f"Offline cleaner alert: {len(alerts)} cleaners offline with active jobs"
                        )
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Offline cleaner checker error: {e}")

            await asyncio.sleep(120)  # Check every 2 minutes


# Global background task runner
background_runner = BackgroundTaskRunner()
