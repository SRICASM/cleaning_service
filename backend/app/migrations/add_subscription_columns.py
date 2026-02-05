"""
Migration script to add subscription-related columns and tables.

Run with: python -m app.migrations.add_subscription_columns
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.database import engine

def run_migration():
    """Add missing columns to existing tables and create new subscription tables."""

    with engine.connect() as conn:
        # Add missing columns to bookings table
        booking_columns = [
            ("demand_multiplier", "NUMERIC(4,2) DEFAULT 1.00"),
            ("rush_premium", "NUMERIC(4,2) DEFAULT 1.00"),
            ("utilization_at_booking", "NUMERIC(5,2)"),
            ("pricing_tier", "VARCHAR(20)"),
            ("rush_tier", "VARCHAR(20)"),
            ("is_subscription_booking", "BOOLEAN DEFAULT FALSE"),
            ("subscription_id", "INTEGER REFERENCES subscriptions(id)"),
        ]

        for col_name, col_def in booking_columns:
            try:
                conn.execute(text(f"ALTER TABLE bookings ADD COLUMN IF NOT EXISTS {col_name} {col_def}"))
                print(f"Added column bookings.{col_name}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"Column bookings.{col_name} already exists")
                else:
                    print(f"Error adding bookings.{col_name}: {e}")

        # Add stripe_customer_id to users table
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100)"))
            print("Added column users.stripe_customer_id")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column users.stripe_customer_id already exists")
            else:
                print(f"Error adding users.stripe_customer_id: {e}")

        # Create index on stripe_customer_id
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_stripe_customer_id ON users(stripe_customer_id)"))
            print("Created index on users.stripe_customer_id")
        except Exception as e:
            print(f"Error creating index: {e}")

        # Create subscription_plans table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscription_plans (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    slug VARCHAR(50) UNIQUE NOT NULL,
                    description TEXT,
                    visits_per_month INTEGER NOT NULL,
                    price_per_visit NUMERIC(10,2),
                    monthly_price NUMERIC(10,2) NOT NULL,
                    discount_percentage NUMERIC(5,2),
                    features JSONB,
                    included_addon_ids INTEGER[],
                    min_commitment_months INTEGER DEFAULT 1,
                    max_rollover_visits INTEGER DEFAULT 4,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_featured BOOLEAN DEFAULT FALSE,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("Created subscription_plans table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Table subscription_plans already exists")
            else:
                print(f"Error creating subscription_plans: {e}")

        # Create subscriptions table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    subscription_number VARCHAR(20) UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
                    address_id INTEGER NOT NULL REFERENCES addresses(id),
                    preferred_cleaner_id UUID REFERENCES employees(id),
                    preferred_days INTEGER[],
                    preferred_time_slot VARCHAR(20),
                    property_size_sqft INTEGER,
                    bedrooms INTEGER DEFAULT 2,
                    bathrooms INTEGER DEFAULT 1,
                    service_id INTEGER NOT NULL REFERENCES services(id),
                    status VARCHAR(30) DEFAULT 'pending_activation' NOT NULL,
                    pause_reason TEXT,
                    paused_at TIMESTAMP WITH TIME ZONE,
                    resume_at TIMESTAMP WITH TIME ZONE,
                    billing_cycle_start TIMESTAMP WITH TIME ZONE NOT NULL,
                    next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
                    stripe_subscription_id VARCHAR(100),
                    stripe_customer_id VARCHAR(100),
                    payment_method_id VARCHAR(100),
                    visits_allocated INTEGER DEFAULT 0,
                    visits_used INTEGER DEFAULT 0,
                    visits_remaining INTEGER DEFAULT 0,
                    rollover_visits INTEGER DEFAULT 0,
                    started_at TIMESTAMP WITH TIME ZONE,
                    cancelled_at TIMESTAMP WITH TIME ZONE,
                    cancellation_reason TEXT,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("Created subscriptions table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Table subscriptions already exists")
            else:
                print(f"Error creating subscriptions: {e}")

        # Create indexes on subscriptions
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_subscriptions_user_id ON subscriptions(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_subscriptions_status ON subscriptions(status)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id)"))
            print("Created indexes on subscriptions")
        except Exception as e:
            print(f"Error creating indexes: {e}")

        # Create subscription_visits table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscription_visits (
                    id SERIAL PRIMARY KEY,
                    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
                    booking_id INTEGER REFERENCES bookings(id),
                    visit_number INTEGER NOT NULL,
                    billing_cycle_month VARCHAR(7) NOT NULL,
                    scheduled_date TIMESTAMP WITH TIME ZONE,
                    is_rollover BOOLEAN DEFAULT FALSE,
                    is_used BOOLEAN DEFAULT FALSE,
                    is_cancelled BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    used_at TIMESTAMP WITH TIME ZONE
                )
            """))
            print("Created subscription_visits table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Table subscription_visits already exists")
            else:
                print(f"Error creating subscription_visits: {e}")

        # Create subscription_billing table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscription_billing (
                    id SERIAL PRIMARY KEY,
                    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
                    billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
                    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
                    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
                    amount NUMERIC(10,2) NOT NULL,
                    currency VARCHAR(3) DEFAULT 'AED',
                    visits_allocated INTEGER NOT NULL,
                    rollover_from_previous INTEGER DEFAULT 0,
                    total_visits INTEGER NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3,
                    next_retry_at TIMESTAMP WITH TIME ZONE,
                    last_error TEXT,
                    stripe_invoice_id VARCHAR(100),
                    stripe_payment_intent_id VARCHAR(100),
                    stripe_charge_id VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    paid_at TIMESTAMP WITH TIME ZONE,
                    failed_at TIMESTAMP WITH TIME ZONE
                )
            """))
            print("Created subscription_billing table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Table subscription_billing already exists")
            else:
                print(f"Error creating subscription_billing: {e}")

        # Create subscription_plan_changes table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscription_plan_changes (
                    id SERIAL PRIMARY KEY,
                    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
                    from_plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
                    to_plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
                    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    effective_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    prorated_amount NUMERIC(10,2),
                    is_processed BOOLEAN DEFAULT FALSE,
                    processed_at TIMESTAMP WITH TIME ZONE
                )
            """))
            print("Created subscription_plan_changes table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Table subscription_plan_changes already exists")
            else:
                print(f"Error creating subscription_plan_changes: {e}")

        conn.commit()
        print("\nMigration completed successfully!")

if __name__ == "__main__":
    run_migration()
