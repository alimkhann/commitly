from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Iterable

from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.roadmap import (
    GeneratedRoadmap,
    RoadmapRepoSummary,
    RoadmapResponse,
    TimelineStage,
    UserRepoStateResponse,
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

    def ensure_table_ready(self) -> None:
        """Expose table guard to collaborators that depend on this table."""
        self._ensure_table_exists()

    def _is_missing_table_error(self, exc: Exception) -> bool:
        if not isinstance(exc, (ProgrammingError, OperationalError)):
            return False
        message = str(exc).lower()
        missing_markers = ("undefined", "does not exist", "no such table")
        return "generated_roadmaps" in message and any(
            marker in message for marker in missing_markers
        )

    def _handle_missing_table_error(self, exc: Exception) -> bool:
        if self._is_missing_table_error(exc):
            self._ensure_table_exists()
            return True
        return False

    def _with_table_guard(self, action):
        while True:
            try:
                return action()
            except (ProgrammingError, OperationalError) as exc:
                self._session.rollback()
                if not self._handle_missing_table_error(exc):
                    raise
                # Missing table was created; retry the action.
                continue

    def upsert(self, response: RoadmapResponse) -> None:
        def action() -> None:
            summary = json.loads(response.repo.model_dump_json())
            timeline_payload = [
                json.loads(stage.model_dump_json()) for stage in response.timeline
            ]
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

    def increment_sync_count(self, full_name: str) -> None:
        def action() -> None:
            try:
                record = (
                    self._session.query(GeneratedRoadmap)
                    .filter_by(repo_full_name=full_name)
                    .one_or_none()
                )
                if not record:
                    return
                record.sync_count = (record.sync_count or 0) + 1
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

    def list_paginated(
        self, page: int, page_size: int
    ) -> tuple[list[RoadmapResponse], int]:
        page = max(1, page)
        page_size = max(1, min(100, page_size))

        def action() -> tuple[list[RoadmapResponse], int]:
            query = self._session.query(GeneratedRoadmap).order_by(
                GeneratedRoadmap.updated_at.desc()
            )
            total = query.count()
            records = query.offset((page - 1) * page_size).limit(page_size).all()
            return [self._to_response(record) for record in records], total

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
        self._table_ready = False

    def _ensure_table_exists(self) -> None:
        if self._table_ready:
            return
        engine = self._session.get_bind()
        if engine is None:
            return
        UserSyncedRepo.__table__.create(bind=engine, checkfirst=True)
        self._table_ready = True

    def _handle_missing_table_error(self, exc: Exception) -> bool:
        if not isinstance(exc, (ProgrammingError, OperationalError)):
            return False
        message = str(exc).lower()
        handled = False
        missing = any(
            marker in message
            for marker in ("undefined", "does not exist", "no such table")
        )
        if missing and "user_synced_repos" in message:
            self._ensure_table_exists()
            handled = True
        if missing and "generated_roadmaps" in message:
            self._result_store.ensure_table_ready()
            handled = True
        return handled

    def _with_table_guard(self, action):
        while True:
            try:
                return action()
            except (ProgrammingError, OperationalError) as exc:
                self._session.rollback()
                if not self._handle_missing_table_error(exc):
                    raise
                continue

    def pin(self, user_id: str | None, full_name: str) -> None:
        if not user_id:
            return

        def action() -> None:
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

        self._with_table_guard(action)

    def unpin(self, user_id: str, full_name: str) -> None:
        def action() -> None:
            try:
                self._session.query(UserSyncedRepo).filter_by(
                    user_id=user_id, repo_full_name=full_name
                ).delete()
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise

        self._with_table_guard(action)

    def list(self, user_id: str | None) -> list[RoadmapResponse]:
        if not user_id:
            return []

        def action() -> list[RoadmapResponse]:
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

        return self._with_table_guard(action)

    def upsert_state(
        self,
        user_id: str,
        full_name: str,
        *,
        status: str = "synced",
        is_archived: bool = False,
        progress_percent: int = 0,
    ) -> bool:
        def action() -> None:
            try:
                record = (
                    self._session.query(UserSyncedRepo)
                    .filter_by(user_id=user_id, repo_full_name=full_name)
                    .one_or_none()
                )
                created = False
                if record:
                    record.status = status
                    record.is_archived = is_archived
                    record.progress_percent = progress_percent
                    record.pinned_at = datetime.now(timezone.utc)
                else:
                    self._session.add(
                        UserSyncedRepo(
                            user_id=user_id,
                            repo_full_name=full_name,
                            status=status,
                            is_archived=is_archived,
                            progress_percent=progress_percent,
                        )
                    )
                    created = True
                self._session.commit()
                return created
            except SQLAlchemyError:
                self._session.rollback()
                raise

        return self._with_table_guard(action)

    def list_states(self, user_id: str | None) -> list[UserRepoStateResponse]:
        if not user_id:
            return []

        def action() -> list[UserRepoStateResponse]:
            results = (
                self._session.query(UserSyncedRepo, GeneratedRoadmap)
                .outerjoin(
                    GeneratedRoadmap,
                    GeneratedRoadmap.repo_full_name == UserSyncedRepo.repo_full_name,
                )
                .filter(UserSyncedRepo.user_id == user_id)
                .order_by(UserSyncedRepo.pinned_at.desc())
                .all()
            )

            responses: list[UserRepoStateResponse] = []
            for user_record, roadmap_record in results:
                summary = None
                if roadmap_record and roadmap_record.repo_summary:
                    summary = RoadmapRepoSummary(**roadmap_record.repo_summary)
                responses.append(
                    UserRepoStateResponse(
                        repo_full_name=user_record.repo_full_name,
                        status=user_record.status,
                        is_archived=user_record.is_archived,
                        progress_percent=user_record.progress_percent,
                        pinned_at=user_record.pinned_at,
                        repo=summary,
                    )
                )
            return responses

        return self._with_table_guard(action)
