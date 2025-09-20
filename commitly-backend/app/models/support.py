from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Support(Base):
    """ORM model representing a support ticket raised from the landing page."""

    __tablename__ = "support"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="new", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SupportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    message: str = Field(min_length=1)


class SupportResponse(BaseModel):
    id: int
    email: EmailStr
    message: str
    status: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
