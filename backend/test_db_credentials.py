import psycopg2
import sys

# Define combinations to try
usernames = ["postgres", "shrijanshrestha", "cleanup_admin", "admin", "root", "cleanupcrew"]
passwords = ["password123", "admin123", "postgres", "password", "cleanup123", ""]
database = "postgres"  # Try connecting to default db first

print(f"Testing connections to '{database}' on localhost:5433...")

success = False

for user in usernames:
    for password in passwords:
        try:
            print(f"Trying User: {user} | Password: {password} ... ", end="")
            conn = psycopg2.connect(
                host="localhost",
                port="5433",
                database=database,
                user=user,
                password=password
            )
            print("SUCCESS! ✅")
            print(f"\n✅ FOUND WORKING CREDENTIALS:\nUser: {user}\nPassword: {password}")
            
            # Additional check: does cleanupcrew db exist?
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1 FROM pg_database WHERE datname='cleanupcrew'")
                exists = cur.fetchone()
                if exists:
                    print("✅ Database 'cleanupcrew' exists.")
                else:
                    print("⚠️  Database 'cleanupcrew' does NOT exist.")
                cur.close()
            except Exception as e:
                print(f"Could not check databases: {e}")
                
            conn.close()
            success = True
            break
        except psycopg2.OperationalError as e:
            # print(f"Failed: {e}")
            print("Failed ❌")
        except Exception as e:
             print(f"Error: {e}")
             
    if success:
        break

if not success:
    print("\n❌ No working credentials found in standard list.")
    sys.exit(1)
