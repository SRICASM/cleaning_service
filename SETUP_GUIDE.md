# BrightHome Cleaning Service - Complete Setup Guide

## Prerequisites
- **macOS** (or Linux/Windows with adjustments)
- **Python 3.8+**
- **Node.js 18+** (v24 may have issues)
- **Docker Desktop** (for MongoDB)

---

## Step 1: Install MongoDB via Docker

```bash
# Start Docker Desktop first, then run:
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

To start MongoDB after restart:
```bash
docker start mongodb
```

---

## Step 2: Backend Setup

### 2.1 Create Virtual Environment
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### 2.2 Fix Requirements
Remove `emergentintegrations==0.1.0` from `requirements.txt` (line 20) - it's a proprietary package.

### 2.3 Create Mock Package
Create folder structure: `backend/emergentintegrations/payments/stripe/`

Create these files:

**`emergentintegrations/__init__.py`**
```python
# Mock package
```

**`emergentintegrations/payments/__init__.py`**
```python
# Mock module
```

**`emergentintegrations/payments/stripe/__init__.py`**
```python
# Mock module
```

**`emergentintegrations/payments/stripe/checkout.py`** - Full implementation provided in this codebase.

### 2.4 Install Dependencies
```bash
pip install -r requirements.txt
```

### 2.5 Create `.env` File
Create `backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=brighthome
JWT_SECRET=super-secret-key-change-this-in-prod
STRIPE_API_KEY=sk_test_placeholder
CORS_ORIGINS=http://localhost:3000
HOST_URL=http://localhost:8000
```

### 2.6 Start Backend
```bash
uvicorn server:app --reload --port 8000
```

### 2.7 Seed Database
```bash
curl -X POST http://localhost:8000/api/seed
```

---

## Step 3: Frontend Setup

### 3.1 Fix `package.json` Versions
Update these in `frontend/package.json`:
```json
"react": "^18.2.0",
"react-dom": "^18.2.0",
"react-router-dom": "^6.22.3",
"date-fns": "^3.6.0",
"react-scripts": "^5.0.1",
"@craco/craco": "^7.1.0",
"eslint": "^8.57.0"
```

### 3.2 Install `ajv` (fixes module error)
```bash
npm install ajv@8 --legacy-peer-deps
```

### 3.3 Install Dependencies
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 3.4 Create `.env` File
Create `frontend/.env`:
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

### 3.5 Remove Emergent Watermark (Optional)
Edit `frontend/public/index.html` - remove the `<a id="emergent-badge">` block and associated scripts.

### 3.6 Start Frontend
```bash
npm start
```

---

## Step 4: Bypass Payment (For Testing)

### Backend (`server.py` ~line 318)
Change:
```python
"status": "pending",
"payment_status": "pending",
```
To:
```python
"status": "confirmed",
"payment_status": "paid",
```

### Frontend (`src/pages/BookingPage.jsx` ~line 168)
Comment out Stripe payment code and add:
```javascript
toast.success('Booking confirmed!');
navigate(`/booking/success?session_id=test_${bookingRes.data.id}`);
```

---

## How to Run Backend and Frontend

### Step 1: Start MongoDB (Required First)
Open Docker Desktop app, then run in terminal:
```bash
docker start mongodb
```

### Step 2: Start Backend (Terminal 1)
```bash
# Navigate to project folder
cd /path/to/cleaning_service

# Go to backend folder
cd backend

# Activate virtual environment
source venv/bin/activate

# Start the server
uvicorn server:app --reload --port 8000
```
Keep this terminal open. You'll see "Application startup complete."

### Step 3: Start Frontend (Terminal 2)
Open a NEW terminal window, then:
```bash
# Navigate to project folder
cd /path/to/cleaning_service

# Go to frontend folder
cd frontend

# Start the app
npm start
```
Keep this terminal open. Browser will open automatically.

### Step 4: Open the Website
- **Website:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs

---

## How to Stop Everything

1. **Stop Frontend:** Press `Ctrl+C` in Terminal 2
2. **Stop Backend:** Press `Ctrl+C` in Terminal 1
3. **Stop MongoDB:** `docker stop mongodb`

---

## Access the Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Default Login
- **Admin:** admin@brighthome.com / admin123

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Cannot find module 'ajv/dist/compile/codegen'` | Run `npm install ajv@8 --legacy-peer-deps` |
| `Cannot find module 'react-scripts'` | Update react-scripts to `^5.0.1` in package.json |
| MongoDB connection refused | Start Docker: `docker start mongodb` |
| Registration failed | Create `frontend/.env` with `REACT_APP_BACKEND_URL=http://localhost:8000` |
| `emergentintegrations` not found | Remove from requirements.txt, use mock package |
