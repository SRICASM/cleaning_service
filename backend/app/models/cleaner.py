"""
Cleaner Profile model for managing cleaner availability and job assignments.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class CleanerStatus(str, enum.Enum):
    """Cleaner availability states."""
    AVAILABLE = "available"        # Ready to accept new jobs
    BUSY = "busy"                  # Currently working on a job
    COOLING_DOWN = "cooling_down"  # Just finished, in cooldown period
    OFFLINE = "offline"            # Not accepting jobs


class CleanerProfile(Base):
    """
    Extended profile for users with cleaner role.
    Tracks availability, current job, and performance metrics.
    """
    __tablename__ = "cleaner_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Availability
    status = Column(SQLEnum(CleanerStatus), default=CleanerStatus.OFFLINE, nullable=False, index=True)
    active_job_count = Column(Integer, default=0, nullable=False)
    
    # Cooldown management
    cooldown_expires_at = Column(DateTime(timezone=True), nullable=True)
    cooldown_duration_minutes = Column(Integer, default=15)  # Default 15 min cooldown
    
    # Location/Region
    region_id = Column(Integer, nullable=True, index=True)
    current_latitude = Column(String(20), nullable=True)
    current_longitude = Column(String(20), nullable=True)
    last_location_update = Column(DateTime(timezone=True), nullable=True)
    
    # Performance metrics
    total_jobs_completed = Column(Integer, default=0)
    total_jobs_failed = Column(Integer, default=0)
    average_rating = Column(String(4), nullable=True)  # e.g., "4.85"
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="cleaner_profile")
