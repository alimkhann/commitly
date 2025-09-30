from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from app.core.config import settings


@lru_cache()
def get_supabase_admin_client() -> Optional[Client]:
    url = str(settings.supabase_url)
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    if not url or not key:
        return None
    client = create_client(url, key)
    try:
        client.postgrest.client.headers["Prefer"] = "return=minimal,bypass-rls"
    except Exception:
        pass
    return client


def get_supabase_user_from_token(token: str):
    client = get_supabase_admin_client()
    if not client:
        return None
    try:
        response = client.auth.get_user(token)
        return response.user
    except Exception:
        return None
