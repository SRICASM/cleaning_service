"""
Add password support for employees

Adds email and hashed_password columns to employees table.
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
        print("Starting Employee Password Migration...")
        
        # Add email column
        try:
            db.execute(text("""
                ALTER TABLE employees 
                ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
            """))
            print("✅ Added email column")
        except Exception as e:
            print(f"⚠️ Error adding email column: {e}")

        # Add hashed_password column
        try:
            db.execute(text("""
                ALTER TABLE employees 
                ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);
            """))
            print("✅ Added hashed_password column")
        except Exception as e:
            print(f"⚠️ Error adding hashed_password column: {e}")
            
        db.commit()
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
