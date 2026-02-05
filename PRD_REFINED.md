# CleanUpCrew - Refined Product Requirements Document

## Executive Summary

This document provides a comprehensive analysis of the CleanUpCrew platform comparing the original PRD vision against current implementation, identifying gaps, and providing a phased roadmap for completion.

---

## 1. IMPLEMENTATION STATUS MATRIX

### Legend
- ✅ **Implemented** - Feature is complete and working
- ⚡ **Partial** - Basic implementation exists, needs enhancement
- ❌ **Not Started** - Feature not yet implemented
- 🔄 **In Progress** - Currently being developed

| Module | Feature | Status | Notes |
|--------|---------|--------|-------|
| **Booking** | Time slot selection | ✅ | Working with TimeSlot model |
| | Add-ons | ✅ | AddOn model with booking junction |
| | Rush pricing | ❌ | Not implemented |
| | Same-day booking | ⚡ | Works but no premium pricing |
| | Queue allocation | ⚡ | Basic allocation, no Redis queue |
| | State machine | ✅ | 11 states with transitions |
| **Subscription** | Monthly plans | ❌ | Not implemented |
| | Auto-renew | ❌ | Not implemented |
| | Pause/Resume | ❌ | Not implemented |
| | Rollover logic | ❌ | Not implemented |
| | Fixed cleaner preference | ❌ | Not implemented |
| | Calendar generation | ❌ | Not implemented |
| **Allocation** | Availability check | ✅ | Working |
| | Region matching | ✅ | UAE regions (DXB, AUH, etc.) |
| | Distance-based | ❌ | No geolocation calculation |
| | Rating-based priority | ❌ | Not in algorithm |
| | Redis queue | ❌ | In-memory only |
| | 3-second fallback | ❌ | Not implemented |
| **Pricing** | Base formula | ✅ | base + size + add-ons |
| | Dynamic multipliers | ❌ | No utilization-based pricing |
| | Discount codes | ⚡ | Model exists, not integrated |
| **Payment** | One-time | ✅ | Stripe integration working |
| | Subscription billing | ❌ | Not implemented |
| | Wallet | ❌ | Not implemented |
| | Retry cycle | ❌ | Not implemented |
| **Notifications** | In-app (WebSocket) | ✅ | Working for all roles |
| | Email | ❌ | Model exists, no delivery |
| | SMS | ❌ | OTP only, no notifications |
| | Push | ❌ | Not implemented |
| **Admin Dashboard** | Live stats | ✅ | Working |
| | Manual reassignment | ⚡ | Endpoint exists, disabled |
| | Price override | ❌ | Not implemented |
| | Subscription controls | ❌ | Not implemented |
| **Cleaner App** | View jobs | ✅ | Working |
| | Start/Complete | ✅ | Working with state machine |
| | Availability toggle | ✅ | Working |
| | Navigation map | ⚡ | Link to Google Maps only |
| | Earnings dashboard | ❌ | Not implemented |

---

## 2. CURRENT ARCHITECTURE

### 2.1 Database Schema (Implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT SCHEMA                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌──────────┐    ┌─────────────┐               │
│  │  User   │───<│ Booking  │>───│   Service   │               │
│  │(Customer│    │          │    │             │               │
│  │ /Admin) │    │          │    └─────────────┘               │
│  └─────────┘    │          │                                   │
│       │         │          │>───┌─────────────┐               │
│       │         │          │    │   AddOn     │               │
│  ┌─────────┐    │          │    └─────────────┘               │
│  │ Address │───<│          │                                   │
│  └─────────┘    │          │>───┌─────────────┐               │
│                 │          │    │  Payment    │               │
│  ┌──────────┐   │          │    └─────────────┘               │
│  │ Employee │──<│          │                                   │
│  │(Cleaner) │   └──────────┘>───┌─────────────┐               │
│  └──────────┘                   │   Review    │               │
│                                 └─────────────┘               │
│                                                                 │
│  Supporting: TimeSlot, DiscountCode, Notification,             │
│              AuditLog, ContactMessage, Invoice, Refund          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Booking State Machine (Implemented)

