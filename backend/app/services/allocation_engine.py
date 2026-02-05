"""
Enhanced Allocation Engine

Real-time cleaner allocation with:
1. Redis-based queue management (with in-memory fallback)
2. Haversine distance calculation
3. Rating-based scoring
4. Configurable timeout with fallback
5. Allocation metrics tracking

Scoring Formula:
    Score = (queue_weight × queue_score) +
            (distance_weight × distance_score) +
            (rating_weight × rating_score)

Default Weights: Queue=40%, Distance=30%, Rating=30%
"""
import asyncio
import logging
import math
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Tuple, Any
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.employee import Employee, EmployeeAccountStatus, EmployeeCleanerStatus
from app.models.booking import Booking, BookingStatus
from app.models import Address
from app.services.cache import cache_service
from app.services.cleaner_assignment import (
    get_region_from_city, has_time_conflict, CITY_REGION_MAP
)

logger = logging.getLogger(__name__)


@dataclass
class AllocationConfig:
    """Configuration for allocation algorithm."""
    # Scoring weights (must sum to 1.0)
    queue_weight: float = 0.40
    distance_weight: float = 0.30
    rating_weight: float = 0.30

    # Timeout settings
    assignment_timeout_seconds: float = 3.0
    max_candidates_to_try: int = 5

    # Queue settings
    queue_ttl_seconds: int = 3600  # 1 hour
    status_ttl_seconds: int = 300  # 5 minutes

    # Fallback settings
    expand_to_adjacent_regions: bool = True
    fallback_to_any_region: bool = True


@dataclass
class CleanerCandidate:
    """A candidate cleaner with scoring info."""
    employee: Employee
    queue_score: float = 0.0
    distance_score: float = 0.0
    rating_score: float = 0.0
    total_score: float = 0.0
    distance_km: Optional[float] = None
    queue_position: int = 0


@dataclass
class AllocationResult:
    """Result of an allocation attempt."""
    success: bool
    assigned_employee: Optional[Employee] = None
    candidates_evaluated: int = 0
    allocation_time_ms: float = 0
    fallback_used: bool = False
    region_expanded: bool = False
    failure_reason: Optional[str] = None


# Adjacent region mappings for fallback
ADJACENT_REGIONS = {
    "DXB": ["SHJ", "AJM"],
    "SHJ": ["DXB", "AJM", "UAQ"],
    "AJM": ["DXB", "SHJ", "UAQ"],
    "UAQ": ["SHJ", "AJM", "RAK"],
    "RAK": ["UAQ", "FUJ"],
    "FUJ": ["RAK"],
    "AUH": [],  # Abu Dhabi is relatively isolated
}

# Default coordinates for UAE regions (city centers)
REGION_COORDINATES = {
    "DXB": (25.2048, 55.2708),   # Dubai
    "AUH": (24.4539, 54.3773),   # Abu Dhabi
    "SHJ": (25.3462, 55.4211),   # Sharjah
    "AJM": (25.4052, 55.5136),   # Ajman
    "RAK": (25.7895, 55.9432),   # Ras Al Khaimah
    "FUJ": (25.1288, 56.3264),   # Fujairah
    "UAQ": (25.5647, 55.5552),   # Umm Al Quwain
}


