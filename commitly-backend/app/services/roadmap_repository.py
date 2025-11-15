from __future__ import annotations

from typing import Iterable

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.roadmap import (
    GeneratedRoadmap,
    RoadmapRepoSummary,
    RoadmapResponse,
    TimelineStage,
)


class RoadmapResultStore:
    """Persists generated roadmaps for later retrieval."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def upsert(self, response: RoadmapResponse) -> None:
        summary = response.repo.model_dump()
        timeline_payload = [stage.model_dump() for stage in response.timeline]
        record = (
            self._session.query(GeneratedRoadmap)
            .filter_by(repo_full_name=summary["full_name"])
            .one_or_none()
        )
        if record:
            record.repo_summary = summary
            record.timeline = timeline_payload
            record.cached = response.cached
            record.generated_at = response.generated_at
        else:
            record = GeneratedRoadmap(
                repo_full_name=summary["full_name"],
                repo_summary=summary,
                timeline=timeline_payload,
                cached=response.cached,
                generated_at=response.generated_at,
            )
            self._session.add(record)
        try:
            self._session.commit()
        except SQLAlchemyError:
            self._session.rollback()
            raise

    def get(self, full_name: str) -> RoadmapResponse | None:
        record = (
            self._session.query(GeneratedRoadmap)
            .filter_by(repo_full_name=full_name)
            .one_or_none()
        )
        if not record:
            return None
        return self._to_response(record)

    def list(self) -> list[RoadmapResponse]:
        records: Iterable[GeneratedRoadmap] = (
            self._session.query(GeneratedRoadmap)
            .order_by(GeneratedRoadmap.updated_at.desc())
            .all()
        )
        return [self._to_response(record) for record in records]

    def _to_response(self, record: GeneratedRoadmap) -> RoadmapResponse:
        summary = RoadmapRepoSummary(**record.repo_summary)
        timeline = [TimelineStage(**stage) for stage in record.timeline]
        return RoadmapResponse(
            repo=summary,
            timeline=timeline,
            cached=record.cached,
            generated_at=record.generated_at,
        )