```
                    ┌──────────────────────────────────────────┐
                    │           BOOKING LIFECYCLE              │
                    └──────────────────────────────────────────┘

    ┌─────────┐     Payment      ┌────────────────────┐
    │ PENDING │ ───────────────> │ PENDING_ASSIGNMENT │
    └─────────┘                  └────────────────────┘
         │                                │
         │ Cancel                         │ Auto-assign
         ▼                                ▼
    ┌───────────┐               ┌──────────────┐
    │ CANCELLED │               │   ASSIGNED   │
    └───────────┘               └──────────────┘
         │                                │
         │ Refund                         │ Start
         ▼                                ▼
    ┌──────────┐                ┌──────────────┐
    │ REFUNDED │                │ IN_PROGRESS  │◄────┐
    └──────────┘                └──────────────┘     │
                                   │    │    │      │
                          Pause    │    │    │      │ Resume
                             ▼     │    │    │      │
                        ┌────────┐ │    │    │      │
                        │ PAUSED │─┼────┼────┼──────┘
                        └────────┘ │    │    │
                                   │    │    │
                    Complete ──────┘    │    └────── Fail
                         │              │              │
                         ▼              │              ▼
                   ┌───────────┐        │      ┌────────┐
                   │ COMPLETED │        │      │ FAILED │
                   └───────────┘        │      └────────┘
                                        │              │
                                   Cancel│         Reassign
                                        ▼              │
                                  ┌───────────┐        │
                                  │ CANCELLED │        │
                                  └───────────┘        │
                                                       │
                    ┌──────────────────────────────────┘
                    │
                    ▼
            ┌────────────────────┐
            │ PENDING_ASSIGNMENT │ (Reassignment loop)
            └────────────────────┘
```

### 2.3 Current Allocation Algorithm

```python
# Current Implementation (cleaner_assignment.py)

1. Extract region from booking.address.city
   └── Map: Dubai→DXB, Abu Dhabi→AUH, Sharjah→SHJ, etc.

2. Find employees WHERE:
   └── region_code = booking_region
   └── account_status = ACTIVE

3. Filter out employees with time conflicts:
   └── Check: existing_booking overlaps with new_booking?
   └── Overlap = (start1 < end2) AND (start2 < end1)

4. Sort by workload (ascending):
   └── COUNT(today's_non_cancelled_bookings)

5. Assign to first (least busy) cleaner
```

**Limitations:**
- No distance/proximity calculation
- No rating consideration
- No real-time queue (Redis)
- No fallback timeout mechanism

---

## 3. GAP ANALYSIS & REQUIRED CHANGES

### 3.1 HIGH PRIORITY - Subscription System

**Current State:** Not implemented

**Required Implementation:**

