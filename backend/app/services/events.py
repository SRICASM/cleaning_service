"""
Event Publisher Service

Simple event publishing system for real-time updates.
For MVP: Uses in-memory pub/sub with asyncio.
Production: Can be extended to use Redis pub/sub, Kafka, or AWS SQS.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import logging

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Event types for the cleaning service."""
    # Job lifecycle events
    JOB_CREATED = "job.created"
    JOB_ASSIGNED = "job.assigned"
    JOB_STARTED = "job.started"
    JOB_PAUSED = "job.paused"
    JOB_RESUMED = "job.resumed"
    JOB_COMPLETED = "job.completed"
    JOB_CANCELLED = "job.cancelled"
    JOB_FAILED = "job.failed"
    JOB_DELAYED = "job.delayed"
    
    # Cleaner events
    CLEANER_ONLINE = "cleaner.online"
    CLEANER_OFFLINE = "cleaner.offline"
    CLEANER_STATUS_CHANGED = "cleaner.status_changed"
    CLEANER_OFFLINE_ALERT = "cleaner.offline_alert"  # Cleaner offline with active job

    # Dashboard events
    STATS_UPDATED = "stats.updated"
    ADMIN_ALERT = "admin.alert"  # General admin alerts


@dataclass
class Event:
    """Event data structure."""
    type: EventType
    payload: Dict[str, Any]
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    event_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "event_id": self.event_id
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class EventPublisher:
    """
    Simple in-memory event publisher with subscriber management.
    
    Usage:
        publisher = EventPublisher()
        
        # Subscribe to events
        async def handler(event):
            print(f"Received: {event.type}")
        
        publisher.subscribe(EventType.JOB_COMPLETED, handler)
        
        # Publish events
        await publisher.publish(EventType.JOB_COMPLETED, {"job_id": 123})
    """
    
    _instance: Optional['EventPublisher'] = None
    
    def __new__(cls):
        """Singleton pattern for global event publisher."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._subscribers: Dict[EventType, List[Callable]] = {}
        self._global_subscribers: List[Callable] = []
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._initialized = True
    
    def subscribe(self, event_type: EventType, callback: Callable) -> None:
        """Subscribe to a specific event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)
        logger.debug(f"Subscribed to {event_type.value}")
    
    def subscribe_all(self, callback: Callable) -> None:
        """Subscribe to all events."""
        self._global_subscribers.append(callback)
        logger.debug("Subscribed to all events")
    
    def unsubscribe(self, event_type: EventType, callback: Callable) -> None:
        """Unsubscribe from a specific event type."""
        if event_type in self._subscribers:
            try:
                self._subscribers[event_type].remove(callback)
            except ValueError:
                pass
    
    def unsubscribe_all(self, callback: Callable) -> None:
        """Unsubscribe from all events."""
        try:
            self._global_subscribers.remove(callback)
        except ValueError:
            pass
    
    async def publish(self, event_type: EventType, payload: Dict[str, Any]) -> Event:
        """Publish an event to all subscribers."""
        import uuid
        
        event = Event(
            type=event_type,
            payload=payload,
            event_id=str(uuid.uuid4())
        )
        
        logger.info(f"Publishing event: {event_type.value} - {event.event_id}")
        
        # Notify type-specific subscribers
        if event_type in self._subscribers:
            for callback in self._subscribers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event)
                    else:
                        callback(event)
                except Exception as e:
                    logger.error(f"Error in event handler: {e}")
        
        # Notify global subscribers
        for callback in self._global_subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                logger.error(f"Error in global event handler: {e}")
        
        return event
    
    async def publish_job_event(
        self,
        event_type: EventType,
        job_id: int,
        booking_number: str,
        status: str,
        cleaner_id: Optional[int] = None,
        cleaner_name: Optional[str] = None,
        customer_id: Optional[int] = None,
        additional_data: Optional[Dict] = None
    ) -> Event:
        """Convenience method for publishing job-related events."""
        payload = {
            "job_id": job_id,
            "booking_number": booking_number,
            "status": status,
            "cleaner_id": cleaner_id,
            "cleaner_name": cleaner_name,
            "customer_id": customer_id,
        }
        if additional_data:
            payload.update(additional_data)
        
        return await self.publish(event_type, payload)
    
    async def publish_cleaner_event(
        self,
        event_type: EventType,
        cleaner_id: int,
        cleaner_name: str,
        status: str,
        additional_data: Optional[Dict] = None
    ) -> Event:
        """Convenience method for publishing cleaner-related events."""
        payload = {
            "cleaner_id": cleaner_id,
            "cleaner_name": cleaner_name,
            "status": status,
        }
        if additional_data:
            payload.update(additional_data)
        
        return await self.publish(event_type, payload)


# Global event publisher instance
event_publisher = EventPublisher()


# Helper functions for common events
async def emit_job_assigned(job, cleaner):
    """Emit event when a job is assigned to a cleaner."""
    await event_publisher.publish_job_event(
        EventType.JOB_ASSIGNED,
        job_id=job.id,
        booking_number=job.booking_number,
        status=job.status.value,
        cleaner_id=cleaner.id if cleaner else None,
        cleaner_name=cleaner.full_name if cleaner else None,
        customer_id=job.customer_id
    )


async def emit_job_started(job, cleaner):
    """Emit event when a cleaner starts a job."""
    await event_publisher.publish_job_event(
        EventType.JOB_STARTED,
        job_id=job.id,
        booking_number=job.booking_number,
        status=job.status.value,
        cleaner_id=cleaner.id,
        cleaner_name=cleaner.full_name,
        customer_id=job.customer_id,
        additional_data={"started_at": job.actual_start_time.isoformat() if job.actual_start_time else None}
    )


async def emit_job_completed(job, cleaner):
    """Emit event when a job is completed."""
    await event_publisher.publish_job_event(
        EventType.JOB_COMPLETED,
        job_id=job.id,
        booking_number=job.booking_number,
        status=job.status.value,
        cleaner_id=cleaner.id,
        cleaner_name=cleaner.full_name,
        customer_id=job.customer_id,
        additional_data={
            "completed_at": job.actual_end_time.isoformat() if job.actual_end_time else None,
            "total_price": float(job.total_price) if job.total_price else 0
        }
    )


async def emit_cleaner_status_changed(cleaner_id: int, name: str, new_status: str):
    """Emit event when cleaner status changes."""
    await event_publisher.publish_cleaner_event(
        EventType.CLEANER_STATUS_CHANGED,
        cleaner_id=cleaner_id,
        cleaner_name=name,
        status=new_status
    )
