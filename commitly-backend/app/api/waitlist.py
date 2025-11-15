from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import ClerkClaims, require_clerk_auth
from app.core.database import get_db
from app.models.waitlist import WaitlistCountResponse, WaitlistCreate, WaitlistResponse
from app.services.supabase import DuplicateEntryError, PersistenceError, SupabaseService

router = APIRouter()


@router.post(
    "/",
    response_model=WaitlistResponse,
    status_code=status.HTTP_201_CREATED,
)
def join_waitlist(
    payload: WaitlistCreate,
    claims: ClerkClaims = Depends(require_clerk_auth),
    session: Session = Depends(get_db),
) -> WaitlistResponse:
    service = SupabaseService(session)
    actor_id: str | None = claims.get("sub")
    try:
        entry = service.add_to_waitlist(payload, requested_by=actor_id)
    except DuplicateEntryError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already on the waitlist.",
        )
    except PersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )

    return WaitlistResponse.model_validate(entry)


@router.get("/count", response_model=WaitlistCountResponse)
def get_waitlist_count(session: Session = Depends(get_db)) -> WaitlistCountResponse:
    service = SupabaseService(session)
    try:
        count = service.waitlist_count()
    except PersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )

    return WaitlistCountResponse(count=count)
