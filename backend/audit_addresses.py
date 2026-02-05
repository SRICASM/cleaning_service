from app.database import SessionLocal
from app.models import User, Address

db = SessionLocal()
users = db.query(User).all()

print(f"{'ID':<5} {'Email':<30} {'Addresses':<10}")
print("-" * 50)

for u in users:
    addr_count = db.query(Address).filter(Address.user_id == u.id).count()
    print(f"{u.id:<5} {u.email:<30} {addr_count:<10}")

    if addr_count > 0:
        addrs = db.query(Address).filter(Address.user_id == u.id).all()
        for a in addrs:
             print(f"  - ID: {a.id}, Label: {a.label}, Street: {a.street_address}, City: {a.city}, Postal: {a.postal_code}, Default: {a.is_default}")
