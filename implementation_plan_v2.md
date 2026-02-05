# Snabbit-Style Home Services Platform - Implementation Plan

This plan outlines the steps to upgrade the current "CleanUpCrew" application to match the "Snabbit" style Product Requirements Document (PRD).

**Note on Technology:** The PRD mentions Node.js, but your current backend is **Python/Flask**. This plan adapts the requirements to function within your **existing Python backend** to maintain continuity and avoid a complete rewrite.

---

## Phase 1: Database & Backend Foundation
*Goal: Update the data models to support new booking types, wallets, and service categories.*

### 1.1 Update Database Models (`backend/app/models/`)
- [ ] **Users Table**: Add `wallet_balance` (Decimal), `referral_code` (String).
- [ ] **Services Table**: Seed the 5 specific categories:
    - House Cleaning, Dusting & Wiping, Bathroom Cleaning, Laundry & Ironing, Cleaning Dishes.
- [ ] **Bookings Table**: Add `booking_type` Enum (`instant`, `single`, `multiple`, `custom`).
    - Add `recurrence_pattern` (JSON) to store custom schedule details (e.g., "Mon, Wed, Fri").
- [ ] **Wallets Transaction Table**: Create a new table to track credit/debit history.

### 1.2 Backend API Updates (`backend/app/api/`)
- [ ] **Wallet Endpoints**: `GET /api/wallet/balance`, `GET /api/wallet/history`.
- [ ] **Booking Endpoints**: Update `POST /api/bookings` to handle the 4 new booking types.
    - Logic for "Instant": Must check *current day's* slots immediately.
    - Logic for "Multiple"/"Custom": Create parent booking with child instances or recurring pattern storage.

---

## Phase 2: Home Page Redesign (Snabbit Style)
*Goal: Create the "Instant" vs "Schedule" entry points and new Header.*

### 2.1 New Header Components
- [ ] **Location Selector**: Create `LocationHeader.jsx` (Top left) showing current saved address.
- [ ] **Wallet & Profile Icons**: Add Wallet icon (with balance badge) and Profile icon to top right.

### 2.2 Hero & Action Cards
- [ ] **Primary Action Cards**: Create two large, distinct cards on Home Page:
    - **"Instant"**: Lightning icon, "Get help now".
    - **"Schedule"**: Calendar icon, "Pick your time".
- [ ] **Services Grid**: Update the grid to display the 5 new icons/categories.
- [ ] **Sticky Banner**: Implement the "Starter Pack" (3 visits for ₹149) fixed bottom banner.

---

## Phase 3: The "Instant" Booking Flow
*Goal: A fast, streamlined flow for immediate service.*

### 3.1 Instant Logic
- [ ] **Availability Check**: On clicking "Instant", immediately fetch *today's* remaining slots.
    - If no slots, show "Experts are busy" alert.
- [ ] **Simplified Scheduler**:
    - Select Duration (60/90/120 min) cards.
    - Select Time Slot (Next available 15-min intervals).
    - **No date picker** (implicitly "Today").

---

## Phase 4: The "Schedule" Booking Flow (Advanced)
*Goal: The 3-Tab Scheduling System.*

### 4.1 Tab Interface (`ScheduleBooking.jsx`)
- [ ] Implement a Tab system: **Single | Multiple | Custom**.

### 4.2 Single Tab
- [ ] Reuse existing logic but style match the PRD (Horizontal Date Picker `Today | Tomorrow | [Date]`).

### 4.3 Multiple Tab (Date Range)
- [ ] Implement `DateRangePicker` component (Select Start Date -> Select End Date).
- [ ] Calculate total days and apply "bulk discount" logic automatically.

### 4.4 Custom Tab (Days of Week)
- [ ] Implement `WeekDaySelector` (Chips: M, T, W, T, F, S, S).
- [ ] Implement `DateRangePicker` for the duration of this pattern.
- [ ] Logic: "Every Mon, Wed, Fri between [Start] and [End]".

---

## Phase 5: Wallet & Profile Features
*Goal: Gamification and retention.*

### 5.1 Wallet System
- [ ] **Wallet Page**: Display current balance and transaction history.
- [ ] **Checkout Integration**: Add "Pay with Wallet" checkbox in `BookingReview.jsx`.
    - Backend: Deduct from wallet balance before charging remaining amount.

### 5.2 Referral System
- [ ] **Referral Card**: "Earn ₹150" card in Profile.
- [ ] **Share Function**: Simple copy-to-clipboard of user's `referral_code`.

---

## Phase 6: UI Polish & Aesthetics
*Goal: Match the "Emerald/Pink" design system defined in PRD.*

- [ ] **Theme Update (`index.css`)**:
    - Define `Primary Pink` (#E91E63) for "Instant" actions.
    - Define `Success Green` (#4CAF50) for offers.
- [ ] **Micro-interactions**:
    - Skeleton loaders for all data fetching.
    - Slide-up panels on mobile for date selection.