class AllocationEngine:
    """
    Enhanced allocation engine with Redis support and scoring algorithm.
    """

    def __init__(self, db: Session, config: Optional[AllocationConfig] = None):
        self.db = db
        self.config = config or AllocationConfig()

        # Redis key prefixes
        self._queue_key = "cleaner:queue:{region}"
        self._status_key = "cleaner:status:{cleaner_id}"
        self._metrics_key = "allocation:metrics:{date}"

    async def allocate_cleaner(
        self,
        booking: Booking,
        duration_hours: float = 2.5
    ) -> AllocationResult:
        """
        Allocate the best available cleaner for a booking.

        Algorithm:
        1. Get region from booking address
        2. Find candidates in region (with optional expansion)
        3. Score candidates by queue position, distance, rating
        4. Attempt assignment with timeout
        5. Track metrics
        """
        start_time = datetime.now(timezone.utc)

        # Extract region
        region_code = self._get_booking_region(booking)
        if not region_code:
            return AllocationResult(
                success=False,
                failure_reason="Could not determine booking region"
            )

        # Get booking coordinates
        booking_coords = self._get_booking_coordinates(booking)

        # Find candidates
        candidates = await self._get_scored_candidates(
            region_code=region_code,
            scheduled_date=booking.scheduled_date,
            duration_hours=duration_hours,
            booking_coords=booking_coords,
            exclude_booking_id=booking.id
        )

        region_expanded = False
        fallback_used = False

        # If no candidates, try adjacent regions
        if not candidates and self.config.expand_to_adjacent_regions:
            adjacent = ADJACENT_REGIONS.get(region_code, [])
            for adj_region in adjacent:
                adj_candidates = await self._get_scored_candidates(
                    region_code=adj_region,
                    scheduled_date=booking.scheduled_date,
                    duration_hours=duration_hours,
                    booking_coords=booking_coords,
                    exclude_booking_id=booking.id
                )
                candidates.extend(adj_candidates)
            if candidates:
                region_expanded = True

        # Final fallback: any region
        if not candidates and self.config.fallback_to_any_region:
            candidates = await self._get_all_available_candidates(
                scheduled_date=booking.scheduled_date,
                duration_hours=duration_hours,
                booking_coords=booking_coords,
                exclude_booking_id=booking.id
            )
            if candidates:
                fallback_used = True

        if not candidates:
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            await self._record_allocation_failure(region_code)
            return AllocationResult(
                success=False,
                candidates_evaluated=0,
                allocation_time_ms=elapsed,
                failure_reason="No available cleaners found"
            )

        # Sort by score (descending)
        candidates.sort(key=lambda c: c.total_score, reverse=True)

        # Attempt assignment with timeout
        assigned = None
        candidates_tried = 0

        for candidate in candidates[:self.config.max_candidates_to_try]:
            candidates_tried += 1
            try:
                assigned = await asyncio.wait_for(
                    self._attempt_assignment(candidate.employee, booking),
                    timeout=self.config.assignment_timeout_seconds
                )
                if assigned:
                    break
            except asyncio.TimeoutError:
                logger.warning(
                    f"Assignment timeout for cleaner {candidate.employee.id}, trying next"
                )
                continue

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        if assigned:
            # Update queue position (move to back)
            await self._update_queue_after_assignment(assigned, region_code)
            await self._record_allocation_success(region_code, elapsed)

            return AllocationResult(
                success=True,
                assigned_employee=assigned,
                candidates_evaluated=candidates_tried,
                allocation_time_ms=elapsed,
                fallback_used=fallback_used,
                region_expanded=region_expanded
            )

        await self._record_allocation_failure(region_code)
        return AllocationResult(
            success=False,
            candidates_evaluated=candidates_tried,
            allocation_time_ms=elapsed,
            fallback_used=fallback_used,
            region_expanded=region_expanded,
            failure_reason="All candidates rejected or timed out"
        )

    def _get_booking_region(self, booking: Booking) -> Optional[str]:
        """Extract region code from booking address."""
        if not booking.address or not booking.address.city:
            return None
        return get_region_from_city(booking.address.city)

    def _get_booking_coordinates(self, booking: Booking) -> Optional[Tuple[float, float]]:
        """Get coordinates for the booking address."""
        # First try address coordinates if stored
        if booking.address:
            # For now, use region center as fallback
            region = get_region_from_city(booking.address.city) if booking.address.city else None
            if region and region in REGION_COORDINATES:
                return REGION_COORDINATES[region]
        return None

    async def _get_scored_candidates(
        self,
        region_code: str,
        scheduled_date: datetime,
        duration_hours: float,
        booking_coords: Optional[Tuple[float, float]],
        exclude_booking_id: Optional[int] = None
    ) -> List[CleanerCandidate]:
        """
        Get all available candidates in a region with scores.
        """
        # Query available cleaners
        cleaners = self.db.query(Employee).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE,
            Employee.region_code == region_code
        ).all()

        candidates = []
        queue_positions = await self._get_queue_positions(region_code)

        for cleaner in cleaners:
            # Check time conflicts
            if has_time_conflict(
                cleaner.id,
                scheduled_date,
                duration_hours,
                self.db,
                exclude_booking_id
            ):
                continue

            # Calculate scores
            candidate = self._calculate_candidate_scores(
                cleaner,
                queue_positions,
                booking_coords
            )
            candidates.append(candidate)

        return candidates

    async def _get_all_available_candidates(
        self,
        scheduled_date: datetime,
        duration_hours: float,
        booking_coords: Optional[Tuple[float, float]],
        exclude_booking_id: Optional[int] = None
    ) -> List[CleanerCandidate]:
        """Get candidates from all regions as fallback."""
        cleaners = self.db.query(Employee).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE
        ).all()

        candidates = []

        for cleaner in cleaners:
            if has_time_conflict(
                cleaner.id,
                scheduled_date,
                duration_hours,
                self.db,
                exclude_booking_id
            ):
                continue

            # Get queue positions for cleaner's region
            queue_positions = await self._get_queue_positions(cleaner.region_code)
            candidate = self._calculate_candidate_scores(
                cleaner,
                queue_positions,
                booking_coords
            )
            candidates.append(candidate)

        return candidates

    def _calculate_candidate_scores(
        self,
        cleaner: Employee,
        queue_positions: Dict[str, int],
        booking_coords: Optional[Tuple[float, float]]
    ) -> CleanerCandidate:
        """Calculate all scoring components for a candidate."""
        # Queue score (lower position = higher score)
        queue_pos = queue_positions.get(str(cleaner.id), 999)
        max_pos = max(queue_positions.values()) if queue_positions else 1
        queue_score = 1.0 - (queue_pos / (max_pos + 1)) if max_pos > 0 else 0.5

        # Distance score
        distance_km = None
        distance_score = 0.5  # Default middle score if no coords

        if booking_coords and cleaner.region_code in REGION_COORDINATES:
            cleaner_coords = REGION_COORDINATES[cleaner.region_code]
            distance_km = self._haversine_distance(booking_coords, cleaner_coords)
            # Normalize: 0km = 1.0 score, 50km+ = 0.0 score
            distance_score = max(0, 1.0 - (distance_km / 50.0))

        # Rating score (0-5 normalized to 0-1)
        rating = float(cleaner.rating or 4.0)  # Default to 4.0 if no rating
        rating_score = rating / 5.0

        # Calculate total weighted score
        total_score = (
            self.config.queue_weight * queue_score +
            self.config.distance_weight * distance_score +
            self.config.rating_weight * rating_score
        )

        return CleanerCandidate(
            employee=cleaner,
            queue_score=queue_score,
            distance_score=distance_score,
            rating_score=rating_score,
            total_score=total_score,
            distance_km=distance_km,
            queue_position=queue_pos
        )

    def _haversine_distance(
        self,
        coord1: Tuple[float, float],
        coord2: Tuple[float, float]
    ) -> float:
        """
        Calculate distance between two coordinates using Haversine formula.

        Args:
            coord1: (latitude, longitude) of first point
            coord2: (latitude, longitude) of second point

        Returns:
            Distance in kilometers
        """
        R = 6371  # Earth's radius in kilometers

        lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
        lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))

        return R * c

    async def _get_queue_positions(self, region_code: str) -> Dict[str, int]:
        """
        Get queue positions for all cleaners in a region.
        Uses Redis sorted set if available, otherwise in-memory calculation.
        """
        cache_key = self._queue_key.format(region=region_code)

        # Try Redis first
        try:
            cached = await cache_service.get(cache_key)
            if cached:
                import json
                return json.loads(cached)
        except Exception:
            pass

        # Fallback: calculate from recent job completions
        return await self._calculate_queue_positions(region_code)

    async def _calculate_queue_positions(self, region_code: str) -> Dict[str, int]:
        """
        Calculate queue positions based on last job completion time.
        Cleaners who completed jobs earlier are at the front of the queue.
        """
        from sqlalchemy import desc

        # Get last completion time for each cleaner in region
        cleaners = self.db.query(Employee).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE,
            Employee.region_code == region_code
        ).all()

        cleaner_times = []
        for cleaner in cleaners:
            # Get most recent completed job
            last_job = self.db.query(Booking).filter(
                Booking.assigned_employee_id == cleaner.id,
                Booking.status == BookingStatus.COMPLETED,
                Booking.actual_end_time != None
            ).order_by(desc(Booking.actual_end_time)).first()

            if last_job and last_job.actual_end_time:
                cleaner_times.append((str(cleaner.id), last_job.actual_end_time))
            else:
                # No recent jobs = front of queue
                cleaner_times.append((str(cleaner.id), datetime.min.replace(tzinfo=timezone.utc)))

        # Sort by completion time (oldest first = front of queue)
        cleaner_times.sort(key=lambda x: x[1])

        # Assign positions (1-indexed)
        positions = {cid: pos + 1 for pos, (cid, _) in enumerate(cleaner_times)}

        # Cache the result
        try:
            import json
            await cache_service.set(
                self._queue_key.format(region=region_code),
                json.dumps(positions),
                ttl=self.config.queue_ttl_seconds
            )
        except Exception:
            pass

        return positions

    async def _attempt_assignment(
        self,
        cleaner: Employee,
        booking: Booking
    ) -> Optional[Employee]:
        """
        Attempt to assign a cleaner to a booking.
        Returns the cleaner if successful, None otherwise.
        """
        try:
            # Double-check availability (race condition protection)
            if has_time_conflict(
                cleaner.id,
                booking.scheduled_date,
                2.5,  # TODO: Get from booking
                self.db,
                booking.id
            ):
                return None

            # Assign
            booking.assigned_employee_id = cleaner.id
            booking.assigned_at = datetime.now(timezone.utc)

            # Calculate SLA deadline (scheduled time + 10 min buffer)
            booking.sla_deadline = booking.scheduled_date + timedelta(minutes=10)

            self.db.commit()

            logger.info(
                f"Allocated cleaner {cleaner.full_name} ({cleaner.employee_id}) "
                f"to booking {booking.booking_number}"
            )

            return cleaner

        except Exception as e:
            logger.error(f"Assignment failed: {e}")
            self.db.rollback()
            return None

    async def _update_queue_after_assignment(
        self,
        cleaner: Employee,
        region_code: str
    ):
        """Move cleaner to back of queue after assignment."""
        # Invalidate cache to force recalculation
        try:
            cache_key = self._queue_key.format(region=region_code)
            await cache_service.delete(cache_key)
        except Exception:
            pass

    async def _record_allocation_success(self, region_code: str, time_ms: float):
        """Record successful allocation metrics."""
        await self._record_metric(region_code, "success", time_ms)

    async def _record_allocation_failure(self, region_code: str):
        """Record failed allocation metrics."""
        await self._record_metric(region_code, "failure", 0)

    async def _record_metric(self, region_code: str, result: str, time_ms: float):
        """Record allocation metric to cache."""
        try:
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            cache_key = f"allocation:metrics:{region_code}:{date_str}"

            # Get existing metrics
            existing = await cache_service.get(cache_key)
            if existing:
                import json
                metrics = json.loads(existing)
            else:
                metrics = {
                    "total_allocations": 0,
                    "successful": 0,
                    "failed": 0,
                    "total_time_ms": 0,
                    "avg_time_ms": 0
                }

            metrics["total_allocations"] += 1
            if result == "success":
                metrics["successful"] += 1
                metrics["total_time_ms"] += time_ms
                metrics["avg_time_ms"] = metrics["total_time_ms"] / metrics["successful"]
            else:
                metrics["failed"] += 1

            import json
            await cache_service.set(cache_key, json.dumps(metrics), ttl=86400)

        except Exception as e:
            logger.debug(f"Could not record metric: {e}")

    async def get_allocation_metrics(
        self,
        region_code: Optional[str] = None,
        date_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get allocation metrics for dashboard.

        Returns:
            {
                "total_allocations": int,
                "successful": int,
                "failed": int,
                "success_rate": float,
                "avg_time_ms": float,
                "by_region": {region: metrics}
            }
        """
        date_str = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")

        all_metrics = {
            "date": date_str,
            "total_allocations": 0,
            "successful": 0,
            "failed": 0,
            "success_rate": 0.0,
            "avg_time_ms": 0.0,
            "by_region": {}
        }

        regions = [region_code] if region_code else list(REGION_COORDINATES.keys())

        total_time = 0
        for region in regions:
            try:
                cache_key = f"allocation:metrics:{region}:{date_str}"
                cached = await cache_service.get(cache_key)
                if cached:
                    import json
                    metrics = json.loads(cached)
                    all_metrics["by_region"][region] = metrics
                    all_metrics["total_allocations"] += metrics.get("total_allocations", 0)
                    all_metrics["successful"] += metrics.get("successful", 0)
                    all_metrics["failed"] += metrics.get("failed", 0)
                    total_time += metrics.get("total_time_ms", 0)
            except Exception:
                pass

        if all_metrics["total_allocations"] > 0:
            all_metrics["success_rate"] = (
                all_metrics["successful"] / all_metrics["total_allocations"] * 100
            )

        if all_metrics["successful"] > 0:
            all_metrics["avg_time_ms"] = total_time / all_metrics["successful"]

        return all_metrics

    async def get_queue_status(self, region_code: str) -> List[Dict[str, Any]]:
        """
        Get current queue status for a region (for admin dashboard).

        Returns list of cleaners with their queue positions and status.
        """
        positions = await self._get_queue_positions(region_code)

        cleaners = self.db.query(Employee).filter(
            Employee.account_status == EmployeeAccountStatus.ACTIVE,
            Employee.region_code == region_code
        ).all()

        queue_status = []
        for cleaner in cleaners:
            pos = positions.get(str(cleaner.id), 999)

            # Get today's booking count
            today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
            booking_count = self.db.query(func.count(Booking.id)).filter(
                Booking.assigned_employee_id == cleaner.id,
                Booking.scheduled_date >= today,
                Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.NO_SHOW])
            ).scalar() or 0

            queue_status.append({
                "employee_id": str(cleaner.id),
                "employee_number": cleaner.employee_id,
                "name": cleaner.full_name,
                "queue_position": pos,
                "status": cleaner.cleaner_status.value if cleaner.cleaner_status else "unknown",
                "rating": float(cleaner.rating) if cleaner.rating else None,
                "todays_bookings": booking_count
            })

        # Sort by queue position
        queue_status.sort(key=lambda x: x["queue_position"])

        return queue_status


# Convenience function for backwards compatibility
async def enhanced_auto_assign(
    booking: Booking,
    db: Session,
    duration_hours: float = 2.5
) -> Optional[Employee]:
    """
    Enhanced auto-assignment using the new allocation engine.
    Falls back to basic assignment if engine fails.
    """
    engine = AllocationEngine(db)
    result = await engine.allocate_cleaner(booking, duration_hours)

    if result.success:
        return result.assigned_employee

    # Fallback to basic assignment
    from app.services.cleaner_assignment import auto_assign_cleaner
    return auto_assign_cleaner(booking, db, duration_hours)
