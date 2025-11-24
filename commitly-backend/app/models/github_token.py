from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GitHubCredential(Base):
    __tablename__ = "github_credentials"
    __table_args__ = (
        UniqueConstraint("clerk_user_id", name="uq_github_credentials_clerk_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_type: Mapped[str] = mapped_column(String(50), nullable=False)
    scope: Mapped[str] = mapped_column(String(255), nullable=False)
    github_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    github_login: Mapped[str] = mapped_column(String(255), nullable=False)
    github_avatar_url: Mapped[str | None] = mapped_column(String(500))
    github_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
