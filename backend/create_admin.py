from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, UserRole, UserStatus
from app.core.security import hash_password

def seed_users(db: Session):
    print("Seeding users...")
    
    # Check if admin exists
    admin = db.query(User).filter(User.email == "admin@cleanupcrew.com").first()
    if not admin:
        print("Creating admin user...")
        admin = User(
            email="admin@cleanupcrew.com",
            password_hash=hash_password("admin123"),
            first_name="Admin",
            last_name="User",
            phone="1234567890",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
            email_verified=True
        )
        db.add(admin)
    else:
        print("Admin user already exists")
        # Update password just in case
        admin.password_hash = hash_password("admin123")
        admin.status = UserStatus.ACTIVE

    db.commit()
    print("Users seeded successfully!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()