```sql
-- New Tables Required

CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,           -- "8 Visits", "12 Visits", "Custom"
    slug VARCHAR(50) UNIQUE NOT NULL,
    visits_per_month INTEGER NOT NULL,
    price_per_visit DECIMAL(10,2),
    monthly_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2),      -- vs one-time booking
    features JSONB,                         -- included add-ons, priority booking
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    subscription_number VARCHAR(20) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    plan_id INTEGER REFERENCES subscription_plans(id) NOT NULL,
    preferred_cleaner_id UUID REFERENCES employees(id),

    -- Schedule
    preferred_day_of_week INTEGER[],       -- [1,4] = Monday, Thursday
    preferred_time_slot VARCHAR(20),       -- "09:00 AM"
    address_id INTEGER REFERENCES addresses(id),

    -- Status
    status VARCHAR(20) NOT NULL,           -- active, paused, cancelled, expired
    pause_reason TEXT,
    paused_at TIMESTAMP,
    resume_at TIMESTAMP,

    -- Billing
    billing_cycle_start DATE NOT NULL,
    next_billing_date DATE NOT NULL,
    payment_method_id VARCHAR(100),        -- Stripe payment method

    -- Usage
    visits_used INTEGER DEFAULT 0,
    visits_remaining INTEGER NOT NULL,
    rollover_visits INTEGER DEFAULT 0,     -- from previous month

    -- Timestamps
    started_at TIMESTAMP NOT NULL,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscription_bookings (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES subscriptions(id) NOT NULL,
    booking_id INTEGER REFERENCES bookings(id) NOT NULL,
    visit_number INTEGER NOT NULL,         -- 1, 2, 3... within billing cycle
    is_rollover BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscription_billing_history (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES subscriptions(id) NOT NULL,
    billing_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    visits_allocated INTEGER NOT NULL,
    rollover_from_previous INTEGER DEFAULT 0,
    payment_status VARCHAR(20),            -- pending, paid, failed, retrying
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    stripe_invoice_id VARCHAR(100),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints Required:**

```
POST   /api/subscriptions/create          - Create new subscription
GET    /api/subscriptions/plans           - List available plans
GET    /api/subscriptions/my              - Get user's subscriptions
PUT    /api/subscriptions/{id}/pause      - Pause subscription
PUT    /api/subscriptions/{id}/resume     - Resume subscription
PUT    /api/subscriptions/{id}/cancel     - Cancel subscription
PUT    /api/subscriptions/{id}/change-plan - Upgrade/downgrade
POST   /api/subscriptions/{id}/book-visit - Book a subscription visit
GET    /api/subscriptions/{id}/calendar   - Get generated calendar
```

**Business Logic:**

```python
# Subscription Service

class SubscriptionService:

    ROLLOVER_MAX_VISITS = 4  # Max visits that can roll over
    RETRY_INTERVALS = [1, 12, 24]  # hours

    def create_subscription(self, user_id, plan_id, preferences):
        """
        1. Validate user doesn't have active subscription
        2. Create Stripe subscription
        3. Generate first month's calendar
        4. Auto-create bookings for preferred schedule
        """
        pass

    def generate_monthly_calendar(self, subscription):
        """
        Generate bookings for the month based on:
        - preferred_day_of_week
        - preferred_time_slot
        - visits_per_month

        Evenly distribute across the month.
        """
        pass

    def process_monthly_billing(self, subscription):
        """
        1. Calculate rollover (min of unused, ROLLOVER_MAX)
        2. Charge via Stripe
        3. On success: allocate new visits + rollover
        4. On failure: initiate retry cycle
        """
        pass

    def handle_payment_failure(self, subscription, attempt):
        """
        Retry cycle: 1hr → 12hr → 24hr → suspend
        Send notification at each step.
        """
        pass
```

---

### 3.2 HIGH PRIORITY - Dynamic Pricing Engine

**Current State:** Static pricing only

**Required Changes to `bookings.py`:**

```python
# Add to pricing calculation

class PricingEngine:

    UTILIZATION_TIERS = [
        (0.50, 1.00),   # 0-50% utilization: 1.0x
        (0.70, 1.02),   # 50-70%: 1.02x
        (0.85, 1.05),   # 70-85%: 1.05x
        (1.00, 1.10),   # 85%+: 1.10x
    ]

    RUSH_PREMIUM = {
        'same_day': 1.25,      # 25% premium
        'next_day': 1.15,      # 15% premium
        'within_3_days': 1.05, # 5% premium
    }

    def calculate_demand_multiplier(self, scheduled_date, region_code):
        """
        Calculate multiplier based on:
        1. Current cleaner utilization in region
        2. Historical demand for this time slot
        3. Day of week (weekends higher)
        """
        utilization = self._get_region_utilization(region_code, scheduled_date)

        for threshold, multiplier in self.UTILIZATION_TIERS:
            if utilization <= threshold:
                return multiplier
        return 1.10  # Max multiplier

    def calculate_rush_premium(self, scheduled_date):
        """Apply premium for short-notice bookings."""
        days_ahead = (scheduled_date.date() - date.today()).days

        if days_ahead == 0:
            return self.RUSH_PREMIUM['same_day']
        elif days_ahead == 1:
            return self.RUSH_PREMIUM['next_day']
        elif days_ahead <= 3:
            return self.RUSH_PREMIUM['within_3_days']
        return 1.0

    def _get_region_utilization(self, region_code, date):
        """
        Utilization = booked_hours / available_hours

        Available = active_cleaners × working_hours_per_day
        Booked = sum of all booking durations
        """
        # Query from cache or calculate
        pass
