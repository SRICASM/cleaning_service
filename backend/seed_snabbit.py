import sys
import os

# Add current directory to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.service import Service, ServiceCategory

def seed():
    db = SessionLocal()
    try:
        # Create Category
        cat = db.query(ServiceCategory).filter_by(slug="residential-cleaning").first()
        if not cat:
            cat = ServiceCategory(
                name="Residential Cleaning",
                slug="residential-cleaning",
                icon="Home",
                display_order=1,
                description="Standard residential cleaning services"
            )
            db.add(cat)
            db.commit()
            db.refresh(cat)
            print("Created category: Residential Cleaning")
        else:
            print("Category exists: Residential Cleaning")

        # Services Data
        # icon names from HomePage.jsx: Home, Sparkles, Droplets, Shirt, UtensilsCrossed
        services_data = [
            {
                "name": "House Cleaning",
                "slug": "house-cleaning",
                "icon": "Home",
                "base_price": 49.00,
                "base_duration_hours": 2.0
            },
            {
                "name": "Dusting & Wiping",
                "slug": "dusting-wiping",
                "icon": "Sparkles",
                "base_price": 39.00,
                "base_duration_hours": 1.5
            },
            {
                "name": "Bathroom Cleaning",
                "slug": "bathroom-cleaning",
                "icon": "Droplets",
                "base_price": 59.00,
                "base_duration_hours": 2.0
            },
            {
                "name": "Laundry & Ironing",
                "slug": "laundry-ironing",
                "icon": "Shirt",
                "base_price": 45.00,
                "base_duration_hours": 2.0
            },
            {
                "name": "Cleaning Dishes",
                "slug": "cleaning-dishes",
                "icon": "UtensilsCrossed",
                "base_price": 29.00,
                "base_duration_hours": 1.0
            }
        ]

        for s_data in services_data:
            s = db.query(Service).filter_by(slug=s_data["slug"]).first()
            if not s:
                s = Service(
                    category_id=cat.id,
                    name=s_data["name"],
                    slug=s_data["slug"],
                    icon=s_data["icon"],
                    base_price=s_data["base_price"],
                    base_duration_hours=s_data["base_duration_hours"],
                    short_description=f"Professional {s_data['name']}",
                    description=f"High quality {s_data['name']} service.",
                    features="[\"Experienced Professionals\", \"Eco-friendly products\"]",
                    is_active=True,
                    is_featured=True
                )
                db.add(s)
                print(f"Created service: {s_data['name']}")
            else:
                # Update icon and price just in case
                s.icon = s_data["icon"]
                s.base_price = s_data["base_price"]
                s.is_active = True
                db.add(s)
                print(f"Service updated: {s_data['name']}")
        
        db.commit()
        print("Seeding completed successfully.")

    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
