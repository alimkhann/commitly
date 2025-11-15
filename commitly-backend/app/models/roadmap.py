from __future__ import annotations

from datetime import datetime
from typing import Annotated, List, Literal, Optional

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RepoCommitChunk(Base):
    """Stores commit chunks that feed the roadmap RAG pipeline."""

    __tablename__ = "repo_commit_chunks"
    __table_args__ = (UniqueConstraint("chunk_hash", name="uq_repo_commit_chunk_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repo_full_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    commit_sha: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    chunk_type: Mapped[str] = mapped_column(String(32), nullable=False)
    chunk_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    authored_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class GeneratedRoadmap(Base):
    """Stores the latest generated roadmap for a repository."""

    __tablename__ = "generated_roadmaps"
    __table_args__ = (
        UniqueConstraint("repo_full_name", name="uq_generated_roadmap_full_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repo_full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_summary: Mapped[dict] = mapped_column(JSON, nullable=False)
    timeline: Mapped[list] = mapped_column(JSON, nullable=False)
    cached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class RoadmapRequest(BaseModel):
    repo_url: AnyHttpUrl = Field(description="GitHub repository URL")
    force_refresh: bool = Field(
        default=False, description="Bypass cache and recompute the roadmap"
    )


class TimelineResource(BaseModel):
    label: str
    href: Annotated[str, Field(max_length=500)]


class TimelineStage(BaseModel):
    id: str
    title: str
    summary: str
    status: Literal["not-started", "in-progress", "done"]
    eta: str
    tasks: List[str]
    resources: List[TimelineResource]


class RoadmapRepoSummary(BaseModel):
    full_name: str
    description: Optional[str]
    language: Optional[str]
    stars: int
    default_branch: str
    html_url: Optional[AnyHttpUrl]
    owner_avatar_url: Optional[AnyHttpUrl]


class RoadmapResponse(BaseModel):
    repo: RoadmapRepoSummary
    timeline: List[TimelineStage]
    cached: bool
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
