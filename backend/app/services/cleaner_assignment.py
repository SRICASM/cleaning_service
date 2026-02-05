"""
Automatic Cleaner Assignment Service

Assigns cleaners to bookings automatically based on:
1. Region match (cleaner region = booking address city/region)
2. Account status (ACTIVE only)
3. Workload balance (prefer fewer bookings that day)
4. Time conflict check (no overlapping bookings)
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
import logging

from app.models.employee import Employee, EmployeeAccountStatus, RegionCode
from app.models.booking import Booking, BookingStatus

logger = logging.getLogger(__name__)


# City to Region mapping for UAE
CITY_REGION_MAP = {
    "dubai": "DXB",
    "abu dhabi": "AUH",
    "sharjah": "SHJ",
    "ajman": "AJM",
    "ras al khaimah": "RAK",
    "fujairah": "FUJ",
    "umm al quwain": "UAQ",
    # Common variations
    "dxb": "DXB",
    "abudhabi": "AUH",
}


def get_region_from_city(city: str) -> Optional[str]:
    """Map city name to region code."""
    if not city:
        return None
    city_lower = city.lower().strip()
    return CITY_REGION_MAP.get(city_lower)


def find_available_cleaners(
    region_code: str,
    scheduled_date: datetime,
    db: Session
) -> List[Employee]:
    """
    Find all active employees in the given region.
    
    Returns list of employees who are:
    - ACTIVE account status
    - In the matching region
    """
    cleaners = db.query(Employee).filter(
        Employee.account_status == EmployeeAccountStatus.ACTIVE,
        Employee.region_code == region_code
    ).all()
    
    return cleaners


def get_cleaner_booking_count(
    cleaner_id: int,
    date: datetime,
    db: Session
) -> int:
    """Count how many bookings a cleaner has on a specific date."""
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    count = db.query(func.count(Booking.id)).filter(
        Booking.assigned_employee_id == cleaner_id,
        Booking.scheduled_date >= start_of_day,
        Booking.scheduled_date < end_of_day,
        Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.NO_SHOW])
    ).scalar()
    
    return count or 0


def has_time_conflict(
    cleaner_id: int,
    scheduled_date: datetime,
    duration_hours: float,
    db: Session,
    exclude_booking_id: Optional[int] = None
) -> bool:
    """
    Check if cleaner has a booking that overlaps with the given time slot.
    
    A booking is considered conflicting if:
    - It starts before this booking ends, AND
    - It ends after this booking starts
    """
    # Calculate this booking's time window
    booking_start = scheduled_date
    booking_end = scheduled_date + timedelta(hours=duration_hours)
    
    # Query for overlapping bookings
    query = db.query(Booking).filter(
        Booking.assigned_employee_id == cleaner_id,
        Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.NO_SHOW]),
        # Overlap check: existing booking starts before new ends AND ends after new starts
        Booking.scheduled_date < booking_end,
    )
    
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
    
    # For each potential conflict, check if it actually overlaps
    for existing in query.all():
        existing_end = existing.scheduled_end_time or (
            existing.scheduled_date + timedelta(hours=2.5)  # Default duration
        )
        if existing_end > booking_start:
            return True
    
    return False


def select_best_cleaner(
    cleaners: List[Employee],
    scheduled_date: datetime,
    duration_hours: float,
    db: Session,
    exclude_booking_id: Optional[int] = None
) -> Optional[Employee]:
    """
    Select the best cleaner from available candidates.
    
    Priority:
    1. No time conflicts
    2. Lowest workload (fewest bookings that day)
    """
    candidates: List[Tuple[Employee, int]] = []
    
    for cleaner in cleaners:
        # Check for time conflicts
        if has_time_conflict(
            cleaner.id,
            scheduled_date,
            duration_hours,
            db,
            exclude_booking_id
        ):
            continue
        
        # Get booking count for workload balancing
        booking_count = get_cleaner_booking_count(cleaner.id, scheduled_date, db)
        candidates.append((cleaner, booking_count))
    
    if not candidates:
        return None
    
    # Sort by booking count (ascending) to prefer less busy cleaners
    candidates.sort(key=lambda x: x[1])
    
    return candidates[0][0]


def auto_assign_cleaner(
    booking: Booking,
    db: Session,
    duration_hours: float = 2.5
) -> Optional[Employee]:
    """
    Automatically assign a cleaner to a booking.
    
    Args:
        booking: The booking to assign a cleaner to
        db: Database session
        duration_hours: Expected duration of the cleaning job
    
    Returns:
        The assigned Employee, or None if no suitable cleaner found
    """
    # Get booking region from address
    if not booking.address:
        logger.warning(f"Booking {booking.id} has no address, cannot auto-assign")
        return None
    
    city = booking.address.city
    region_code = get_region_from_city(city)
    
    if not region_code:
        logger.warning(f"Unknown city '{city}' for booking {booking.id}, cannot determine region")
        # Try to assign from any region as fallback
        region_code = None
    
    # Find available cleaners
    if region_code:
        cleaners = find_available_cleaners(region_code, booking.scheduled_date, db)
    else:
        # Fallback: get all active cleaners
        cleaners = db.query(Employee).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE
        ).all()
    
    if not cleaners:
        logger.warning(f"No active cleaners found in region {region_code} for booking {booking.id}")
        return None
    
    # Select the best cleaner
    assigned_cleaner = select_best_cleaner(
        cleaners,
        booking.scheduled_date,
        duration_hours,
        db,
        exclude_booking_id=booking.id
    )
    
    if assigned_cleaner:
        # Assign the cleaner to the booking
        booking.assigned_employee_id = assigned_cleaner.id
        db.commit()
        logger.info(
            f"Auto-assigned cleaner {assigned_cleaner.full_name} ({assigned_cleaner.employee_id}) "
            f"to booking {booking.booking_number}"
        )
        return assigned_cleaner
    
    logger.warning(f"No suitable cleaner found for booking {booking.id}")
    return None


def assign_backlog_to_cleaner(
    cleaner: Employee,
    db: Session,
    limit: int = 10
) -> int:
    """
    Attempt to assign unassigned bookings to this specific cleaner.
    Useful when a new cleaner is added or becomes active.
    
    Args:
        cleaner: The employee to assign jobs to
        db: Database session
        limit: Max number of jobs to assign
        
    Returns:
        Number of bookings assigned
    """
    if cleaner.account_status != EmployeeAccountStatus.ACTIVE:
        return 0
        
    # Find active unassigned bookings
    # Priority: Older bookings first
    bookings = db.query(Booking).filter(
        Booking.assigned_employee_id == None,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS])
    ).order_by(Booking.scheduled_date.asc()).all()
    
    assigned_count = 0
    
    for booking in bookings:
        if assigned_count >= limit:
            break
            
        # Check region match
        # If booking has address, check if it matches cleaner's region
        if booking.address and booking.address.city:
            region = get_region_from_city(booking.address.city)
            # If region is known and doesn't match, skip
            # If region is unknown (None), we allow assignment (fallback behavior)
            if region and region != cleaner.region_code:
                continue
        
        # Check for time conflicts
        # Default to 2.5 hours if not specified
        duration = 2.5 
        # TODO: Get actual duration from service/booking
        
        if has_time_conflict(cleaner.id, booking.scheduled_date, duration, db):
            continue
            
        # Assign the booking
        booking.assigned_employee_id = cleaner.id
        # If it was pending, maybe confirm it? Keeping status as is for now.
        
        assigned_count += 1
        logger.info(
            f"Backlog assignment: Assigned booking {booking.booking_number} "
            f"to new cleaner {cleaner.full_name}"
        )
    
    if assigned_count > 0:
        db.commit()
        
    return assigned_count
