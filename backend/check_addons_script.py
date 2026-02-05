
from app.database import SessionLocal
from app.models import Booking, AddOn

def check_addons():
    db = SessionLocal()
    try:
        bookings = db.query(Booking).all()
        print(f"Total bookings: {len(bookings)}")
        
        count_with_addons = 0
        for b in bookings:
            if b.add_ons:
                count_with_addons += 1
                addon_names = [a.name for a in b.add_ons]
                print(f"Booking {b.booking_number} (ID: {b.id}): {addon_names}")
        
        print(f"Bookings with add-ons: {count_with_addons}")
        
        if count_with_addons == 0:
            print("No bookings have add-ons. Try creating a new booking WITH add-ons.")

    finally:
        db.close()

if __name__ == "__main__":
    check_addons()
