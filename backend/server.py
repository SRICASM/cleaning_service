from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'brighthome-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Create the main app
app = FastAPI(title="BrightHome Cleaning API")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    role: str = "user"
    created_at: str

class ServiceBase(BaseModel):
    name: str
    description: str
    short_description: str
    base_price: float
    price_per_sqft: float = 0.0
    duration_hours: float
    icon: str
    category: str  # residential, commercial, specialty
    features: List[str] = []

class ServiceCreate(ServiceBase):
    pass

class ServiceResponse(ServiceBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    is_active: bool = True

class AddOn(BaseModel):
    id: str
    name: str
    price: float
    description: str

class BookingBase(BaseModel):
    service_id: str
    service_name: str
    property_type: str  # apartment, house, office, commercial
    property_size: int  # in sqft
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    address: str
    city: str
    postal_code: str
    scheduled_date: str
    scheduled_time: str
    add_ons: List[str] = []
    special_instructions: Optional[str] = None

class BookingCreate(BookingBase):
    pass

class BookingResponse(BookingBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_email: str
    user_name: str
    status: str  # pending, confirmed, in_progress, completed, cancelled
    total_price: float
    payment_status: str  # pending, paid, refunded
    payment_session_id: Optional[str] = None
    created_at: str
    updated_at: str

class PaymentTransactionCreate(BaseModel):
    booking_id: str
    origin_url: str

class PaymentTransactionResponse(BaseModel):
    checkout_url: str
    session_id: str

class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    subject: str
    message: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "phone": user_data.phone,
        "password": hash_password(user_data.password),
        "role": "user",
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user_data.email, "user")
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "phone": user_data.phone,
            "role": "user"
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"], user.get("role", "user"))
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone"),
            "role": user.get("role", "user")
        }
    }

@api_router.get("/auth/me", response_model=dict)
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "phone": user.get("phone"),
        "role": user.get("role", "user")
    }

# ==================== SERVICES ROUTES ====================

@api_router.get("/services", response_model=List[ServiceResponse])
async def get_services():
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(100)
    return services

