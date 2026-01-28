#!/usr/bin/env python3
"""
MongoDB to PostgreSQL Migration Script for CleanUpCrew
Migrates: Users, Services, Bookings, Payments
"""

from pymongo import MongoClient
from app.database import SessionLocal
from app.models.user import User, Address, UserRole, UserStatus
from app.models.service import ServiceCategory, Service, AddOn
from app.models.booking import Booking
from app.core.security import hash_password
import logging
from datetime import datetime
from decimal import Decimal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017"
MONGO_DB = "cleanupcrew"


def migrate_users(mongo_db, pg_session):
    """Migrate users from MongoDB to PostgreSQL."""
    logger.info("📦 Migrating Users...")
    
    migrated = 0
    skipped = 0
    
    for mongo_user in mongo_db.users.find():
        # Check if user already exists in PostgreSQL
        existing = pg_session.query(User).filter(User.email == mongo_user.get('email')).first()
        if existing:
            logger.info(f"  ⏭️  Skipping existing user: {mongo_user.get('email')}")
            skipped += 1
            continue
        
        # Map role
        role_str = mongo_user.get('role', 'customer').lower()
        if role_str == 'admin':
            role = UserRole.ADMIN
        elif role_str == 'cleaner':
            role = UserRole.CLEANER
        else:
            role = UserRole.CUSTOMER
        
        # Create PostgreSQL user
        pg_user = User(
            email=mongo_user.get('email'),
            password_hash=mongo_user.get('password', hash_password('changeme123')),
            first_name=mongo_user.get('first_name', mongo_user.get('name', 'User').split()[0]),
            last_name=mongo_user.get('last_name', ' '.join(mongo_user.get('name', '').split()[1:]) or ''),
            phone=mongo_user.get('phone'),
            role=role,
            status=UserStatus.ACTIVE,
            email_verified=True,
            created_at=mongo_user.get('created_at', datetime.utcnow())
        )
        
        pg_session.add(pg_user)
        pg_session.flush()  # Get the ID
        
        # Create address if available
        if mongo_user.get('address') or mongo_user.get('city'):
            address = Address(
                user_id=pg_user.id,
                label="Home",
                street_address=mongo_user.get('address', 'Address from MongoDB'),
                city=mongo_user.get('city', 'Unknown'),
                postal_code=mongo_user.get('postal_code', mongo_user.get('postalCode', '00000')),
                property_type=mongo_user.get('property_type', 'house'),
                bedrooms=mongo_user.get('bedrooms', 2),
                bathrooms=mongo_user.get('bathrooms', 1),
                is_default=True
            )
            pg_session.add(address)
        
        migrated += 1
        logger.info(f"  ✅ Migrated user: {pg_user.email}")
    
    pg_session.commit()
    logger.info(f"📊 Users: {migrated} migrated, {skipped} skipped")
    return migrated


def migrate_services(mongo_db, pg_session):
    """Migrate services from MongoDB to PostgreSQL."""
    logger.info("📦 Migrating Services...")
    
    # First ensure we have a category
    category = pg_session.query(ServiceCategory).filter(ServiceCategory.slug == "residential-cleaning").first()
    if not category:
        category = ServiceCategory(
            name="Residential Cleaning",
            slug="residential-cleaning",
            description="Home cleaning services",
            icon="home"
        )
        pg_session.add(category)
        pg_session.flush()
    
    migrated = 0
    skipped = 0
    
    for mongo_service in mongo_db.services.find():
        # Check if service already exists
        slug = mongo_service.get('name', '').lower().replace(' ', '-').replace('/', '-')
        existing = pg_session.query(Service).filter(Service.slug == slug).first()
        if existing:
            logger.info(f"  ⏭️  Skipping existing service: {mongo_service.get('name')}")
            skipped += 1
            continue
        
        pg_service = Service(
            name=mongo_service.get('name'),
            slug=slug,
            short_description=mongo_service.get('short_description', ''),
            description=mongo_service.get('description', ''),
            base_price=Decimal(str(mongo_service.get('base_price', 100))),
            price_per_sqft=Decimal(str(mongo_service.get('price_per_sqft', 0.1))),
            base_duration_hours=Decimal(str(mongo_service.get('duration_hours', mongo_service.get('base_duration_hours', 2)))),
            category_id=category.id,
            is_active=True
        )
        pg_session.add(pg_service)
        migrated += 1
        logger.info(f"  ✅ Migrated service: {pg_service.name}")
    
    pg_session.commit()
    logger.info(f"📊 Services: {migrated} migrated, {skipped} skipped")
    return migrated


