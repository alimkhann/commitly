from fastapi import APIRouter, HTTPException, Header

from app.services.supabase_client import (
    get_supabase_admin_client,
    get_supabase_user_from_token,
)

router = APIRouter()


@router.post("/delete")
def delete_account(authorization: str = Header(...)):
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing bearer token")
    token = authorization.split(" ", 1)[1]
    user = get_supabase_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    client.auth.admin.delete_user(user.id)
    return {"status": "deleted"}
