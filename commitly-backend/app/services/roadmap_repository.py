from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Callable, Iterable, Literal, TypeVar

from app.models.roadmap import (
    GeneratedRoadmap,
    RoadmapRepoSummary,
    RoadmapResponse,
    TimelineStage,
    UserRepoStateResponse,
    UserSyncedRepo,
)
from sqlalchemy import case
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

# Type alias for sort options
SortOption = Literal[
    "newest", "most_viewed", "most_synced", "highest_rated", "trending"
]

T = TypeVar("T")


class RoadmapResultStore:
    """Persists generated roadmaps for later retrieval."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def upsert(self, response: RoadmapResponse) -> None:
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
            record.sync_count = record.sync_count or 0
            record.view_count = record.view_count or 0
            for field in ("star_count", "fork_count", "contributor_count"):
                if summary.get(field) is not None:
                    setattr(record, field, summary.get(field, 0) or 0)
            if summary.get("primary_language"):
                record.primary_language = summary.get("primary_language")
            if summary.get("languages"):
                record.languages = summary.get("languages")
            if summary.get("topics"):
                record.topics = summary.get("topics")
            if summary.get("difficulty"):
                record.difficulty = summary.get("difficulty")
            parsed_last_push = self._parse_last_pushed(summary.get("last_pushed_at"))
            if parsed_last_push:
                record.last_pushed_at = parsed_last_push
            if summary.get("license"):
                record.license = summary.get("license")
        else:
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
                last_pushed_at=self._parse_last_pushed(summary.get("last_pushed_at")),
                license=summary.get("license"),
            )
            self._session.add(record)

        try:
            self._session.commit()
        except SQLAlchemyError:
            self._session.rollback()
            raise

    def increment_sync_count(self, full_name: str) -> None:
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

    def decrement_sync_count(self, full_name: str) -> None:
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

    def increment_view_count(self, full_name: str) -> None:
        """Increment the view count for a roadmap."""

        try:
            record = (
                self._session.query(GeneratedRoadmap)
                .filter_by(repo_full_name=full_name)
                .one_or_none()
            )
            if not record:
                return
            record.view_count = (record.view_count or 0) + 1
            summary = (record.repo_summary or {}).copy()
            summary["view_count"] = record.view_count
            record.repo_summary = summary
            flag_modified(record, "repo_summary")
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

    def list_catalog(
        self,
        page: int = 1,
        page_size: int = 20,
        language: str | None = None,
        tag: str | None = None,
        difficulty: str | None = None,
        min_rating: float | None = None,
        min_views: int | None = None,
        min_syncs: int | None = None,
        sort: str = "newest",
    ) -> tuple[list[RoadmapResponse], int]:
        """
        List roadmaps with filters, pagination and sorting.

        Sort options:
        - newest: Order by updated_at DESC (default)
        - most_viewed: Order by view_count DESC
        - most_synced: Order by sync_count DESC
        - highest_rated: Order by average rating DESC
        - trending: Order by trending score DESC

        Trending score formula:
            (view_count * 0.4) + (sync_count * 0.3) + (avg_rating * 6 * 0.3)

        Args:
            page: Page number (1-indexed)
            page_size: Number of items per page
            language: Filter by primary language
            tag: Filter by topic tag
            difficulty: Filter by difficulty level
            min_rating: Minimum average rating
            min_views: Minimum view count
            min_syncs: Minimum sync count
            sort: Sort option

        Returns:
            Tuple of (list of roadmaps, total count)
        """
        page = max(1, page)
        page_size = max(1, min(100, page_size))

        query = self._session.query(GeneratedRoadmap)

        if language:
            query = query.filter(GeneratedRoadmap.primary_language == language)

        if tag:
            query = query.filter(GeneratedRoadmap.topics.contains([tag]))

        if difficulty:
            query = query.filter(GeneratedRoadmap.difficulty == difficulty)

        if min_rating is not None:
            query = query.filter(
                GeneratedRoadmap.rating_count > 0,
                (GeneratedRoadmap.rating_sum / GeneratedRoadmap.rating_count)
                >= min_rating,
            )

        if min_views is not None:
            query = query.filter(GeneratedRoadmap.view_count >= min_views)

        if min_syncs is not None:
            query = query.filter(GeneratedRoadmap.sync_count >= min_syncs)

        if sort == "most_viewed":
            query = query.order_by(GeneratedRoadmap.view_count.desc())
        elif sort == "most_synced":
            query = query.order_by(GeneratedRoadmap.sync_count.desc())
        elif sort == "highest_rated":
            avg_rating = case(
                (
                    GeneratedRoadmap.rating_count > 0,
                    GeneratedRoadmap.rating_sum / GeneratedRoadmap.rating_count,
                ),
                else_=0,
            )
            query = query.order_by(avg_rating.desc())
        elif sort == "trending":
            avg_rating = case(
                (
                    GeneratedRoadmap.rating_count > 0,
                    GeneratedRoadmap.rating_sum / GeneratedRoadmap.rating_count,
                ),
                else_=0,
            )
            trending_score = (
                (GeneratedRoadmap.view_count * 0.4)
                + (GeneratedRoadmap.sync_count * 0.3)
                + (avg_rating * 6 * 0.3)
            )
            query = query.order_by(trending_score.desc())
        else:
            query = query.order_by(GeneratedRoadmap.updated_at.desc())

        total = query.count()
        records = query.offset((page - 1) * page_size).limit(page_size).all()
        results = [self._to_response(record) for record in records]
        return results, total

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

    def _parse_last_pushed(self, value) -> datetime | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                return None
        return None


class UserSyncedRepoStore:
    def __init__(self, session: Session, result_store: RoadmapResultStore) -> None:
        self._session = session
        self._result_store = result_store

    def _run_with_schema_guard(self, operation: Callable[[], T]) -> T:
        try:
            return operation()
        except (OperationalError, ProgrammingError) as exc:
            if not self._should_attempt_schema_heal(exc):
                raise
            self._session.rollback()
            self._recreate_schema()
            return operation()

    def _should_attempt_schema_heal(self, exc: Exception) -> bool:
        message = str(getattr(exc, "orig", exc)).lower()
        return "no such table" in message or "does not exist" in message

    def _recreate_schema(self) -> None:
        bind = self._session.get_bind()
        if bind is None:
            return
        UserSyncedRepo.__table__.create(
            bind=bind, checkfirst=True
        )  # noqa E501 # type: ignore[attr-defined]
        GeneratedRoadmap.__table__.create(
            bind=bind, checkfirst=True
        )  # noqa E501 # type: ignore[attr-defined]

    def pin(self, user_id: str | None, full_name: str) -> None:
        if not user_id:
            return

        def operation() -> None:
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

        self._run_with_schema_guard(operation)

    def unpin(self, user_id: str, full_name: str) -> None:
        def operation() -> None:
            try:
                self._session.query(UserSyncedRepo).filter_by(
                    user_id=user_id, repo_full_name=full_name
                ).delete()
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise

        self._run_with_schema_guard(operation)

    def list(self, user_id: str | None) -> list[RoadmapResponse]:
        if not user_id:
            return []

        def operation() -> list[RoadmapResponse]:
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

        return self._run_with_schema_guard(operation)

    def upsert_state(
        self,
        user_id: str,
        full_name: str,
        *,
        status: str = "synced",
        is_archived: bool = False,
        progress_percent: int = 0,
    ) -> bool:
        def operation() -> bool:
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

        return self._run_with_schema_guard(operation)

    def list_states(self, user_id: str | None) -> list[UserRepoStateResponse]:
        if not user_id:
            return []

        def operation() -> list[UserRepoStateResponse]:
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

        return self._run_with_schema_guard(operation)

    def archive(self, user_id: str, full_name: str) -> None:
        """Archive a repository for a user."""

        def operation() -> None:
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

        self._run_with_schema_guard(operation)

    def unarchive(self, user_id: str, full_name: str) -> None:
        """Unarchive a repository for a user."""

        def operation() -> None:
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

        self._run_with_schema_guard(operation)

    def list_archived(self, user_id: str | None) -> list[UserRepoStateResponse]:
        """List archived repositories for a user."""
        if not user_id:
            return []

        def operation() -> list[UserRepoStateResponse]:
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

        return self._run_with_schema_guard(operation)
