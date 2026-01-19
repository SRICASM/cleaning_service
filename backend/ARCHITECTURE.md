# BrightHome Backend Architecture - SQL Implementation

## 1. Product Requirements Summary (Backend Perspective)

### Core Domains:
- **Users & Auth**: Registration, login, JWT tokens, role-based access (customer, admin, cleaner)
- **Services**: Catalog of cleaning services with categories, pricing tiers, add-ons
- **Bookings**: Full lifecycle (create, schedule, reschedule, cancel, complete)
- **Payments**: Stripe integration, invoices, refunds, transaction history
- **Admin**: Dashboard stats, booking management, user management, service CRUD
- **Notifications**: Email/SMS for confirmations, reminders, status updates
- **Reviews**: Post-service ratings and feedback

### Why FastAPI over Flask:
- **Async support**: Native async/await for I/O-bound operations (DB, external APIs)
- **Type hints**: Pydantic models provide automatic validation and documentation
- **OpenAPI**: Auto-generated API docs (Swagger/ReDoc)
- **Performance**: Faster than Flask for concurrent requests
- **Modern**: Better developer experience with Python 3.10+ features

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (FastAPI)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Auth Routes │ │Service Routes│ │Booking Routes│ │Admin Routes│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer (Business Logic)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ AuthService │ │BookingService│ │PaymentService│ │NotifyService│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   Data Access Layer (Repository)                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ UserRepo    │ │ ServiceRepo │ │ BookingRepo │ │ PaymentRepo│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   ORM Layer (SQLAlchemy)                         │
│                   PostgreSQL Database                            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   External Integrations                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Stripe    │ │  SendGrid   │ │   Twilio    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema (PostgreSQL)

### Entity Relationship Summary:
- users (1) → (N) addresses
- users (1) → (N) bookings
- services (1) → (N) bookings
- bookings (1) → (1) payments
- bookings (1) → (1) reviews
- services (N) ↔ (N) add_ons (via booking_add_ons)

---

## 4. Folder Structure

```
/app/backend/
├── alembic/                    # Database migrations
│   ├── versions/
│   └── env.py
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Environment configuration
│   ├── database.py             # SQLAlchemy engine & session
│   │
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── service.py
│   │   ├── booking.py
│   │   ├── payment.py
│   │   └── review.py
│   │
│   ├── schemas/                # Pydantic request/response models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── service.py
│   │   ├── booking.py
│   │   ├── payment.py
│   │   └── review.py
│   │
│   ├── repositories/           # Data access layer
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user_repository.py
│   │   ├── service_repository.py
│   │   ├── booking_repository.py
│   │   └── payment_repository.py
│   │
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── booking_service.py
│   │   ├── payment_service.py
│   │   └── notification_service.py
│   │
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependencies (auth, db session)
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── services.py
│   │   ├── bookings.py
│   │   ├── payments.py
│   │   ├── reviews.py
│   │   └── admin.py
│   │
│   ├── core/                   # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py         # JWT, password hashing
│   │   ├── exceptions.py       # Custom exceptions
│   │   └── middleware.py       # Rate limiting, logging
│   │
│   └── tasks/                  # Background tasks (Celery)
│       ├── __init__.py
│       ├── email_tasks.py
│       └── reminder_tasks.py
│
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_bookings.py
│   └── test_payments.py
│
├── alembic.ini
├── requirements.txt
├── .env
└── .env.example
```
