"""
Employee ID Generator Service

Generates unique employee IDs in format: CLN-{REGION}-{YYMM}-{SEQUENCE}
Example: CLN-DXB-2501-00042

Uses atomic counter with:
- Redis (if available) for distributed environments
- Database sequence as fallback
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
import logging

from app.models.employee import EmployeeIDSequence, RegionCode

logger = logging.getLogger(__name__)


class EmployeeIDGenerator:
    """
    Generates unique employee IDs with format: CLN-{REGION}-{YYMM}-{SEQUENCE}
    
    Thread-safe using database-level atomicity.
    """
    
    PREFIX = "CLN"
    SEQUENCE_PAD_LENGTH = 5  # 00001 to 99999
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate(self, region_code: str) -> str:
        """
        Generate a new unique employee ID.
        
        Args:
            region_code: 3-letter region code (DXB, AUH, etc.)
            
        Returns:
            Employee ID like "CLN-DXB-2501-00042"
        """
        # Validate region code
        if region_code not in [r.value for r in RegionCode]:
            raise ValueError(f"Invalid region code: {region_code}")
        
        # Get current year-month
        year_month = datetime.now().strftime("%y%m")  # e.g., "2501"
        
        # Get next sequence number atomically
        sequence = self._get_next_sequence(region_code, year_month)
        
        # Format sequence with padding
        padded_sequence = str(sequence).zfill(self.SEQUENCE_PAD_LENGTH)
        
        # Construct employee ID
        employee_id = f"{self.PREFIX}-{region_code}-{year_month}-{padded_sequence}"
        
        logger.info(f"Generated employee ID: {employee_id}")
        return employee_id
    
    def _get_next_sequence(self, region_code: str, year_month: str) -> int:
        """
        Get next sequence number atomically using database.
        
        Uses SELECT FOR UPDATE to ensure atomicity.
        """
        # Try to find existing sequence
        seq = self.db.query(EmployeeIDSequence).filter(
            and_(
                EmployeeIDSequence.region_code == region_code,
                EmployeeIDSequence.year_month == year_month
            )
        ).with_for_update().first()
        
        if seq:
            # Increment existing sequence
            seq.sequence += 1
            self.db.flush()
            return seq.sequence
        else:
            # Create new sequence starting at 1
            new_seq = EmployeeIDSequence(
                region_code=region_code,
                year_month=year_month,
                sequence=1
            )
            self.db.add(new_seq)
            self.db.flush()
            return 1
    
    def peek_next_id(self, region_code: str) -> str:
        """
        Preview what the next employee ID would be (without incrementing).
        
        Useful for UI preview.
        """
        year_month = datetime.now().strftime("%y%m")
        
        seq = self.db.query(EmployeeIDSequence).filter(
            and_(
                EmployeeIDSequence.region_code == region_code,
                EmployeeIDSequence.year_month == year_month
            )
        ).first()
        
        next_seq = (seq.sequence + 1) if seq else 1
        padded_sequence = str(next_seq).zfill(self.SEQUENCE_PAD_LENGTH)
        
        return f"{self.PREFIX}-{region_code}-{year_month}-{padded_sequence}"
    
    @staticmethod
    def parse_employee_id(employee_id: str) -> Optional[dict]:
        """
        Parse employee ID into components.
        
        Args:
            employee_id: ID like "CLN-DXB-2501-00042"
            
        Returns:
            Dict with prefix, region, year_month, sequence
        """
        try:
            parts = employee_id.split("-")
            if len(parts) != 4:
                return None
            
            prefix, region, year_month, sequence = parts
            
            return {
                "prefix": prefix,
                "region_code": region,
                "year_month": year_month,
                "year": f"20{year_month[:2]}",
                "month": year_month[2:],
                "sequence": int(sequence)
            }
        except Exception:
            return None
    
    @staticmethod
    def validate_employee_id(employee_id: str) -> bool:
        """
        Validate employee ID format.
        """
        import re
        pattern = r'^CLN-[A-Z]{3}-\d{4}-\d{5}$'
        return bool(re.match(pattern, employee_id))


# Convenience function
def generate_employee_id(db: Session, region_code: str) -> str:
    """Generate a new employee ID."""
    generator = EmployeeIDGenerator(db)
    return generator.generate(region_code)
