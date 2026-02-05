import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"
EMAIL = "admin@cleanupcrew.com"
PASSWORD = "admin123"

def debug_booking_creation():
    # 1. Login
    print(f"Logging in as {EMAIL}...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get User ID & Addresses
    user_resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    user = user_resp.json()
    print(f"User ID: {user['id']}")
    
    addr_resp = requests.get(f"{BASE_URL}/users/me/addresses", headers=headers)
    addresses = addr_resp.json()
    if not addresses:
        print("No addresses found for user. Cannot test 'existing address' flow.")
        return
        
    address_id = addresses[0]['id']
    print(f"Using Address ID: {address_id}")

    # 3. Construct Booking Payload (mimicking BookingPage.jsx)
    # Using hardcoded service ID, finding one first
    services = requests.get(f"{BASE_URL}/services").json()
    if not services:
        print("No services found.")
        return
    service_id = services[0]['id']
    
    booking_date = (datetime.utcnow() + timedelta(days=2)).isoformat()
    
    payload = {
        "service_id": service_id,
        "address_id": address_id,
        "address_details": None, # Explicitly sending None as frontend does? logic says: (isNewAddress || isDefault) ? null : reviewData.address?.id
        # Actually frontend sends address_id OR address_details inside conditional
        # Let's mimic exact frontend logic: if existing addr, address_id is set.
        
        "scheduled_date": booking_date,
        "property_size_sqft": 1000, # Mock value
        "bedrooms": 2,
        "bathrooms": 1,
        "add_on_ids": [],
        "customer_notes": "Test booking via script",
        "discount_code": None,
        "use_subscription": False
    }
    
    print("\nSending Booking Payload:")
    print(json.dumps(payload, indent=2))
    
    resp = requests.post(f"{BASE_URL}/bookings/", json=payload, headers=headers)
    
    print(f"\nResponse Status: {resp.status_code}")
    print(f"Response Body: {resp.text}")

debug_booking_creation()
