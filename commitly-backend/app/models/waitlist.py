from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Waitlist(Base):
    """ORM model representing a waitlist entry."""

    __tablename__ = "waitlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), default="landing", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WaitlistCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    source: str = Field(default="landing", max_length=100)


class WaitlistResponse(BaseModel):
    id: int
    email: EmailStr
    source: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class WaitlistCountResponse(BaseModel):
    count: int
