from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.services.polar import PolarService, PolarConfigurationError

router = APIRouter()


class DonateRequest(BaseModel):
    amount_cents: Optional[int] = Field(default=None, ge=50, le=99_999_999)
    email: Optional[EmailStr] = None


class DonateResponse(BaseModel):
    checkout_id: str
    url: str


@router.post("/checkout", response_model=DonateResponse, status_code=status.HTTP_201_CREATED)
def create_donation_checkout(payload: DonateRequest) -> DonateResponse:
    try:
        service = PolarService()
        result = service.create_checkout(amount_cents=payload.amount_cents, email=payload.email)
        return DonateResponse(checkout_id=result["id"], url=result["url"])
    except PolarConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create donation checkout") from exc
