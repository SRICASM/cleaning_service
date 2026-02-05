"""
Database migration script for Employee Onboarding System

Creates:
- employees table
- otp_requests table
- employee_refresh_tokens table
- employee_id_sequences table

Run with: python -m app.migrations.employee_onboarding
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
        print("Starting Employee Onboarding migration...")
        
        migration_queries = [
            # 1. Create employees table
            """
            CREATE TABLE IF NOT EXISTS employees (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                employee_id VARCHAR(20) UNIQUE NOT NULL,
                phone_number VARCHAR(15) UNIQUE NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                region_code VARCHAR(5) NOT NULL,
                account_status VARCHAR(20) DEFAULT 'active' NOT NULL,
                cleaner_status VARCHAR(20) DEFAULT 'offline' NOT NULL,
                rating DECIMAL(2,1) DEFAULT 5.0,
                total_jobs_completed INTEGER DEFAULT 0,
                total_jobs_failed INTEGER DEFAULT 0,
                created_by UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_login_at TIMESTAMP WITH TIME ZONE
            );
            """,
            
            # 2. Create indexes for employees
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_id 
            ON employees(employee_id);
            """,
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_phone 
            ON employees(phone_number);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_employees_region_status 
            ON employees(region_code, account_status);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_employees_full_name_search 
            ON employees USING gin(to_tsvector('english', full_name));
            """,
            
            # 3. Create otp_requests table
            """
            CREATE TABLE IF NOT EXISTS otp_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                phone_number VARCHAR(15) NOT NULL,
                user_type VARCHAR(20) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                attempts INTEGER DEFAULT 0,
                max_attempts INTEGER DEFAULT 3,
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                verified_at TIMESTAMP WITH TIME ZONE
            );
            """,
            
            # 4. Create indexes for otp_requests
            """
            CREATE INDEX IF NOT EXISTS idx_otp_phone_created 
            ON otp_requests(phone_number, created_at);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_otp_expires 
            ON otp_requests(expires_at);
            """,
            
            # 5. Create employee_refresh_tokens table
            """
            CREATE TABLE IF NOT EXISTS employee_refresh_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                user_type VARCHAR(20) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                revoked BOOLEAN DEFAULT FALSE,
                revoked_at TIMESTAMP WITH TIME ZONE,
                device_info TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """,
            
            # 6. Create indexes for refresh_tokens
            """
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user 
            ON employee_refresh_tokens(user_id, user_type);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash 
            ON employee_refresh_tokens(token_hash) 
            WHERE revoked = FALSE;
            """,
            
            # 7. Create employee_id_sequences table
            """
            CREATE TABLE IF NOT EXISTS employee_id_sequences (
                id SERIAL PRIMARY KEY,
                region_code VARCHAR(5) NOT NULL,
                year_month VARCHAR(4) NOT NULL,
                sequence INTEGER DEFAULT 0 NOT NULL,
                UNIQUE(region_code, year_month)
            );
            """,
            
            # 8. Create index for sequences
            """
            CREATE INDEX IF NOT EXISTS idx_sequences_region_month 
            ON employee_id_sequences(region_code, year_month);
            """,
            
            # 9. Add check constraints
            """
            DO $$ BEGIN
                ALTER TABLE employees 
                ADD CONSTRAINT check_account_status 
                CHECK (account_status IN ('active', 'suspended', 'terminated'));
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE employees 
                ADD CONSTRAINT check_cleaner_status 
                CHECK (cleaner_status IN ('available', 'busy', 'cooling_down', 'offline'));
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE employees 
                ADD CONSTRAINT check_region_code 
                CHECK (region_code IN ('DXB', 'AUH', 'SHJ', 'AJM', 'RAK', 'FUJ', 'UAQ'));
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
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
        
        print("\n✅ Employee Onboarding migration completed!")
        print("\nNew features available:")
        print("  - employees table with UUID primary keys")
        print("  - Employee ID generation (CLN-DXB-2501-00042 format)")
        print("  - OTP-based phone authentication")
        print("  - Refresh token management")
        print("\nAdmin can now create employees at: POST /api/admin/employees")
        print("Employees can login at: POST /api/auth/otp/request")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()
