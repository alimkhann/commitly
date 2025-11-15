from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.roadmap import (
    GeneratedRoadmap,
    RoadmapRepoSummary,
    RoadmapResponse,
    TimelineStage,
    UserSyncedRepo,
)


class RoadmapResultStore:
    """Persists generated roadmaps for later retrieval."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._table_ready = False

    def _ensure_table_exists(self) -> None:
        if self._table_ready:
            return
        engine = self._session.get_bind()
        if engine is None:
            return
        GeneratedRoadmap.__table__.create(bind=engine, checkfirst=True)
        self._table_ready = True

    def _is_missing_table_error(self, exc: ProgrammingError) -> bool:
        message = str(exc).lower()
        return "generated_roadmaps" in message and (
            "undefined" in message or "does not exist" in message
        )

    def _with_table_guard(self, action):
        try:
            return action()
        except ProgrammingError as exc:
            self._session.rollback()
            if self._is_missing_table_error(exc):
                self._ensure_table_exists()
                return action()
            raise

    def upsert(self, response: RoadmapResponse) -> None:
        def action() -> None:
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

        self._with_table_guard(action)

    def get(self, full_name: str) -> RoadmapResponse | None:
        def action() -> RoadmapResponse | None:
            record = (
                self._session.query(GeneratedRoadmap)
                .filter_by(repo_full_name=full_name)
                .one_or_none()
            )
            if not record:
                return None
            return self._to_response(record)

        return self._with_table_guard(action)

    def list(self) -> list[RoadmapResponse]:
        def action() -> list[RoadmapResponse]:
            records: Iterable[GeneratedRoadmap] = (
                self._session.query(GeneratedRoadmap)
                .order_by(GeneratedRoadmap.updated_at.desc())
                .all()
            )
            return [self._to_response(record) for record in records]

        return self._with_table_guard(action)

    def _to_response(self, record: GeneratedRoadmap) -> RoadmapResponse:
        summary = RoadmapRepoSummary(**record.repo_summary)
        timeline = [TimelineStage(**stage) for stage in record.timeline]
        return RoadmapResponse(
            repo=summary,
            timeline=timeline,
            cached=record.cached,
            generated_at=record.generated_at,
        )


class UserSyncedRepoStore:
    def __init__(self, session: Session, result_store: RoadmapResultStore) -> None:
        self._session = session
        self._result_store = result_store

    def pin(self, user_id: str | None, full_name: str) -> None:
        if not user_id:
            return
        try:
            record = (
                self._session.query(UserSyncedRepo)
                .filter_by(user_id=user_id, repo_full_name=full_name)
                .one_or_none()
            )
            if record:
                record.pinned_at = datetime.now(timezone.utc)
            else:
                self._session.add(
                    UserSyncedRepo(user_id=user_id, repo_full_name=full_name)
                )
            self._session.commit()
        except SQLAlchemyError:
            self._session.rollback()
            raise

    def unpin(self, user_id: str, full_name: str) -> None:
        try:
            self._session.query(UserSyncedRepo).filter_by(
                user_id=user_id, repo_full_name=full_name
            ).delete()
            self._session.commit()
        except SQLAlchemyError:
            self._session.rollback()
            raise

    def list(self, user_id: str | None) -> list[RoadmapResponse]:
        if not user_id:
            return []
        records: Iterable[GeneratedRoadmap] = (
            self._session.query(GeneratedRoadmap)
            .join(
                UserSyncedRepo,
                UserSyncedRepo.repo_full_name == GeneratedRoadmap.repo_full_name,
            )
            .filter(UserSyncedRepo.user_id == user_id)
            .order_by(UserSyncedRepo.pinned_at.desc())
            .all()
        )
        return [self._result_store._to_response(record) for record in records]
