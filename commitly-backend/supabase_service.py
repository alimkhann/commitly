from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

class SupabaseService:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_ANON_KEY")
        self.client: Client = create_client(self.url, self.key)
    
    def add_to_waitlist(self, email: str, source: str = "landing"):
        try:
            result = self.client.table("waitlist").insert({
                "email": email,
                "source": source
            }).execute()
            return {"success": True, "data": result.data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_waitlist_count(self):
        try:
            result = self.client.table("waitlist").select("id", count="exact").execute()
            return {"success": True, "count": result.count}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def add_support_request(self, email: str, message: str):
        try:
            result = self.client.table("support").insert({
                "email": email,
                "message": message,
                "status": "new"
            }).execute()
            return {"success": True, "data": result.data}
        except Exception as e:
            return {"success": False, "error": str(e)}

supabase_service = SupabaseService()
