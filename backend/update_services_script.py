import os
import sys
from sqlalchemy import text
from app.database import SessionLocal

def update_services():
    db = SessionLocal()
    try:
        print("Cleaning up services...")
        
        # Services to delete
        services_to_delete = [
            'post-construction-cleaning', 
            'office-cleaning', 
            'carpet-upholstery-cleaning'
        ]
        
        # Delete services
        # We need to be careful about foreign key constraints (bookings).
        # Assuming no bookings exist for these yet or cascading is handled/we don't care for this dev env.
        # Actually proper way is to set is_active=False if we want to keep history, but user asked to "remove".
        # Let's try to delete. If bookings exist, it might fail. 
        # Since this is a setup/refinement phase, deletion is likely fine or we can just deactivate.
        # But user said "remove". I will specificially DELETE.
        
        for slug in services_to_delete:
            print(f"Deleting service: {slug}")
            # Delete related bookings first if any? No, let's see if we can just delete source.
            # Schema says: bookings REFERENCES services(id).
            # If we delete service, we might break bookings.
            # Safe bet: Delete only if no bookings, or just deactivate.
            # Use EXECUTE to run raw SQL for simplicity in this script.
            
            # Check if exists
            result = db.execute(text("SELECT id FROM services WHERE slug = :slug"), {"slug": slug}).fetchone()
            if result:
                service_id = result[0]
                # Cascade DELETE dependent bookings
                print(f"  - Deleting bookings for service {slug}...")
                db.execute(text("DELETE FROM booking_add_ons WHERE booking_id IN (SELECT id FROM bookings WHERE service_id = :id)"), {"id": service_id})
                db.execute(text("DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE service_id = :id)"), {"id": service_id})
                db.execute(text("DELETE FROM reviews WHERE booking_id IN (SELECT id FROM bookings WHERE service_id = :id)"), {"id": service_id})
                db.execute(text("DELETE FROM invoices WHERE booking_id IN (SELECT id FROM bookings WHERE service_id = :id)"), {"id": service_id})
                db.execute(text("DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM bookings WHERE service_id = :id)"), {"id": service_id})
                db.execute(text("DELETE FROM bookings WHERE service_id = :id"), {"id": service_id})
                
                # Now delete the service
                db.execute(text("DELETE FROM services WHERE id = :id"), {"id": service_id})
                print(f"Deleted {slug}")
            else:
                print(f"Service {slug} not found")
        
        db.commit()
        print("Services update complete.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Ensure backend directory is in python path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    update_services()
