from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import json
from typing import Iterable

from sqlalchemy import Float, String, case, func, or_
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.roadmap import (
    GeneratedRoadmap,
    PublicRoadmapRecord,
    RoadmapRating,
    RoadmapRepoSummary,
    RoadmapResponse,
    RoadmapStats,
    TimelineStage,
    UserRepoState,
)


@dataclass(slots=True)
class GeneratedRoadmapMetadata:
    primary_language: str | None = None
    languages: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    difficulty: str | None = None
    star_count: int = 0
    fork_count: int = 0
    contributor_count: int = 0
    last_pushed_at: datetime | None = None
    license: str | None = None


@dataclass(slots=True)
class CatalogQuery:
    page: int = 1
    page_size: int = 12
    languages: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    difficulty: str | None = None
    min_rating: float | None = None
    min_views: int | None = None
    min_syncs: int | None = None
    sort: str = "trending"
    search: str | None = None


class RoadmapResultStore:
    """Persists generated roadmaps for later retrieval and catalog queries."""

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
        self._ensure_table_exists()

    def _is_missing_table_error(self, exc: Exception) -> bool:
        if not isinstance(exc, (ProgrammingError, OperationalError)):
            return False
        message = str(exc).lower()
        missing_markers = ("undefined", "does not exist", "no such table")
        return "generated_roadmaps" in message and any(
            marker in message for marker in missing_markers
        )

    def _with_table_guard(self, action):
        while True:
            try:
                return action()
            except (ProgrammingError, OperationalError) as exc:
                self._session.rollback()
                if not self._is_missing_table_error(exc):
                    raise
                self._ensure_table_exists()
                continue

    def upsert(
        self, response: RoadmapResponse, metadata: GeneratedRoadmapMetadata
    ) -> None:
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
            payload = {
                "repo_summary": summary,
                "timeline": timeline_payload,
                "cached": response.cached,
                "generated_at": response.generated_at,
                "primary_language": metadata.primary_language,
                "languages": metadata.languages,
                "topics": metadata.topics,
                "difficulty": metadata.difficulty,
                "star_count": metadata.star_count,
                "fork_count": metadata.fork_count,
                "contributor_count": metadata.contributor_count,
                "last_pushed_at": metadata.last_pushed_at,
                "license": metadata.license,
            }
            if record:
                for key, value in payload.items():
                    setattr(record, key, value)
            else:
                record = GeneratedRoadmap(
                    repo_full_name=summary["full_name"],
                    **payload,
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

    def get_public_record(self, full_name: str) -> PublicRoadmapRecord | None:
        def action() -> PublicRoadmapRecord | None:
            record = (
                self._session.query(GeneratedRoadmap)
                .filter_by(repo_full_name=full_name)
                .one_or_none()
            )
            if not record:
                return None
            return self._to_public_record(record)

        return self._with_table_guard(action)

    def paginate_catalog(
        self, query: CatalogQuery
    ) -> tuple[list[PublicRoadmapRecord], int]:
        def action() -> tuple[list[PublicRoadmapRecord], int]:
            stmt = self._session.query(GeneratedRoadmap)
            stmt = self._apply_catalog_filters(stmt, query)
            total = stmt.count()
            ordering = self._catalog_sort_expression(query)
            records: Iterable[GeneratedRoadmap] = (
                stmt.order_by(ordering)
                .offset(max(0, (query.page - 1) * query.page_size))
                .limit(query.page_size)
                .all()
            )
            payload = [self._to_public_record(record) for record in records]
            return payload, total

        return self._with_table_guard(action)

    def increment_view(self, repo_full_name: str, step: int = 1) -> None:
        def action() -> None:
            updated = (
                self._session.query(GeneratedRoadmap)
                .filter_by(repo_full_name=repo_full_name)
                .update(
                    {"view_count": GeneratedRoadmap.view_count + step},
                    synchronize_session=False,
                )
            )
            if updated:
                self._session.commit()
            else:
                self._session.rollback()

        self._with_table_guard(action)

    def adjust_sync_count(self, repo_full_name: str, delta: int) -> None:
        def action() -> None:
            new_value = case(
                (GeneratedRoadmap.sync_count + delta < 0, 0),
                else_=GeneratedRoadmap.sync_count + delta,
            )
            updated = (
                self._session.query(GeneratedRoadmap)
                .filter_by(repo_full_name=repo_full_name)
                .update(
                    {"sync_count": new_value},
                    synchronize_session=False,
                )
            )
            if updated:
                self._session.commit()
            else:
                self._session.rollback()

        self._with_table_guard(action)

    def adjust_rating_aggregate(
        self, repo_full_name: str, count_delta: int, sum_delta: int
    ) -> None:
        def action() -> None:
            count_expr = case(
                (GeneratedRoadmap.rating_count + count_delta < 0, 0),
                else_=GeneratedRoadmap.rating_count + count_delta,
            )
            updated = (
                self._session.query(GeneratedRoadmap)
                .filter_by(repo_full_name=repo_full_name)
                .update(
                    {
                        "rating_count": count_expr,
                        "rating_sum": GeneratedRoadmap.rating_sum + sum_delta,
                    },
                    synchronize_session=False,
                )
            )
            if updated:
                self._session.commit()
            else:
                self._session.rollback()

        self._with_table_guard(action)

    def _apply_catalog_filters(self, stmt, query: CatalogQuery):
        if query.search:
            like_pattern = f"%{query.search.lower()}%"
            stmt = stmt.filter(
                func.lower(GeneratedRoadmap.repo_full_name).like(like_pattern)
            )
        if query.languages:
            lowered = [lang.lower() for lang in query.languages]
            lang_text = func.lower(func.cast(GeneratedRoadmap.languages, String))
            lang_checks = [
                func.lower(func.coalesce(GeneratedRoadmap.primary_language, "")).in_(
                    lowered
                )
            ]
            for lang in lowered:
                lang_checks.append(lang_text.like(f'%"{lang}"%'))
            stmt = stmt.filter(or_(*lang_checks))
        if query.topics:
            topic_text = func.lower(func.cast(GeneratedRoadmap.topics, String))
            topic_checks = [
                topic_text.like(f'%"{topic.lower()}"%') for topic in query.topics
            ]
            stmt = stmt.filter(or_(*topic_checks))
        if query.difficulty:
            stmt = stmt.filter(
                func.lower(GeneratedRoadmap.difficulty) == query.difficulty.lower()
            )
        if query.min_views is not None:
            stmt = stmt.filter(GeneratedRoadmap.view_count >= query.min_views)
        if query.min_syncs is not None:
            stmt = stmt.filter(GeneratedRoadmap.sync_count >= query.min_syncs)
        if query.min_rating is not None:
            avg_expr = self._average_rating_expression()
            stmt = stmt.filter(avg_expr >= query.min_rating)
        return stmt

    def _catalog_sort_expression(self, query: CatalogQuery):
        avg_expr = self._average_rating_expression()
        sort_key = query.sort or "trending"
        if sort_key == "most_viewed":
            return GeneratedRoadmap.view_count.desc()
        if sort_key == "highest_rated":
            return avg_expr.desc().nullslast()
        if sort_key == "newest":
            return GeneratedRoadmap.generated_at.desc()
        if sort_key == "most_synced":
            return GeneratedRoadmap.sync_count.desc()
        trending_score = (
            func.coalesce(GeneratedRoadmap.view_count, 0) * 0.4
            + func.coalesce(GeneratedRoadmap.sync_count, 0) * 2
            + func.coalesce(avg_expr, 0) * 3
        )
        return trending_score.desc()

    def _average_rating_expression(self):
        return GeneratedRoadmap.rating_sum.cast(Float) / func.nullif(
            GeneratedRoadmap.rating_count.cast(Float), 0
        )

    def _to_response(self, record: GeneratedRoadmap) -> RoadmapResponse:
        summary = RoadmapRepoSummary(**record.repo_summary)
        timeline = [TimelineStage(**stage) for stage in record.timeline]
        return RoadmapResponse(
            repo=summary,
            timeline=timeline,
            cached=record.cached,
            generated_at=record.generated_at,
        )

    def _to_public_record(self, record: GeneratedRoadmap) -> PublicRoadmapRecord:
        summary = RoadmapRepoSummary(**record.repo_summary)
        average_rating = (
            record.rating_sum / record.rating_count if record.rating_count else None
        )
        stats = RoadmapStats(
            primary_language=record.primary_language or summary.language,
            languages=list(record.languages or [])
            or ([summary.language] if summary.language else []),
            topics=list(record.topics or []),
            difficulty=record.difficulty,
            star_count=record.star_count or summary.stars,
            fork_count=record.fork_count,
            contributor_count=record.contributor_count,
            last_pushed_at=record.last_pushed_at,
            license=record.license,
            view_count=record.view_count,
            sync_count=record.sync_count,
            rating_count=record.rating_count,
            rating_sum=record.rating_sum,
            average_rating=average_rating,
        )
        return PublicRoadmapRecord(repo=summary, stats=stats)

    def build_public_record(self, record: GeneratedRoadmap) -> PublicRoadmapRecord:
        return self._to_public_record(record)


class UserRepoStateStore:
    VIEW_COOLDOWN = timedelta(hours=6)

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
        UserRepoState.__table__.create(bind=engine, checkfirst=True)
        self._table_ready = True

    def _handle_missing_table_error(self, exc: Exception) -> bool:
        if not isinstance(exc, (ProgrammingError, OperationalError)):
            return False
        message = str(exc).lower()
        missing = any(
            marker in message
            for marker in ("undefined", "does not exist", "no such table")
        )
        handled = False
        if missing and "user_repo_states" in message:
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

    def touch_unsynced(self, user_id: str | None, repo_full_name: str) -> None:
        if not user_id:
            return

        def action() -> None:
            state = (
                self._session.query(UserRepoState)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            now = datetime.now(timezone.utc)
            if state:
                state.is_archived = False
                state.status = "unsynced"
                state.updated_at = now
            else:
                state = UserRepoState(user_id=user_id, repo_full_name=repo_full_name)
                self._session.add(state)
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise

        self._with_table_guard(action)

    def mark_synced(
        self, user_id: str, repo_full_name: str
    ) -> tuple[UserRepoState, bool] | tuple[None, bool]:
        def action() -> tuple[UserRepoState, bool] | tuple[None, bool]:
            state = (
                self._session.query(UserRepoState)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            now = datetime.now(timezone.utc)
            if not state:
                state = UserRepoState(user_id=user_id, repo_full_name=repo_full_name)
                self._session.add(state)
                previously_synced = False
            else:
                previously_synced = state.status == "synced"
            state.status = "synced"
            state.synced_at = now
            state.is_archived = False
            state.progress_percent = 0
            state.updated_at = now
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise
            return state, not previously_synced

        return self._with_table_guard(action)

    def mark_unsynced(
        self, user_id: str, repo_full_name: str
    ) -> tuple[UserRepoState | None, bool]:
        def action() -> tuple[UserRepoState | None, bool]:
            state = (
                self._session.query(UserRepoState)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            if not state:
                return None, False
            previously_synced = state.status == "synced"
            state.status = "unsynced"
            state.synced_at = None
            state.progress_percent = 0
            state.updated_at = datetime.now(timezone.utc)
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise
            return state, previously_synced

        return self._with_table_guard(action)

    def archive(self, user_id: str, repo_full_name: str) -> UserRepoState | None:
        def action() -> UserRepoState | None:
            state = (
                self._session.query(UserRepoState)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            if not state:
                return None
            state.is_archived = True
            state.updated_at = datetime.now(timezone.utc)
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise
            return state

        return self._with_table_guard(action)

    def unarchive(self, user_id: str, repo_full_name: str) -> UserRepoState | None:
        def action() -> UserRepoState | None:
            state = (
                self._session.query(UserRepoState)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            if not state:
                return None
            state.is_archived = False
            state.updated_at = datetime.now(timezone.utc)
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise
            return state

        return self._with_table_guard(action)

    def record_view(self, user_id: str | None, repo_full_name: str) -> None:
        now = datetime.now(timezone.utc)

        def action() -> bool:
            should_increment = False
            if not user_id:
                return True
            state = (
                self._session.query(UserRepoState)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            if not state:
                state = UserRepoState(user_id=user_id, repo_full_name=repo_full_name)
                self._session.add(state)
                should_increment = True
            elif (
                not state.last_viewed_at
                or now - state.last_viewed_at >= self.VIEW_COOLDOWN
            ):
                should_increment = True
            state.last_viewed_at = now
            state.is_archived = False
            state.updated_at = now
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise
            return should_increment

        should_increment = self._with_table_guard(action)
        if should_increment:
            self._result_store.increment_view(repo_full_name)

    def list_states(
        self, user_id: str, include_archived: bool = False
    ) -> list[tuple[UserRepoState, GeneratedRoadmap]]:
        def action() -> list[tuple[UserRepoState, GeneratedRoadmap]]:
            query = (
                self._session.query(UserRepoState, GeneratedRoadmap)
                .join(
                    GeneratedRoadmap,
                    GeneratedRoadmap.repo_full_name == UserRepoState.repo_full_name,
                )
                .filter(UserRepoState.user_id == user_id)
            )
            if not include_archived:
                query = query.filter(UserRepoState.is_archived.is_(False))
            return query.order_by(UserRepoState.updated_at.desc()).all()

        return self._with_table_guard(action)


class RoadmapRatingStore:
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
        RoadmapRating.__table__.create(bind=engine, checkfirst=True)
        self._table_ready = True

    def _with_table_guard(self, action):
        while True:
            try:
                return action()
            except (ProgrammingError, OperationalError) as exc:
                self._session.rollback()
                message = str(exc).lower()
                if "roadmap_ratings" in message:
                    self._ensure_table_exists()
                    continue
                if "generated_roadmaps" in message:
                    self._result_store.ensure_table_ready()
                    continue
                raise

    def upsert(self, user_id: str, repo_full_name: str, rating: int) -> RoadmapRating:
        def action() -> RoadmapRating:
            record = (
                self._session.query(RoadmapRating)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )
            if record:
                delta_sum = rating - record.rating
                record.rating = rating
                count_delta = 0
            else:
                record = RoadmapRating(
                    user_id=user_id,
                    repo_full_name=repo_full_name,
                    rating=rating,
                )
                self._session.add(record)
                delta_sum = rating
                count_delta = 1
            try:
                self._session.commit()
            except SQLAlchemyError:
                self._session.rollback()
                raise
            self._result_store.adjust_rating_aggregate(
                repo_full_name, count_delta, delta_sum
            )
            return record

        return self._with_table_guard(action)

    def get(self, user_id: str, repo_full_name: str) -> RoadmapRating | None:
        def action() -> RoadmapRating | None:
            return (
                self._session.query(RoadmapRating)
                .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                .one_or_none()
            )

        return self._with_table_guard(action)
