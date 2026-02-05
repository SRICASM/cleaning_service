"""
Add assigned_employee_id to bookings

Adds a UUID foreign key to bookings table pointing to employees table.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.database import engine, SessionLocal

def run_migration():
    """Execute the migration."""
    db = SessionLocal()
    
    try:
        print("Starting Booking-Employee Link migration...")
        
        # Add assigned_employee_id column
        try:
            db.execute(text("""
                ALTER TABLE bookings 
                ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES employees(id);
            """))
            
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_bookings_employee 
                ON bookings(assigned_employee_id);
            """))
            
            db.commit()
            print("✅ Added assigned_employee_id column to bookings")
            
        except Exception as e:
            print(f"⚠️ Error adding column (might exist): {e}")
            db.rollback()
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
