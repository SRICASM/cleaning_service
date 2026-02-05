"""
Availability API - Real-time slot availability and expert matching
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.booking import Booking, BookingStatus, TimeSlot
from app.models.employee import Employee

router = APIRouter(prefix="/availability", tags=["availability"])


# Response schemas
class TimeSlotResponse(BaseModel):
    value: str  # "09:00"
    display: str  # "9:00 AM"
    available: bool
    expert_count: int


class AvailabilityResponse(BaseModel):
    date: str
    unavailable_slots: List[str]
    available_experts: int
    slots: Optional[List[TimeSlotResponse]] = None
    busy_message: Optional[str] = None


class ExpertAvailabilityResponse(BaseModel):
    expert_id: str
    name: str
    rating: Optional[float]
    completed_jobs: int
    available: bool


# Helper functions
def generate_time_slots(start_hour: int = 7, end_hour: int = 21, interval_minutes: int = 15):
    """Generate time slots for a day with given interval."""
    slots = []
    current = datetime.now().replace(hour=start_hour, minute=0, second=0, microsecond=0)
    end = datetime.now().replace(hour=end_hour, minute=0, second=0, microsecond=0)

    while current < end:
        hour = current.hour
        minute = current.minute
        period = "AM" if hour < 12 else "PM"
        display_hour = hour if hour <= 12 else hour - 12
        if display_hour == 0:
            display_hour = 12

        slots.append({
            "value": f"{hour:02d}:{minute:02d}",
            "display": f"{display_hour}:{minute:02d} {period}",
            "hour": hour,
            "minute": minute
        })

        current += timedelta(minutes=interval_minutes)

    return slots


def get_booked_slots(db: Session, check_date: date) -> List[str]:
    """Get list of time slots that are already heavily booked."""
    # Query bookings for the date
    start_of_day = datetime.combine(check_date, datetime.min.time())
    end_of_day = datetime.combine(check_date, datetime.max.time())

    # Get active bookings (not cancelled)
    active_statuses = [
        BookingStatus.PENDING,
        BookingStatus.PENDING_ASSIGNMENT,
        BookingStatus.CONFIRMED,
        BookingStatus.ASSIGNED,
        BookingStatus.IN_PROGRESS
    ]

    bookings = db.query(Booking).filter(
        and_(
            Booking.scheduled_date >= start_of_day,
            Booking.scheduled_date <= end_of_day,
            Booking.status.in_(active_statuses)
        )
    ).all()

    # Count bookings per time slot
    slot_counts = {}
    for booking in bookings:
        slot_time = booking.scheduled_date.strftime("%H:%M")
        slot_counts[slot_time] = slot_counts.get(slot_time, 0) + 1

    # Get max capacity from settings or use default
    max_per_slot = 5  # Maximum concurrent bookings per slot

    # Return slots that are at capacity
    unavailable = [slot for slot, count in slot_counts.items() if count >= max_per_slot]

    return unavailable


def get_available_expert_count(db: Session, check_date: date, check_time: Optional[str] = None) -> int:
    """Get count of available experts/cleaners for a date/time."""
    # Query active employees
    try:
        active_employees = db.query(Employee).filter(
            Employee.status == "ACTIVE"
        ).count()
    except Exception:
        # If Employee model doesn't have status field, just count all
        active_employees = db.query(Employee).count()

    if active_employees == 0:
        # Return mock data if no employees in system
        return 8

    # If time is specified, check who's already booked
    if check_time:
        start_of_day = datetime.combine(check_date, datetime.min.time())
        end_of_day = datetime.combine(check_date, datetime.max.time())

        # Parse time
        hour, minute = map(int, check_time.split(":"))
        slot_start = datetime.combine(check_date, datetime.min.time()).replace(hour=hour, minute=minute)
        slot_end = slot_start + timedelta(hours=2)  # Assume 2-hour window

        # Get assigned bookings in this time window
        assigned_employees = db.query(func.count(func.distinct(Booking.assigned_employee_id))).filter(
            and_(
                Booking.scheduled_date >= slot_start,
                Booking.scheduled_date <= slot_end,
                Booking.assigned_employee_id.isnot(None),
                Booking.status.in_([
                    BookingStatus.ASSIGNED,
                    BookingStatus.IN_PROGRESS
                ])
            )
        ).scalar() or 0

        return max(0, active_employees - assigned_employees)

    return active_employees


# API Endpoints
@router.get("/slots", response_model=AvailabilityResponse)
def get_available_slots(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    duration: int = Query(60, description="Duration in minutes"),
    db: Session = Depends(get_db)
):
    """
    Get available time slots for a specific date.
    Returns list of unavailable slots and count of available experts.
    """
    try:
        check_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Don't allow booking in the past
    today = datetime.now().date()
    if check_date < today:
        raise HTTPException(status_code=400, detail="Cannot check availability for past dates")

    # Get unavailable slots
    unavailable_slots = get_booked_slots(db, check_date)

    # For today, also mark past times as unavailable
    if check_date == today:
        now = datetime.now()
        buffer_time = now + timedelta(minutes=60)  # 1 hour buffer

        all_slots = generate_time_slots()
        for slot in all_slots:
            slot_time = datetime.combine(check_date, datetime.min.time()).replace(
                hour=slot["hour"], minute=slot["minute"]
            )
            if slot_time <= buffer_time and slot["value"] not in unavailable_slots:
                unavailable_slots.append(slot["value"])

    # Get available expert count
    expert_count = get_available_expert_count(db, check_date)

    # Generate busy message if needed
    busy_message = None
    if expert_count == 0:
        busy_message = "All experts are currently busy. Please try a different time."
    elif expert_count <= 2:
        busy_message = "Limited availability. Book soon to secure your slot!"

    return AvailabilityResponse(
        date=date,
        unavailable_slots=unavailable_slots,
        available_experts=expert_count,
        busy_message=busy_message
    )


@router.get("/slots/detailed")
def get_detailed_slots(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """
    Get detailed time slot information including availability per slot.
    """
    try:
        check_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Get unavailable slots
    unavailable_slots = get_booked_slots(db, check_date)

    # Generate all slots with availability
    all_slots = generate_time_slots()
    today = datetime.now().date()
    now = datetime.now()
    buffer_time = now + timedelta(minutes=60)

    detailed_slots = []
    for slot in all_slots:
        is_available = slot["value"] not in unavailable_slots

        # Mark past times as unavailable for today
        if check_date == today:
            slot_time = datetime.combine(check_date, datetime.min.time()).replace(
                hour=slot["hour"], minute=slot["minute"]
            )
            if slot_time <= buffer_time:
                is_available = False

        expert_count = get_available_expert_count(db, check_date, slot["value"]) if is_available else 0

        detailed_slots.append(TimeSlotResponse(
            value=slot["value"],
            display=slot["display"],
            available=is_available,
            expert_count=expert_count
        ))

    return {
        "date": date,
        "slots": detailed_slots,
        "total_available": sum(1 for s in detailed_slots if s.available)
    }


@router.get("/experts")
def get_available_experts(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    time: str = Query(..., description="Time in HH:MM format"),
    db: Session = Depends(get_db)
):
    """
    Get list of available experts for a specific date and time.
    """
    try:
        check_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    try:
        hour, minute = map(int, time.split(":"))
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    # Get all active employees
    try:
        employees = db.query(Employee).filter(
            Employee.status == "ACTIVE"
        ).all()
    except Exception:
        employees = db.query(Employee).all()

    if not employees:
        # Return mock data
        return {
            "date": date,
            "time": time,
            "experts": [
                {"id": "mock-1", "name": "Ahmed K.", "rating": 4.8, "completed_jobs": 156, "available": True},
                {"id": "mock-2", "name": "Fatima M.", "rating": 4.9, "completed_jobs": 203, "available": True},
                {"id": "mock-3", "name": "Omar S.", "rating": 4.7, "completed_jobs": 89, "available": True},
            ]
        }

    # Check which employees are already booked at this time
    slot_start = datetime.combine(check_date, datetime.min.time()).replace(hour=hour, minute=minute)
    slot_end = slot_start + timedelta(hours=2)

    booked_employee_ids = db.query(Booking.assigned_employee_id).filter(
        and_(
            Booking.scheduled_date >= slot_start,
            Booking.scheduled_date <= slot_end,
            Booking.assigned_employee_id.isnot(None),
            Booking.status.in_([
                BookingStatus.ASSIGNED,
                BookingStatus.IN_PROGRESS,
                BookingStatus.PENDING_ASSIGNMENT
            ])
        )
    ).all()
    booked_ids = {str(eid[0]) for eid in booked_employee_ids if eid[0]}

    # Build response
    expert_list = []
    for emp in employees:
        is_available = str(emp.id) not in booked_ids

        # Get completed jobs count
        completed_jobs = db.query(func.count(Booking.id)).filter(
            and_(
                Booking.assigned_employee_id == emp.id,
                Booking.status == BookingStatus.COMPLETED
            )
        ).scalar() or 0

        expert_list.append({
            "id": str(emp.id),
            "name": f"{emp.first_name} {emp.last_name[0] if emp.last_name else ''}.",
            "rating": float(emp.rating) if hasattr(emp, 'rating') and emp.rating else 4.5,
            "completed_jobs": completed_jobs,
            "available": is_available
        })

    # Sort by rating and availability
    expert_list.sort(key=lambda x: (-x["available"], -x["rating"], -x["completed_jobs"]))

    return {
        "date": date,
        "time": time,
        "experts": expert_list,
        "available_count": sum(1 for e in expert_list if e["available"])
    }


@router.get("/check")
def check_instant_availability(
    db: Session = Depends(get_db)
):
    """
    Quick check if instant booking is available right now.
    Used for showing availability indicator on homepage.
    """
    today = datetime.now().date()
    now = datetime.now()

    # Get available expert count for the rest of today
    expert_count = get_available_expert_count(db, today)

    # Get next available slot
    buffer_time = now + timedelta(minutes=60)
    all_slots = generate_time_slots()
    unavailable = get_booked_slots(db, today)

    next_available = None
    for slot in all_slots:
        slot_time = datetime.combine(today, datetime.min.time()).replace(
            hour=slot["hour"], minute=slot["minute"]
        )
        if slot_time > buffer_time and slot["value"] not in unavailable:
            next_available = slot["display"]
            break

    # Determine availability status
    if expert_count == 0:
        status = "busy"
        message = "All experts busy today"
    elif expert_count <= 2:
        status = "limited"
        message = f"Only {expert_count} experts available"
    else:
        status = "available"
        message = f"{expert_count} experts available"

    return {
        "status": status,
        "message": message,
        "expert_count": expert_count,
        "next_available_slot": next_available,
        "instant_booking_enabled": expert_count > 0
    }