@api_router.get("/services/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: str):
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@api_router.post("/admin/services", response_model=ServiceResponse)
async def create_service(service_data: ServiceCreate, user: dict = Depends(get_admin_user)):
    service_id = str(uuid.uuid4())
    service_doc = {
        "id": service_id,
        **service_data.model_dump(),
        "is_active": True
    }
    await db.services.insert_one(service_doc)
    return service_doc

@api_router.put("/admin/services/{service_id}", response_model=ServiceResponse)
async def update_service(service_id: str, service_data: ServiceCreate, user: dict = Depends(get_admin_user)):
    result = await db.services.update_one(
        {"id": service_id},
        {"$set": service_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return await db.services.find_one({"id": service_id}, {"_id": 0})

@api_router.delete("/admin/services/{service_id}")
async def delete_service(service_id: str, user: dict = Depends(get_admin_user)):
    result = await db.services.update_one({"id": service_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}

# ==================== ADD-ONS ====================

ADD_ONS = [
    {"id": "inside_fridge", "name": "Inside Fridge Cleaning", "price": 35.00, "description": "Deep clean refrigerator interior"},
    {"id": "inside_oven", "name": "Inside Oven Cleaning", "price": 45.00, "description": "Degrease and clean oven interior"},
    {"id": "inside_cabinets", "name": "Inside Cabinet Cleaning", "price": 50.00, "description": "Clean and organize cabinet interiors"},
    {"id": "laundry", "name": "Laundry Service", "price": 30.00, "description": "Wash, dry, and fold laundry"},
    {"id": "window_interior", "name": "Interior Windows", "price": 40.00, "description": "Clean all interior windows"},
    {"id": "balcony", "name": "Balcony Cleaning", "price": 25.00, "description": "Sweep and mop balcony area"},
    {"id": "deep_carpet", "name": "Deep Carpet Clean", "price": 75.00, "description": "Steam clean carpets"},
    {"id": "pet_treatment", "name": "Pet Hair Treatment", "price": 35.00, "description": "Extra attention to pet hair removal"}
]

@api_router.get("/add-ons", response_model=List[AddOn])
async def get_add_ons():
    return ADD_ONS

# ==================== BOOKING ROUTES ====================

def calculate_booking_price(service: dict, property_size: int, add_on_ids: List[str]) -> float:
    base = service["base_price"]
    sqft_price = service.get("price_per_sqft", 0) * property_size
    
    add_ons_total = 0.0
    for addon in ADD_ONS:
        if addon["id"] in add_on_ids:
            add_ons_total += addon["price"]
    
    return round(base + sqft_price + add_ons_total, 2)

@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking(booking_data: BookingCreate, user: dict = Depends(get_current_user)):
    service = await db.services.find_one({"id": booking_data.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    total_price = calculate_booking_price(service, booking_data.property_size, booking_data.add_ons)
    
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    booking_doc = {
        "id": booking_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        **booking_data.model_dump(),
        "total_price": total_price,
        "status": "confirmed",  # PAYMENT BYPASS: Original was "pending"
        "payment_status": "paid",  # PAYMENT BYPASS: Original was "pending"
        "payment_session_id": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.bookings.insert_one(booking_doc)
    return booking_doc

@api_router.get("/bookings", response_model=List[BookingResponse])
async def get_user_bookings(user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bookings

@api_router.get("/bookings/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return booking

@api_router.put("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    if booking["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Booking cancelled"}

# ==================== ADMIN BOOKING ROUTES ====================

@api_router.get("/admin/bookings", response_model=List[BookingResponse])
async def get_all_bookings(status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {}
    if status:
        query["status"] = status
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return bookings

@api_router.put("/admin/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str, user: dict = Depends(get_admin_user)):
    valid_statuses = ["pending", "confirmed", "in_progress", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Status updated"}

@api_router.get("/admin/customers", response_model=List[dict])
async def get_customers(user: dict = Depends(get_admin_user)):
    users = await db.users.find({"role": "user"}, {"_id": 0, "password": 0}).to_list(500)
    for u in users:
        booking_count = await db.bookings.count_documents({"user_id": u["id"]})
        u["booking_count"] = booking_count
    return users

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(get_admin_user)):
    total_bookings = await db.bookings.count_documents({})
    pending_bookings = await db.bookings.count_documents({"status": "pending"})
    confirmed_bookings = await db.bookings.count_documents({"status": "confirmed"})
    completed_bookings = await db.bookings.count_documents({"status": "completed"})
    total_customers = await db.users.count_documents({"role": "user"})
    
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_price"}}}
    ]
    revenue_result = await db.bookings.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    return {
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "confirmed_bookings": confirmed_bookings,
        "completed_bookings": completed_bookings,
        "total_customers": total_customers,
        "total_revenue": total_revenue
    }

# ==================== PAYMENT ROUTES ====================

@api_router.post("/payments/checkout", response_model=PaymentTransactionResponse)
async def create_payment(payment_data: PaymentTransactionCreate, request: Request, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": payment_data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Booking already paid")
    
    origin_url = payment_data.origin_url
    success_url = f"{origin_url}/booking/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/booking/cancel?booking_id={payment_data.booking_id}"
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=float(booking["total_price"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "booking_id": payment_data.booking_id,
            "user_id": user["id"],
            "user_email": user["email"]
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    transaction_doc = {
        "id": transaction_id,
        "booking_id": payment_data.booking_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "session_id": session.session_id,
        "amount": booking["total_price"],
        "currency": "usd",
        "payment_status": "pending",
        "created_at": now,
        "updated_at": now
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    # Update booking with session_id
    await db.bookings.update_one(
        {"id": payment_data.booking_id},
        {"$set": {"payment_session_id": session.session_id, "updated_at": now}}
    )
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check if already processed
    if transaction["payment_status"] == "paid":
        return {"status": "complete", "payment_status": "paid"}
    
    host_url = os.environ.get('HOST_URL', 'http://localhost:8001')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    now = datetime.now(timezone.utc).isoformat()
    
    if checkout_status.payment_status == "paid":
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "updated_at": now}}
        )
        
        # Update booking
        await db.bookings.update_one(
            {"payment_session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "confirmed", "updated_at": now}}
        )
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = os.environ.get('HOST_URL', 'http://localhost:8001')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            now = datetime.now(timezone.utc).isoformat()
            
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "updated_at": now}}
            )
            
            await db.bookings.update_one(
                {"payment_session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "status": "confirmed", "updated_at": now}}
            )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== CONTACT ROUTE ====================

@api_router.post("/contact")
async def submit_contact(message: ContactMessage):
    contact_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    contact_doc = {
        "id": contact_id,
        **message.model_dump(),
        "status": "new",
        "created_at": now
    }
    
    await db.contact_messages.insert_one(contact_doc)
    return {"message": "Message sent successfully", "id": contact_id}

@api_router.get("/admin/contacts")
async def get_contacts(user: dict = Depends(get_admin_user)):
    contacts = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return contacts

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    # Check if services already exist
    existing = await db.services.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded"}
    
    services = [
        {
            "id": str(uuid.uuid4()),
            "name": "Standard Cleaning",
            "description": "Our standard cleaning service covers all the essentials to keep your home fresh and tidy. We dust surfaces, vacuum and mop floors, clean bathrooms, and tidy up living spaces.",
            "short_description": "Essential cleaning for a fresh, tidy home",
            "base_price": 99.00,
            "price_per_sqft": 0.05,
            "duration_hours": 2.5,
            "icon": "Sparkles",
            "category": "residential",
            "features": ["Dusting & Wiping", "Vacuuming & Mopping", "Bathroom Sanitizing", "Kitchen Cleaning", "Trash Removal"],
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Deep Cleaning",
            "description": "A thorough, detailed clean that reaches every corner. Perfect for seasonal cleaning or when your space needs extra attention. Includes baseboards, inside appliances, and more.",
            "short_description": "Thorough deep clean for every corner",
            "base_price": 199.00,
            "price_per_sqft": 0.08,
            "duration_hours": 4.0,
            "icon": "SprayCan",
            "category": "residential",
            "features": ["All Standard Cleaning", "Baseboard Cleaning", "Light Fixture Cleaning", "Door & Frame Wiping", "Detailed Scrubbing"],
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Move In/Out Cleaning",
            "description": "Make your move stress-free with our comprehensive move-in or move-out cleaning. We ensure the property is spotless for handover or your fresh start.",
            "short_description": "Comprehensive cleaning for moving day",
            "base_price": 249.00,
            "price_per_sqft": 0.10,
            "duration_hours": 5.0,
            "icon": "Home",
            "category": "residential",
            "features": ["All Deep Cleaning", "Inside Cabinets", "Inside Appliances", "Window Sills", "Garage Sweep"],
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Office Cleaning",
            "description": "Professional cleaning for your workspace. We maintain a clean, healthy environment for your team with regular or one-time office cleaning services.",
            "short_description": "Professional office & workspace cleaning",
            "base_price": 149.00,
            "price_per_sqft": 0.04,
            "duration_hours": 3.0,
            "icon": "Building",
            "category": "commercial",
            "features": ["Desk & Surface Cleaning", "Floor Maintenance", "Restroom Sanitizing", "Break Room Cleaning", "Trash & Recycling"],
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Post-Construction Cleaning",
            "description": "Remove construction dust, debris, and residue after renovation. We prepare your newly renovated space for immediate use with professional post-construction cleaning.",
            "short_description": "Detailed cleanup after renovation work",
            "base_price": 299.00,
            "price_per_sqft": 0.12,
            "duration_hours": 6.0,
            "icon": "Hammer",
            "category": "specialty",
            "features": ["Dust Removal", "Debris Cleanup", "Surface Polishing", "Window Cleaning", "Final Detailing"],
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Carpet & Upholstery Cleaning",
            "description": "Professional deep cleaning for carpets, rugs, and upholstered furniture. Remove stains, allergens, and refresh your soft furnishings.",
            "short_description": "Deep clean carpets and furniture",
            "base_price": 129.00,
            "price_per_sqft": 0.15,
            "duration_hours": 2.0,
            "icon": "Sofa",
            "category": "specialty",
            "features": ["Steam Cleaning", "Stain Treatment", "Odor Removal", "Fabric Protection", "Quick Dry"],
            "is_active": True
        }
    ]
    
    await db.services.insert_many(services)
    
    # Create admin user
    admin_exists = await db.users.find_one({"email": "admin@brighthome.com"})
    if not admin_exists:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": "admin@brighthome.com",
            "name": "Admin User",
            "phone": "+1234567890",
            "password": hash_password("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
    
    return {"message": "Data seeded successfully"}

@api_router.get("/")
async def root():
    return {"message": "BrightHome Cleaning API", "status": "running"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
