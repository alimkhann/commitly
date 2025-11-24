"""Rating store for roadmap ratings."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.roadmap import GeneratedRoadmap, RoadmapRating
from app.services.roadmap_repository import RoadmapResultStore


class RoadmapRatingStore:
    """Handles database operations for roadmap ratings."""

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

    def _handle_missing_table_error(self, exc: Exception) -> bool:
        if not isinstance(exc, (ProgrammingError, OperationalError)):
            return False
        message = str(exc).lower()
        handled = False
        missing = any(
            marker in message
            for marker in ("undefined", "does not exist", "no such table")
        )
        if missing and "roadmap_ratings" in message:
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

    def upsert_rating(
        self, user_id: str, repo_full_name: str, rating: int
    ) -> RoadmapRating:
        """Create or update a user's rating for a repository."""
        if not (1 <= rating <= 5):
            raise ValueError("Rating must be between 1 and 5")

        def action() -> RoadmapRating:
            try:
                # Get existing rating if any
                existing = (
                    self._session.query(RoadmapRating)
                    .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                    .one_or_none()
                )

                old_rating = existing.rating if existing else None

                if existing:
                    # Update existing rating
                    existing.rating = rating
                    existing.updated_at = datetime.now(timezone.utc)
                    record = existing
                else:
                    # Create new rating
                    record = RoadmapRating(
                        user_id=user_id,
                        repo_full_name=repo_full_name,
                        rating=rating,
                    )
                    self._session.add(record)

                # Update aggregated stats on GeneratedRoadmap atomically
                roadmap = (
                    self._session.query(GeneratedRoadmap)
                    .filter_by(repo_full_name=repo_full_name)
                    .with_for_update()
                    .one_or_none()
                )

                if roadmap:
                    if old_rating is None:
                        # New rating - increment count and add to sum
                        roadmap.rating_count = (roadmap.rating_count or 0) + 1
                        roadmap.rating_sum = (roadmap.rating_sum or 0) + rating
                    else:
                        # Updated rating - adjust sum (count stays the same)
                        roadmap.rating_sum = (
                            (roadmap.rating_sum or 0) - old_rating + rating
                        )
                    flag_modified(roadmap, "rating_count")
                    flag_modified(roadmap, "rating_sum")
                    # Also update the summary JSON
                    summary = (roadmap.repo_summary or {}).copy()
                    summary["rating_count"] = roadmap.rating_count
                    summary["rating_sum"] = roadmap.rating_sum
                    roadmap.repo_summary = summary
                    flag_modified(roadmap, "repo_summary")

                self._session.commit()
                # Refresh the record to get updated timestamps
                self._session.refresh(record)
                return record
            except SQLAlchemyError:
                self._session.rollback()
                raise

        return self._with_table_guard(action)

    def get_user_rating(
        self, user_id: str, repo_full_name: str
    ) -> RoadmapRating | None:
        """Get a user's rating for a repository."""

        def action() -> RoadmapRating | None:
            try:
                return (
                    self._session.query(RoadmapRating)
                    .filter_by(user_id=user_id, repo_full_name=repo_full_name)
                    .one_or_none()
                )
            except SQLAlchemyError:
                self._session.rollback()
                raise

        return self._with_table_guard(action)
