import requests
import json

BASE_URL = "http://localhost:8000/api"
EMAIL = "shrijanshrestha@example.com" # Just guessing email based on username, but wait, the username was 'shrijanshrestha' in postgres, but login uses email.
# Let's check test_db_credentials.py again or create_customer.py to see what email was used.
# Ah, I saw 'shrijan@123.com' in the previous check_user_address.py output for ID 2, and 'shrijan62@gmail.com' for ID 4.
# I will try to login with both.

def test_login_and_fetch_addresses(email, password):
    print(f"Testing login for {email}...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            print("Login Successful!")
            token = resp.json()["token"]
            print(f"Token received. Fetching addresses...")
            
            addr_resp = requests.get(f"{BASE_URL}/users/me/addresses", headers={"Authorization": f"Bearer {token}"})
            print(f"Address Response Code: {addr_resp.status_code}")
            if addr_resp.status_code == 200:
                print("Address Response Body:")
                print(json.dumps(addr_resp.json(), indent=2))
            else:
                print(f"Failed to fetch addresses: {addr_resp.text}")
        else:
            print(f"Login Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

# Try the user created in previous sessions or likely users
test_login_and_fetch_addresses("shrijan@123.com", "password123")
test_login_and_fetch_addresses("customer@example.com", "customer123")
test_login_and_fetch_addresses("admin@cleanupcrew.com", "admin123")