def migrate_bookings(mongo_db, pg_session):
    """Migrate bookings from MongoDB to PostgreSQL."""
    logger.info("📦 Migrating Bookings...")
    
    migrated = 0
    skipped = 0
    
    for mongo_booking in mongo_db.bookings.find():
        # Find the user by email
        user_email = mongo_booking.get('user_email')
        if not user_email:
            # Try to find by name
            user_name = mongo_booking.get('user_name', '')
            user = pg_session.query(User).filter(User.first_name == user_name.split()[0] if user_name else '').first()
        else:
            user = pg_session.query(User).filter(User.email == user_email).first()
        
        if not user:
            logger.warning(f"  ⚠️  Skipping booking - user not found: {mongo_booking.get('user_email', mongo_booking.get('user_name'))}")
            skipped += 1
            continue
        
        # Find or get default address
        address = pg_session.query(Address).filter(Address.user_id == user.id, Address.is_default == True).first()
        if not address:
            # Create one
            address = Address(
                user_id=user.id,
                label="Home",
                street_address=mongo_booking.get('address', 'Address from booking'),
                city=mongo_booking.get('city', 'Unknown'),
                postal_code=mongo_booking.get('postal_code', '00000'),
                is_default=True
            )
            pg_session.add(address)
            pg_session.flush()
        
        # Find service
        service_name = mongo_booking.get('service_name', 'Standard Clean')
        service = pg_session.query(Service).filter(Service.name == service_name).first()
        if not service:
            service = pg_session.query(Service).first()
        
        if not service:
            logger.warning(f"  ⚠️  Skipping booking - no services in database")
            skipped += 1
            continue
        
        # Parse scheduled_date and time into a combined datetime
        scheduled_date = mongo_booking.get('scheduled_date')
        scheduled_time_str = mongo_booking.get('scheduled_time', '10:00')
        
        if isinstance(scheduled_date, str):
            try:
                scheduled_dt = datetime.strptime(f"{scheduled_date} {scheduled_time_str}", '%Y-%m-%d %I:%M %p')
            except:
                try:
                    scheduled_dt = datetime.strptime(f"{scheduled_date} {scheduled_time_str}", '%Y-%m-%d %H:%M')
                except:
                    scheduled_dt = datetime.utcnow()
        elif isinstance(scheduled_date, datetime):
            # Parse time and combine
            try:
                hour, minute = 10, 0
                if 'PM' in scheduled_time_str.upper():
                    parts = scheduled_time_str.replace('PM', '').replace('AM', '').strip().split(':')
                    hour = int(parts[0])
                    if hour != 12:
                        hour += 12
                    minute = int(parts[1]) if len(parts) > 1 else 0
                elif 'AM' in scheduled_time_str.upper():
                    parts = scheduled_time_str.replace('PM', '').replace('AM', '').strip().split(':')
                    hour = int(parts[0])
                    if hour == 12:
                        hour = 0
                    minute = int(parts[1]) if len(parts) > 1 else 0
                scheduled_dt = scheduled_date.replace(hour=hour, minute=minute)
            except:
                scheduled_dt = scheduled_date
        else:
            scheduled_dt = datetime.utcnow()
        
        # Map status
        status_map = {
            'pending': 'pending',
            'confirmed': 'confirmed',
            'completed': 'completed',
            'cancelled': 'cancelled',
            'paid': 'confirmed'
        }
        status = status_map.get(mongo_booking.get('status', 'pending').lower(), 'pending')
        
        # Generate booking number
        import uuid
        booking_number = f"BK{uuid.uuid4().hex[:8].upper()}"
        
        total_price = Decimal(str(mongo_booking.get('total_price', mongo_booking.get('price', 100))))
        
        pg_booking = Booking(
            booking_number=booking_number,
            customer_id=user.id,
            service_id=service.id,
            address_id=address.id,
            scheduled_date=scheduled_dt,
            property_size_sqft=mongo_booking.get('property_size', 1000),
            bedrooms=mongo_booking.get('bedrooms', 2),
            bathrooms=mongo_booking.get('bathrooms', 1),
            base_price=total_price,
            total_price=total_price,
            status=status,
            payment_status=mongo_booking.get('payment_status', 'pending'),
            customer_notes=mongo_booking.get('special_instructions', ''),
        )
        pg_session.add(pg_booking)
        migrated += 1
        logger.info(f"  ✅ Migrated booking for: {user.email}")
    
    pg_session.commit()
    logger.info(f"📊 Bookings: {migrated} migrated, {skipped} skipped")
    return migrated


def main():
    logger.info("=" * 60)
    logger.info("🚀 MONGODB TO POSTGRESQL MIGRATION")
    logger.info("=" * 60)
    
    # Connect to MongoDB
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.server_info()  # Test connection
        mongo_db = mongo_client[MONGO_DB]
        logger.info(f"✅ Connected to MongoDB: {MONGO_URI}/{MONGO_DB}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        logger.info("💡 Make sure MongoDB is running: docker start mongodb")
        return
    
    # Connect to PostgreSQL
    try:
        pg_session = SessionLocal()
        logger.info("✅ Connected to PostgreSQL")
    except Exception as e:
        logger.error(f"❌ Failed to connect to PostgreSQL: {e}")
        return
    
    try:
        # Show MongoDB stats
        logger.info("\n📊 MongoDB Data Summary:")
        logger.info(f"   Users: {mongo_db.users.count_documents({})}")
        logger.info(f"   Services: {mongo_db.services.count_documents({})}")
        logger.info(f"   Bookings: {mongo_db.bookings.count_documents({})}")
        
        # Run migrations
        logger.info("\n" + "=" * 60)
        users_migrated = migrate_users(mongo_db, pg_session)
        services_migrated = migrate_services(mongo_db, pg_session)
        bookings_migrated = migrate_bookings(mongo_db, pg_session)
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("🎉 MIGRATION COMPLETE!")
        logger.info("=" * 60)
        logger.info(f"   Users migrated: {users_migrated}")
        logger.info(f"   Services migrated: {services_migrated}")
        logger.info(f"   Bookings migrated: {bookings_migrated}")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        pg_session.rollback()
        raise
    finally:
        pg_session.close()
        mongo_client.close()


if __name__ == "__main__":
    main()