```

**Database Addition:**

```sql
-- Add to bookings table
ALTER TABLE bookings ADD COLUMN demand_multiplier DECIMAL(4,2) DEFAULT 1.0;
ALTER TABLE bookings ADD COLUMN rush_premium DECIMAL(4,2) DEFAULT 1.0;
ALTER TABLE bookings ADD COLUMN utilization_at_booking DECIMAL(5,2);
```

---

### 3.3 MEDIUM PRIORITY - Enhanced Allocation Engine

**Upgrade to Redis-based Queue:**

```python
# allocation_engine.py

import redis
from datetime import datetime, timedelta

class AllocationEngine:

    FALLBACK_TIMEOUT_SECONDS = 3
    ALLOCATION_PRIORITIES = ['availability', 'queue_position', 'distance', 'rating']

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.queue_key = "cleaner:queue:{region}"
        self.status_key = "cleaner:status:{cleaner_id}"

    async def allocate_cleaner(self, booking) -> Optional[Employee]:
        """
        Real-time allocation with fallback.

        1. Get available cleaners from Redis
        2. Score by: queue_position (40%) + distance (30%) + rating (30%)
        3. Attempt assignment with 3-second timeout
        4. Fallback to next best if no response
        """
        region = self._get_region(booking.address.city)
        candidates = await self._get_sorted_candidates(region, booking)

        for candidate in candidates:
            assigned = await self._attempt_assignment(
                candidate,
                booking,
                timeout=self.FALLBACK_TIMEOUT_SECONDS
            )
            if assigned:
                return candidate

        return None  # No cleaner available

    async def _get_sorted_candidates(self, region, booking):
        """
        Score = (queue_weight × queue_score) +
                (distance_weight × distance_score) +
                (rating_weight × rating_score)
        """
        cleaners = await self._get_available_cleaners(region)

        scored = []
        for cleaner in cleaners:
            score = self._calculate_score(cleaner, booking)
            scored.append((score, cleaner))

        return [c for _, c in sorted(scored, reverse=True)]

    def _calculate_score(self, cleaner, booking):
        queue_score = self._normalize_queue_position(cleaner)  # 0-1
        distance_score = self._normalize_distance(cleaner, booking)  # 0-1
        rating_score = cleaner.rating / 5.0  # 0-1

        return (0.4 * queue_score) + (0.3 * distance_score) + (0.3 * rating_score)

    async def update_queue_position(self, cleaner_id, event):
        """
        Update queue position after:
        - Job completion: Move to back
        - Job cancellation: Move forward
        - Going online: Add to queue
        - Going offline: Remove from queue
        """
        pass
```

**Redis Data Structures:**

```
# Cleaner availability (Hash)
cleaner:status:{id} = {
    "status": "available",
    "last_job_end": "2024-01-30T10:00:00",
    "current_location": "25.2048,55.2708",
    "active_job_id": null
}

# Regional queue (Sorted Set - score = timestamp of last job end)
cleaner:queue:DXB = {
    "cleaner_uuid_1": 1706612400,  # Unix timestamp
    "cleaner_uuid_2": 1706612500,
    ...
}

