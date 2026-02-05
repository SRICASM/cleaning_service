"""
Database migration script for Admin Dashboard v2
Adds new columns and tables for job lifecycle management.

Run with: python -m app.migrations.admin_dashboard_v2
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
        print("Starting Admin Dashboard v2 migration...")
        
        # 1. Add new columns to bookings table
        print("1. Adding new columns to bookings table...")
        
        migration_queries = [
            # Add version column for optimistic locking
            """
            DO $$ BEGIN
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
            END $$;
            """,
            
            # Add new status values to enum
            """
            DO $$ BEGIN
                ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'pending_assignment';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'paused';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'failed';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """,
            
            # Add lifecycle timestamp columns
            """
            DO $$ BEGIN
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP WITH TIME ZONE;
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP WITH TIME ZONE;
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE;
                ALTER TABLE bookings ADD COLUMN IF NOT EXISTS failure_reason TEXT;
            END $$;
            """,
            
            # 2. Create cleaner_profiles table
            """
            CREATE TABLE IF NOT EXISTS cleaner_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
                status VARCHAR(20) DEFAULT 'offline' NOT NULL,
                active_job_count INTEGER DEFAULT 0 NOT NULL,
                cooldown_expires_at TIMESTAMP WITH TIME ZONE,
                cooldown_duration_minutes INTEGER DEFAULT 15,
                region_id INTEGER,
                current_latitude VARCHAR(20),
                current_longitude VARCHAR(20),
                last_location_update TIMESTAMP WITH TIME ZONE,
                total_jobs_completed INTEGER DEFAULT 0,
                total_jobs_failed INTEGER DEFAULT 0,
                average_rating VARCHAR(4),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_active_at TIMESTAMP WITH TIME ZONE
            );
            """,
            
            # 3. Add new columns to audit_logs table
            """
            DO $$ BEGIN
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) DEFAULT 'user';
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_state TEXT;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_state TEXT;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS extra_data TEXT;
            END $$;
            """,
            
            # 4. Create indexes for performance
            """
            CREATE INDEX IF NOT EXISTS idx_bookings_status_scheduled ON bookings(status, scheduled_date);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_bookings_cleaner_status ON bookings(cleaner_id, status);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_bookings_version ON bookings(id, version);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_status ON cleaner_profiles(status);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_region_status ON cleaner_profiles(region_id, status);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
            """,
        ]
        
        for i, query in enumerate(migration_queries):
            try:
                db.execute(text(query))
                db.commit()
                print(f"   Step {i + 1}/{len(migration_queries)} completed")
            except Exception as e:
                print(f"   Step {i + 1} warning: {e}")
                db.rollback()
        
        print("\n✅ Migration completed successfully!")
        print("\nNew features available:")
        print("  - New booking statuses: pending_assignment, paused, failed")
        print("  - Optimistic locking with version field")
        print("  - Lifecycle timestamps: sla_deadline, assigned_at, paused_at, resumed_at, failed_at")
        print("  - Cleaner profiles with status tracking")
        print("  - Enhanced audit logging")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()
