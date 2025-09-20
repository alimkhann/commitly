from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.support import SupportCreate, SupportResponse
from app.services.supabase import PersistenceError, SupabaseService

router = APIRouter()


@router.post(
    "/",
    response_model=SupportResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_support_request(payload: SupportCreate, session: Session = Depends(get_db)) -> SupportResponse:
    service = SupabaseService(session)
    try:
        ticket = service.create_support_request(payload)
    except PersistenceError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return SupportResponse.model_validate(ticket)
