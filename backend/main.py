from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.api import auth, services, bookings, payments, users, reviews, contact, cleaner_actions, admin_dashboard, websocket
from app.api import auth_otp, auth_employee, employee_admin, subscriptions, availability
from app.api import wallet, referrals

# Optional: cleaner dashboard (mobile app)
try:
    from app.api import cleaner_dashboard
    CLEANER_DASHBOARD_ENABLED = True
except ImportError:
    CLEANER_DASHBOARD_ENABLED = False
    print("Cleaner dashboard module not available, skipping...")
from app.database import init_db, SessionLocal
from app.services.sla_monitor import background_runner
from app.services.cache import cache_service
from app.middleware.rate_limiter import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    init_db()
    
    # Try to connect to Redis (optional)
    try:
        redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379')
        await cache_service.connect(redis_url)
    except Exception as e:
        print(f"Redis not available, using in-memory cache: {e}")
    
    # Start background tasks
    await background_runner.start(SessionLocal)
    
    yield
    
    # Shutdown
    await background_runner.stop()
    await cache_service.disconnect()


app = FastAPI(
    title=settings.APP_NAME, 
    version=settings.APP_VERSION, 
    debug=settings.DEBUG,
    lifespan=lifespan
)

# Rate limiting middleware (applied first, before CORS)
# Disable in debug mode for easier testing
app.add_middleware(RateLimitMiddleware, enabled=not settings.DEBUG)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(auth_otp.router, prefix="/api")  # OTP authentication
app.include_router(auth_employee.router, prefix="/api")  # Employee Password authentication
app.include_router(users.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(cleaner_actions.router, prefix="/api")
app.include_router(admin_dashboard.router, prefix="/api")
app.include_router(employee_admin.router, prefix="/api")  # Employee management
app.include_router(subscriptions.router, prefix="/api")  # Subscription system
app.include_router(availability.router, prefix="/api")  # Availability/slot checking
app.include_router(wallet.router, prefix="/api")  # Wallet system
app.include_router(referrals.router, prefix="/api")  # Referral system
if CLEANER_DASHBOARD_ENABLED:
    app.include_router(cleaner_dashboard.router, prefix="/api")  # Mobile app dashboard
app.include_router(websocket.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Cleaning Service API (PostgreSQL) - Admin Dashboard v2"}

@app.post("/api/seed")
def seed_data():
    """Seed endpoint called by frontend. Data already seeded via script."""
    return {"message": "Seed completed or already seeded"}


