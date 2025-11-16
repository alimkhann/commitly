from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Iterable

from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.roadmap import (
    GeneratedRoadmap,
    RoadmapRating,
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
                flag_modified(record, "repo_summary")
                record.timeline = timeline_payload
                record.cached = response.cached
                record.generated_at = response.generated_at
                if record.sync_count is None:
                    record.sync_count = 0
                if record.view_count is None:
                    record.view_count = 0
                # Update metadata fields from summary
                if summary.get("star_count") is not None:
                    record.star_count = summary.get("star_count", 0)
                if summary.get("fork_count") is not None:
                    record.fork_count = summary.get("fork_count", 0)
                if summary.get("contributor_count") is not None:
                    record.contributor_count = summary.get("contributor_count", 0)
                if summary.get("primary_language"):
                    record.primary_language = summary.get("primary_language")
                if summary.get("languages"):
                    record.languages = summary.get("languages")
                if summary.get("topics"):
                    record.topics = summary.get("topics")
                if summary.get("difficulty"):
                    record.difficulty = summary.get("difficulty")
                if summary.get("last_pushed_at"):
                    from datetime import datetime

                    last_pushed = summary.get("last_pushed_at")
                    if isinstance(last_pushed, str):
                        try:
                            record.last_pushed_at = datetime.fromisoformat(
                                last_pushed.replace("Z", "+00:00")
                            )
                        except (ValueError, AttributeError):
                            pass
                    elif isinstance(last_pushed, datetime):
                        record.last_pushed_at = last_pushed
                if summary.get("license"):
                    record.license = summary.get("license")
            else:
                # Parse last_pushed_at if present
                last_pushed_at = None
                if summary.get("last_pushed_at"):
                    from datetime import datetime

                    last_pushed = summary.get("last_pushed_at")
                    if isinstance(last_pushed, str):
                        try:
                            last_pushed_at = datetime.fromisoformat(
                                last_pushed.replace("Z", "+00:00")
                            )
                        except (ValueError, AttributeError):
                            pass
                    elif isinstance(last_pushed, datetime):
                        last_pushed_at = last_pushed

                record = GeneratedRoadmap(
                    repo_full_name=summary["full_name"],
                    repo_summary=summary,
                    timeline=timeline_payload,
                    cached=response.cached,
                    generated_at=response.generated_at,
                    view_count=summary.get("view_count", 0) or 0,
                    sync_count=summary.get("sync_count", 0) or 0,
                    star_count=summary.get("star_count", 0) or 0,
                    fork_count=summary.get("fork_count", 0) or 0,
                    contributor_count=summary.get("contributor_count", 0) or 0,
                    primary_language=summary.get("primary_language"),
                    languages=summary.get("languages"),
                    topics=summary.get("topics"),
                    difficulty=summary.get("difficulty"),
                    last_pushed_at=last_pushed_at,
                    license=summary.get("license"),
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
                summary = (record.repo_summary or {}).copy()
                summary["sync_count"] = record.sync_count
                record.repo_summary = summary
                flag_modified(record, "repo_summary")
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise

        self._with_table_guard(action)

    def decrement_sync_count(self, full_name: str) -> None:
        def action() -> None:
            try:
                record = (
                    self._session.query(GeneratedRoadmap)
                    .filter_by(repo_full_name=full_name)
                    .one_or_none()
                )
                if not record:
                    return
                if record.sync_count and record.sync_count > 0:
                    record.sync_count -= 1
                    summary = (record.repo_summary or {}).copy()
                    summary["sync_count"] = record.sync_count
                    record.repo_summary = summary
                    flag_modified(record, "repo_summary")
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
        summary_payload = dict(record.repo_summary)
        # Ensure counters stored as columns are surfaced even if repo_summary lacks them
        summary_payload.setdefault("sync_count", record.sync_count)
        summary_payload.setdefault("view_count", record.view_count)
        summary_payload.setdefault("star_count", record.star_count)
        summary_payload.setdefault("fork_count", record.fork_count)
        summary_payload.setdefault("contributor_count", record.contributor_count)
        summary_payload.setdefault("primary_language", record.primary_language)
        summary_payload.setdefault("languages", record.languages)
        summary_payload.setdefault("topics", record.topics)
        summary_payload.setdefault("difficulty", record.difficulty)
        summary = RoadmapRepoSummary(**summary_payload)
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
        def action() -> bool:
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

    def archive(self, user_id: str, full_name: str) -> None:
        """Archive a repository for a user."""

        def action() -> None:
            try:
                record = (
                    self._session.query(UserSyncedRepo)
                    .filter_by(user_id=user_id, repo_full_name=full_name)
                    .one_or_none()
                )
                if record:
                    record.is_archived = True
                    record.updated_at = datetime.now(timezone.utc)
                    self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise

        self._with_table_guard(action)

    def unarchive(self, user_id: str, full_name: str) -> None:
        """Unarchive a repository for a user."""

        def action() -> None:
            try:
                record = (
                    self._session.query(UserSyncedRepo)
                    .filter_by(user_id=user_id, repo_full_name=full_name)
                    .one_or_none()
                )
                if record:
                    record.is_archived = False
                    record.updated_at = datetime.now(timezone.utc)
                    self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise

        self._with_table_guard(action)

    def list_archived(self, user_id: str | None) -> list[UserRepoStateResponse]:
        """List archived repositories for a user."""
        if not user_id:
            return []

        def action() -> list[UserRepoStateResponse]:
            results = (
                self._session.query(UserSyncedRepo, GeneratedRoadmap)
                .outerjoin(
                    GeneratedRoadmap,
                    GeneratedRoadmap.repo_full_name == UserSyncedRepo.repo_full_name,
                )
                .filter(
                    UserSyncedRepo.user_id == user_id,
                    UserSyncedRepo.is_archived == True,  # noqa: E712
                )
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