# Real-time utilization (Hash)
region:utilization:DXB:2024-01-30 = {
    "total_hours": "80",
    "booked_hours": "45",
    "utilization": "0.5625"
}
```

---

### 3.4 MEDIUM PRIORITY - Notification System

**Extend existing infrastructure:**

```python
# notification_service.py

from enum import Enum
from typing import List, Optional
import asyncio

class NotificationChannel(Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

class NotificationEvent(Enum):
    # Booking
    BOOKING_CONFIRMED = "booking_confirmed"
    CLEANER_ASSIGNED = "cleaner_assigned"
    CLEANER_EN_ROUTE = "cleaner_en_route"
    JOB_STARTED = "job_started"
    JOB_COMPLETED = "job_completed"
    JOB_CANCELLED = "job_cancelled"

    # Payment
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    REFUND_PROCESSED = "refund_processed"

    # Subscription
    SUBSCRIPTION_CREATED = "subscription_created"
    SUBSCRIPTION_RENEWED = "subscription_renewed"
    SUBSCRIPTION_PAYMENT_FAILED = "subscription_payment_failed"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"

    # Reminders
    BOOKING_REMINDER_24H = "booking_reminder_24h"
    BOOKING_REMINDER_1H = "booking_reminder_1h"
    REVIEW_REQUEST = "review_request"

class NotificationService:

    TEMPLATES = {
        NotificationEvent.BOOKING_CONFIRMED: {
            "title": "Booking Confirmed!",
            "body": "Your {service_name} is scheduled for {date} at {time}.",
            "channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS]
        },
        NotificationEvent.CLEANER_ASSIGNED: {
            "title": "Cleaner Assigned",
            "body": "{cleaner_name} will be your cleaner. They'll arrive at {time}.",
            "channels": [NotificationChannel.IN_APP, NotificationChannel.PUSH]
        },
        # ... more templates
    }

    async def send(
        self,
        user_id: int,
        event: NotificationEvent,
        data: dict,
        channels: Optional[List[NotificationChannel]] = None
    ):
        template = self.TEMPLATES.get(event)
        if not template:
            return

        channels = channels or template["channels"]

        tasks = []
        for channel in channels:
            if channel == NotificationChannel.IN_APP:
                tasks.append(self._send_in_app(user_id, template, data))
            elif channel == NotificationChannel.EMAIL:
                tasks.append(self._send_email(user_id, template, data))
            elif channel == NotificationChannel.SMS:
                tasks.append(self._send_sms(user_id, template, data))
            elif channel == NotificationChannel.PUSH:
                tasks.append(self._send_push(user_id, template, data))

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_in_app(self, user_id, template, data):
        # Already implemented via WebSocket
        await event_publisher.publish(...)

    async def _send_email(self, user_id, template, data):
        # Use SendGrid/SES
        pass

    async def _send_sms(self, user_id, template, data):
        # Use Twilio
        pass

    async def _send_push(self, user_id, template, data):
        # Use Firebase Cloud Messaging
        pass
```

---

### 3.5 LOW PRIORITY - Wallet System

```sql
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'AED',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER REFERENCES wallets(id) NOT NULL,
    type VARCHAR(20) NOT NULL,  -- credit, debit, refund, cashback
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    reference_type VARCHAR(50),  -- booking, refund, promotion
    reference_id INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. EDGE CASES & RISK MITIGATION

### 4.1 Booking Edge Cases

| Edge Case | Current Handling | Required Action |
|-----------|------------------|-----------------|
| Double booking (same slot, same cleaner) | ✅ Time conflict check | None |
| Customer cancels within 30 min | ✅ Blocked with error | None |
| Cleaner doesn't start within SLA | ✅ SLA monitor detects | Add auto-reassignment |
| Cleaner goes offline mid-job | ⚡ Status change only | Add alert + reassignment |
| Payment fails after booking created | ⚡ Booking stays PENDING | Add auto-cancellation after 15 min |
| Same customer books overlapping slots | ❌ Not checked | Add validation |

### 4.2 Subscription Edge Cases

| Edge Case | Required Handling |
|-----------|-------------------|
| User tries to book when visits = 0 | Block with upgrade prompt |
| Preferred cleaner unavailable | Fallback to auto-assign with notification |
| Payment fails 3 times | Suspend subscription, notify user |
| User pauses mid-month | Prorate unused visits to rollover |
| User cancels with visits remaining | No refund, visits valid until cycle end |
| Cleaner terminated mid-subscription | Auto-assign new preferred cleaner |

### 4.3 Allocation Edge Cases

| Edge Case | Required Handling |
|-----------|-------------------|
| No cleaners in region | Expand search to adjacent regions |
| All cleaners busy | Queue booking with ETA notification |
| Cleaner accepts but doesn't arrive | Auto-reassign after SLA + 10 min |
| Multiple bookings at exact same time | Queue-based ordering (FIFO) |
| VIP customer vs regular | Priority queue (future feature) |

### 4.4 Payment Edge Cases

| Edge Case | Current | Required |
|-----------|---------|----------|
| Stripe webhook fails | ❌ | Add retry queue + idempotency |
| Partial refund calculation | ⚡ Manual | Auto-calculate based on service progress |
| Currency mismatch | ❌ | Validate AED/USD conversion |
| Duplicate payment attempts | ⚡ Session-based | Add idempotency key validation |

---

## 5. PHASED IMPLEMENTATION ROADMAP

### Phase 1: Core Stability (Week 1-2)
**Goal:** Fix critical gaps and edge cases

- [ ] Add customer overlap booking validation
- [ ] Implement payment timeout (auto-cancel after 15 min)
- [ ] Enable manual reassignment endpoint
- [ ] Add cleaner offline mid-job alert
- [ ] Complete discount code integration
- [ ] Add Stripe webhook retry logic

### Phase 2: Dynamic Pricing (Week 3-4)
**Goal:** Implement utilization-based pricing

- [ ] Create PricingEngine service
- [ ] Add utilization tracking (cache-based)
- [ ] Implement rush pricing
- [ ] Add pricing fields to booking model
- [ ] Update booking creation flow
- [ ] Add pricing breakdown to UI

### Phase 3: Enhanced Allocation (Week 5-6)
**Goal:** Upgrade to Redis-based real-time allocation

- [ ] Set up Redis data structures
- [ ] Implement queue-based allocation
- [ ] Add distance calculation (Haversine)
- [ ] Implement rating in scoring
- [ ] Add 3-second fallback timeout
- [ ] Create allocation dashboard metrics

### Phase 4: Subscription System (Week 7-10)
**Goal:** Full subscription implementation

- [ ] Create subscription database models
- [ ] Implement SubscriptionService
- [ ] Create Stripe subscription integration
- [ ] Build calendar generation
- [ ] Implement pause/resume logic
- [ ] Add rollover calculation
- [ ] Build subscription UI (customer)
- [ ] Add admin subscription controls

### Phase 5: Notifications (Week 11-12)
**Goal:** Multi-channel notifications

- [ ] Integrate SendGrid for email
- [ ] Integrate Twilio for SMS
- [ ] Set up Firebase for push
- [ ] Create notification templates
- [ ] Implement delivery tracking
- [ ] Add user notification preferences

### Phase 6: Cleaner Enhancements (Week 13-14)
**Goal:** Complete cleaner app features

- [ ] Build earnings dashboard
- [ ] Add job history with stats
- [ ] Implement in-app navigation
- [ ] Add photo verification on completion
- [ ] Create performance leaderboard

### Phase 7: Customer Enhancements (Week 15-16)
**Goal:** Enhanced customer experience

- [ ] Implement wallet system
- [ ] Add live cleaner tracking
- [ ] Build loyalty/rewards program
- [ ] Add favorite cleaners feature
- [ ] Implement referral system

---

## 6. TECHNICAL SPECIFICATIONS

### 6.1 API Design Updates

**New Endpoints Required:**

```yaml
# Subscription APIs
/api/subscriptions:
  POST: Create subscription
  GET: List user subscriptions

/api/subscriptions/{id}:
  GET: Get subscription details
  PUT: Update subscription
  DELETE: Cancel subscription

/api/subscriptions/{id}/pause:
  POST: Pause subscription

/api/subscriptions/{id}/resume:
  POST: Resume subscription

/api/subscriptions/{id}/visits:
  GET: List visits in current cycle
  POST: Book a visit

/api/subscriptions/plans:
  GET: List available plans

# Wallet APIs
/api/wallet:
  GET: Get balance

/api/wallet/transactions:
  GET: List transactions

/api/wallet/topup:
  POST: Add funds

# Enhanced Booking APIs
/api/bookings/pricing-preview:
  POST: Get dynamic pricing before booking

/api/bookings/{id}/track:
  GET: Get real-time cleaner location
```

### 6.2 Event Types (Extended)

```python
class EventType(Enum):
    # Existing
    JOB_CREATED = "job.created"
    JOB_ASSIGNED = "job.assigned"
    JOB_STARTED = "job.started"
    JOB_COMPLETED = "job.completed"
    JOB_CANCELLED = "job.cancelled"
    JOB_FAILED = "job.failed"
    JOB_PAUSED = "job.paused"
    JOB_RESUMED = "job.resumed"
    JOB_DELAYED = "job.delayed"

    CLEANER_ONLINE = "cleaner.online"
    CLEANER_OFFLINE = "cleaner.offline"
    CLEANER_STATUS_CHANGED = "cleaner.status_changed"
    CLEANER_LOCATION_UPDATE = "cleaner.location_update"  # NEW

    # New - Subscription
    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_RENEWED = "subscription.renewed"
    SUBSCRIPTION_PAUSED = "subscription.paused"
    SUBSCRIPTION_RESUMED = "subscription.resumed"
    SUBSCRIPTION_CANCELLED = "subscription.cancelled"
    SUBSCRIPTION_PAYMENT_FAILED = "subscription.payment_failed"

    # New - Payment
    PAYMENT_SUCCEEDED = "payment.succeeded"
    PAYMENT_FAILED = "payment.failed"
    REFUND_PROCESSED = "refund.processed"

    # New - Wallet
    WALLET_CREDITED = "wallet.credited"
    WALLET_DEBITED = "wallet.debited"
```

### 6.3 Configuration

```python
# config.py additions

class Settings:
    # Existing...

    # Pricing
    RUSH_SAME_DAY_MULTIPLIER: float = 1.25
    RUSH_NEXT_DAY_MULTIPLIER: float = 1.15
    RUSH_3DAY_MULTIPLIER: float = 1.05

    # Utilization tiers
    UTILIZATION_TIER_1: tuple = (0.50, 1.00)
    UTILIZATION_TIER_2: tuple = (0.70, 1.02)
    UTILIZATION_TIER_3: tuple = (0.85, 1.05)
    UTILIZATION_TIER_4: tuple = (1.00, 1.10)

    # Allocation
    ALLOCATION_TIMEOUT_SECONDS: int = 3
    ALLOCATION_QUEUE_WEIGHT: float = 0.4
    ALLOCATION_DISTANCE_WEIGHT: float = 0.3
    ALLOCATION_RATING_WEIGHT: float = 0.3

    # Subscription
    SUBSCRIPTION_ROLLOVER_MAX: int = 4
    SUBSCRIPTION_PAYMENT_RETRY_HOURS: list = [1, 12, 24]

    # Booking
    BOOKING_PAYMENT_TIMEOUT_MINUTES: int = 15
    BOOKING_MIN_ADVANCE_HOURS: int = 2

    # SLA
    SLA_START_WINDOW_MINUTES: int = 10
    SLA_AUTO_REASSIGN_AFTER_MINUTES: int = 20
```

---

## 7. SUCCESS METRICS (Updated)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cleaner idle time | < 15% | (offline_hours / working_hours) per day |
| Assignment latency | < 3 seconds | Time from booking to cleaner assigned |
| Subscription retention | > 70% | Renewals / (Renewals + Cancellations) |
| Booking confirmation rate | > 95% | Confirmed / Created |
| Cancellation rate | < 5% | Cancelled / Total |
| Customer satisfaction | > 4.5 | Average review rating |
| Payment success rate | > 98% | Successful / Attempted |
| SLA compliance | > 95% | On-time starts / Total |

---

## 8. COST PROJECTIONS

### Infrastructure (Monthly)

| Component | Provider | Estimated Cost |
|-----------|----------|----------------|
| Compute (API servers) | AWS ECS/Fargate | $500-800 |
| Database (PostgreSQL) | AWS RDS | $200-400 |
| Cache (Redis) | AWS ElastiCache | $100-200 |
| Storage (S3) | AWS S3 | $50-100 |
| CDN | CloudFront | $50-100 |
| Email (SendGrid) | SendGrid | $20-50 |
| SMS (Twilio) | Twilio | $100-300 |
| Push (Firebase) | Firebase | Free-$25 |
| Monitoring | DataDog/CloudWatch | $100-200 |
| **Total** | | **$1,120-2,175** |

### Development Resources

| Role | Count | Duration | Focus |
|------|-------|----------|-------|
| Backend Engineer | 2 | 16 weeks | Subscription, Allocation, Pricing |
| Frontend Engineer | 1 | 16 weeks | Dashboard, Mobile UI |
| DevOps | 1 | 8 weeks | Redis, Monitoring, CI/CD |
| QA | 1 | 12 weeks | Test automation |

---

## 9. RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Redis downtime | Low | High | Fallback to in-memory + DB |
| Stripe API changes | Low | Medium | Abstract payment interface |
| Cleaner shortage | Medium | High | Dynamic pricing increases supply |
| Subscription churn | Medium | High | Engagement features, rollover |
| SMS delivery failures | Medium | Medium | Multi-provider fallback |
| Concurrent booking conflicts | Low | High | Optimistic locking (implemented) |

---

## 10. APPENDIX

### A. City-to-Region Mapping (UAE)

```python
CITY_REGION_MAP = {
    # Dubai
    "dubai": "DXB",
    "jumeirah": "DXB",
    "marina": "DXB",
    "downtown": "DXB",

    # Abu Dhabi
    "abu dhabi": "AUH",
    "al ain": "AUH",

    # Sharjah
    "sharjah": "SHJ",

    # Ajman
    "ajman": "AJM",

    # Ras Al Khaimah
    "ras al khaimah": "RAK",
    "rak": "RAK",

    # Fujairah
    "fujairah": "FUJ",

    # Umm Al Quwain
    "umm al quwain": "UAQ",
}
```

### B. Booking Status Transition Rules

```python
VALID_TRANSITIONS = {
    BookingStatus.PENDING: [BookingStatus.PENDING_ASSIGNMENT, BookingStatus.CANCELLED],
    BookingStatus.PENDING_ASSIGNMENT: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
    BookingStatus.CONFIRMED: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
    BookingStatus.ASSIGNED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    BookingStatus.IN_PROGRESS: [BookingStatus.PAUSED, BookingStatus.COMPLETED, BookingStatus.FAILED, BookingStatus.CANCELLED],
    BookingStatus.PAUSED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    BookingStatus.COMPLETED: [],  # Terminal
    BookingStatus.CANCELLED: [BookingStatus.REFUNDED],
    BookingStatus.FAILED: [BookingStatus.PENDING_ASSIGNMENT],
    BookingStatus.REFUNDED: [],  # Terminal
    BookingStatus.NO_SHOW: [],  # Terminal
}
```

---

*Document Version: 2.0*
*Last Updated: January 30, 2026*
*Status: Refined & Ready for Implementation*
