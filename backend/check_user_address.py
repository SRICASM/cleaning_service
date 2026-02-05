from app.database import SessionLocal
from app.models import User, Address

db = SessionLocal()
user = db.query(User).filter(User.email == "shrijan.shrestha@example.com").first()

if not user:
    # Try the username we found earlier
    user = db.query(User).filter(User.email == "shrijanshrestha").first()

if not user:
    # Try finding any user
    print("User not found by specific email, listing all:")
    users = db.query(User).all()
    for u in users:
        print(f"ID: {u.id}, Email: {u.email}")
        user = u # Just grab one
else:
    print(f"User found: {user.email} (ID: {user.id})")

if user:
    addresses = db.query(Address).filter(Address.user_id == user.id).all()
    print(f"Addresses found for user {user.id}: {len(addresses)}")
    for addr in addresses:
        print(f"- Default: {addr.is_default}, {addr.street_address}, {addr.city}, {addr.postal_code}")
else:
    print("No user found.")
