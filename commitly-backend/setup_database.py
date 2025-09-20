import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def create_tables():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    client: Client = create_client(url, key)
    
    # Read SQL file
    with open("create_tables.sql", "r") as f:
        sql = f.read()
    
    try:
        # Execute SQL
        result = client.rpc("exec_sql", {"sql": sql}).execute()
        print("Tables created successfully!")
        return True
    except Exception as e:
        print(f"Error creating tables: {e}")
        return False

if __name__ == "__main__":
    create_tables()
