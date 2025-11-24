from app.core.auth import ClerkClaims, require_clerk_auth
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/ping")
async def auth_ping(
    current_user: ClerkClaims = Depends(require_clerk_auth),
) -> dict[str, str | None]:
    return {
        "status": "ok",
        "user_id": current_user["sub"],
        "session_id": current_user.get("sid"),
    }
