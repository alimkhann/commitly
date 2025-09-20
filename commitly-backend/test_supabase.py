import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def create_tables():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    client: Client = create_client(url, key)
    
    try:
        # Test connection
        print("Testing Supabase connection...")
        
        # Try to create waitlist table
        print("Creating waitlist table...")
        result = client.table("waitlist").insert({
            "email": "test@example.com",
            "source": "test"
        }).execute()
        print("Waitlist table exists and is accessible!")
        
        # Try to create support table
        print("Creating support table...")
        result = client.table("support").insert({
            "email": "test@example.com",
            "message": "Test message",
            "status": "new"
        }).execute()
        print("Support table exists and is accessible!")
        
        return True
    except Exception as e:
        print(f"Error: {e}")
        print("Tables may not exist yet. Please create them manually in Supabase dashboard.")
        return False

if __name__ == "__main__":
    create_tables()
