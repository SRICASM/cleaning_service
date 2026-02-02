"""
Migration script to add visit management columns to subscription_visits table.

Run with: python -m app.migrations.add_visit_management_columns
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.database import engine

def run_migration():
    """Add visit management columns to subscription_visits table."""

    with engine.connect() as conn:
        # Add cancellation tracking columns
        visit_columns = [
            ("cancelled_at", "TIMESTAMP WITH TIME ZONE"),
            ("cancellation_reason", "TEXT"),
            ("rolled_over", "BOOLEAN DEFAULT FALSE"),
            # Rescheduling tracking
            ("original_scheduled_date", "TIMESTAMP WITH TIME ZONE"),
            ("rescheduled_at", "TIMESTAMP WITH TIME ZONE"),
            ("reschedule_count", "INTEGER DEFAULT 0"),
        ]

        print("Adding visit management columns to subscription_visits table...")

        for col_name, col_def in visit_columns:
            try:
                conn.execute(text(f"ALTER TABLE subscription_visits ADD COLUMN IF NOT EXISTS {col_name} {col_def}"))
                print(f"  Added column subscription_visits.{col_name}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"  Column subscription_visits.{col_name} already exists")
                else:
                    print(f"  Error adding subscription_visits.{col_name}: {e}")

        # Create indexes for better query performance
        indexes = [
            ("ix_subscription_visits_scheduled_date", "subscription_visits(scheduled_date)"),
            ("ix_subscription_visits_is_cancelled", "subscription_visits(is_cancelled)"),
            ("ix_subscription_visits_is_used", "subscription_visits(is_used)"),
        ]

        print("\nCreating indexes...")
        for idx_name, idx_def in indexes:
            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}"))
                print(f"  Created index {idx_name}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"  Index {idx_name} already exists")
                else:
                    print(f"  Error creating index {idx_name}: {e}")

        conn.commit()
        print("\nMigration completed successfully!")


def seed_subscription_plans():
    """Seed default subscription plans if they don't exist."""

    with engine.connect() as conn:
        # Check if plans exist
        result = conn.execute(text("SELECT COUNT(*) FROM subscription_plans"))
        count = result.scalar()

        if count > 0:
            print(f"Subscription plans already exist ({count} plans). Skipping seed.")
            return

        print("\nSeeding subscription plans...")

        plans = [
            {
                "name": "1 Month",
                "slug": "1-month",
                "description": "Perfect for trying out our service",
                "visits_per_month": 4,
                "price_per_visit": 75.00,
                "monthly_price": 300.00,
                "discount_percentage": 5.00,
                "min_commitment_months": 1,
                "max_rollover_visits": 2,
                "display_order": 1
            },
            {
                "name": "3 Months",
                "slug": "3-months",
                "description": "Our most popular plan",
                "visits_per_month": 4,
                "price_per_visit": 70.00,
                "monthly_price": 280.00,
                "discount_percentage": 10.00,
                "min_commitment_months": 3,
                "max_rollover_visits": 4,
                "is_featured": True,
                "display_order": 2
            },
            {
                "name": "6 Months",
                "slug": "6-months",
                "description": "Great value for regular cleaning",
                "visits_per_month": 4,
                "price_per_visit": 65.00,
                "monthly_price": 260.00,
                "discount_percentage": 15.00,
                "min_commitment_months": 6,
                "max_rollover_visits": 6,
                "display_order": 3
            },
            {
                "name": "12 Months",
                "slug": "12-months",
                "description": "Best value - maximum savings",
                "visits_per_month": 4,
                "price_per_visit": 60.00,
                "monthly_price": 240.00,
                "discount_percentage": 20.00,
                "min_commitment_months": 12,
                "max_rollover_visits": 8,
                "display_order": 4
            }
        ]

        for plan in plans:
            try:
                conn.execute(text("""
                    INSERT INTO subscription_plans
                    (name, slug, description, visits_per_month, price_per_visit, monthly_price,
                     discount_percentage, min_commitment_months, max_rollover_visits, is_featured, display_order)
                    VALUES
                    (:name, :slug, :description, :visits_per_month, :price_per_visit, :monthly_price,
                     :discount_percentage, :min_commitment_months, :max_rollover_visits, :is_featured, :display_order)
                """), {
                    **plan,
                    "is_featured": plan.get("is_featured", False)
                })
                print(f"  Created plan: {plan['name']}")
            except Exception as e:
                print(f"  Error creating plan {plan['name']}: {e}")

        conn.commit()
        print("\nSubscription plans seeded successfully!")


if __name__ == "__main__":
    run_migration()
    seed_subscription_plans()
