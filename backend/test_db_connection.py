import psycopg2
import sys
from urllib.parse import quote_plus

# Try raw password first
password_raw = "Abcd$1234"
# Try encoded password
password_encoded = quote_plus(password_raw)

print(f"Testing connection with password: {password_raw}")

try:
    # Attempt 1: Raw string (might have issues with special chars in URL)
    conn = psycopg2.connect(
        dbname="cleanupcrew",
        user="cleanup_admin",
        password="password123",
        host="localhost",
        port="5432"
    )
    print("SUCCESS: Connected with RAW password!")
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f"Failed with raw password: {e}")

print("-" * 20)

try:
    # Attempt 2: Try connecting to default 'postgres' db in case cleanupcrew doesn't exist
    print("Testing connection to 'postgres' database (to check if user exists)...")
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password=password_raw,
        host="localhost",
        port="5432"
    )
    print("SUCCESS: Connected to 'postgres' DB! (User validation passed)")
    print("Issue might be that 'cleanupcrew' database does not exist.")
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f"Failed to connect to 'postgres' DB: {e}")
