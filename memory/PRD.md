# BrightHome - Professional Cleaning Services Platform

## Original Problem Statement
Build a modern, high-converting cleaning services website inspired by smoothcleaning.ae with:
- Improved interactivity, smoothness, and performance
- Service booking system with variable pricing
- Stripe payment integration
- JWT authentication
- Admin dashboard for booking management

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe via emergentintegrations library
- **Auth**: JWT-based authentication

## User Personas
1. **Residential Customers**: Homeowners/renters booking regular or one-time cleanings
2. **Commercial Clients**: Businesses needing office/commercial cleaning
3. **Property Managers**: Managing move-in/out cleanings
4. **Admin Users**: Managing bookings, customers, and services

## Core Requirements (Implemented)
- [x] Homepage with hero, services, testimonials, CTAs
- [x] Services page with category filters
- [x] Multi-step booking wizard (Service → Details → Schedule → Review)
- [x] Stripe payment checkout integration
- [x] User registration and login (JWT)
- [x] User dashboard with booking history
- [x] Admin dashboard with stats, bookings, customers, messages
- [x] Contact form with message storage
- [x] About page with team and values
- [x] Responsive design with smooth animations
- [x] Deep Forest Green (#14532d) + Lime (#84cc16) theme

## What's Been Implemented (January 2025)
### Backend
- User auth (register, login, JWT tokens)
- Services CRUD with 6 seeded services
- 8 optional add-ons
- Booking system with price calculation
- Stripe payment integration
- Admin endpoints (stats, bookings, customers, contacts)
- Contact form submission

### Frontend
- HomePage with full marketing sections
- ServicesPage with category filters
- BookingPage (4-step wizard)
- LoginPage / RegisterPage
- DashboardPage (user bookings)
- AdminDashboard (full management)
- AboutPage / ContactPage
- Navbar with auth state
- Footer with links

## Prioritized Backlog
### P0 (Critical)
- All completed

### P1 (Important)
- [ ] Email notifications for bookings (SendGrid)
- [ ] SMS reminders (Twilio)
- [ ] Recurring booking subscriptions
- [ ] Rating/review system

### P2 (Nice to Have)
- [ ] Real-time chat support
- [ ] Cleaner mobile app
- [ ] Multi-language support
- [ ] Referral program

## SQL Backend Architecture (January 2025)

### New Backend Structure Added:
```
/app/backend/
├── app/
│   ├── config.py              # Environment configuration
│   ├── database.py            # SQLAlchemy engine & session
│   ├── models/                # SQLAlchemy ORM models (15 tables)
│   ├── schemas/               # Pydantic request/response models
│   ├── api/                   # RESTful API routes
│   │   ├── auth.py            # Authentication endpoints
│   │   ├── users.py           # User management
│   │   ├── services.py        # Service catalog
│   │   ├── bookings.py        # Booking lifecycle
│   │   ├── payments.py        # Stripe integration
│   │   ├── reviews.py         # Rating system
│   │   └── contact.py         # Contact form
│   └── core/                  # Security, exceptions
├── database_schema.sql        # PostgreSQL DDL
├── API_DOCUMENTATION.md       # Complete API reference
├── ARCHITECTURE.md            # System design
└── ROADMAP.md                 # Development phases
```

### Database Tables (PostgreSQL):
- users, addresses, refresh_tokens
- service_categories, services, add_ons
- bookings, booking_add_ons, booking_status_history
- payments, refunds, invoices, discount_codes
- reviews, contact_messages
- audit_logs, notifications, time_slots

## Next Tasks
1. Set up PostgreSQL and run migrations
2. Add email notifications (SendGrid integration)
3. Implement recurring subscription plans
4. Add cleaner mobile app APIs
5. Build real-time tracking (WebSocket)
