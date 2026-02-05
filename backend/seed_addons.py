import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import text

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.database import SessionLocal, engine
from app.models.service import AddOn

def seed_addons():
    db = SessionLocal()
    try:
        # Define add-ons
        addons_data = [
            { "name": "Oven Cleaning", "slug": "oven-cleaning", "price": 50.00, "description": "Deep clean of oven interior to remove grease and burnt food", "icon": "waves" },
            { "name": "Fridge Cleaning", "slug": "fridge-cleaning", "price": 40.00, "description": "Deep clean of fridge interior, shelves and drawers", "icon": "snowflake" },
            { "name": "Window Cleaning", "slug": "window-cleaning", "price": 75.00, "description": "Interior window cleaning including frames and sills", "icon": "layout-grid" },
            { "name": "Laundry & Ironing", "slug": "laundry-ironing", "price": 60.00, "description": "Wash, dry, and iron clothes (up to 1 load)", "icon": "shirt" },
            { "name": "Carpet Shampooing", "slug": "carpet-shampooing", "price": 100.00, "description": "Deep shampoo cleaning for carpets to remove stains", "icon": "sparkles" },
            { "name": "Balcony Cleaning", "slug": "balcony-cleaning", "price": 45.00, "description": "Sweep and wash balcony floor and railings", "icon": "sun" }
        ]

        print("Seeding Add-Ons...")
        
        for data in addons_data:
            existing = db.query(AddOn).filter(AddOn.slug == data["slug"]).first()
            if existing:
                print(f"Updating {data['name']}")
                existing.name = data["name"]
                existing.price = data["price"]
                existing.description = data["description"]
                existing.icon = data["icon"]
            else:
                print(f"Creating {data['name']}")
                addon = AddOn(**data)
                db.add(addon)
        
        db.commit()
        print("Add-Ons seeding completed successfully!")
        
    except Exception as e:
        print(f"Error seeding add-ons: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_addons()
