import requests
import json
import secrets

BASE_URL = "http://localhost:8000/api"
EMAIL = "admin@cleanupcrew.com"
PASSWORD = "admin123"

def verify_address_flow():
    # 1. Login
    print(f"Logging in as {EMAIL}...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 2. Check initial addresses
    print("Checking initial addresses...")
    resp = requests.get(f"{BASE_URL}/users/me/addresses", headers=headers)
    initial_count = len(resp.json())
    print(f"Initial count: {initial_count}")

    # 3. Create new address
    random_suffix = secrets.token_hex(4)
    new_address = {
        "label": "Test Office",
        "street_address": f"Test Street {random_suffix}",
        "city": "Test City",
        "postal_code": "123456",
        "is_default": True
    }
    print(f"Creating new address: {new_address['street_address']}...")
    resp = requests.post(f"{BASE_URL}/users/me/addresses", json=new_address, headers=headers)
    if resp.status_code == 200:
        print("Address created successfully.")
        print(json.dumps(resp.json(), indent=2))
    else:
        print(f"Failed to create address: {resp.text}")
        return

    # 4. Verify it appears in list
    print("Verifying address in list...")
    resp = requests.get(f"{BASE_URL}/users/me/addresses", headers=headers)
    final_list = resp.json()
    print(f"Final count: {len(final_list)}")
    
    found = False
    for addr in final_list:
        if addr["street_address"] == new_address["street_address"]:
            found = True
            print("✅ Verified! Address found in list.")
            break
            
    if not found:
        print("❌ Failed! Address NOT found in list.")

verify_address_flow()
