"""Service for tracking roadmap views with anti-spam logic."""

from datetime import datetime, timedelta, timezone

from app.models.roadmap import RoadmapViewTracker
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session


class RoadmapViewTrackerService:
    """
    Tracks roadmap views to prevent spam.

    Strategy: Only allow one view count increment per user per 24-hour window.
    """

    # Time window in hours - user can only increment view once per this window
    VIEW_COOLDOWN_HOURS = 24

    def __init__(self, session: Session) -> None:
        self._session = session
        self._table_ready = False

    def _ensure_table_exists(self) -> None:
        """Create the table if it doesn't exist."""
        if self._table_ready:
            return
        engine = self._session.get_bind()
        if engine is None:
            return
        RoadmapViewTracker.__table__.create(bind=engine, checkfirst=True)
        self._table_ready = True

    def _is_missing_table_error(self, exc: Exception) -> bool:
        """Check if exception is due to missing table."""
        if not isinstance(exc, (ProgrammingError, OperationalError)):
            return False
        message = str(exc).lower()
        missing_markers = ("undefined", "does not exist", "no such table")
        return "roadmap_view_tracker" in message and any(
            marker in message for marker in missing_markers
        )

    def _handle_missing_table_error(self, exc: Exception) -> bool:
        """Handle missing table error by creating it."""
        if self._is_missing_table_error(exc):
            self._ensure_table_exists()
            return True
        return False

    def _with_table_guard(self, action):
        """Execute action with table existence guard."""
        while True:
            try:
                return action()
            except (ProgrammingError, OperationalError) as exc:
                self._session.rollback()
                if not self._handle_missing_table_error(exc):
                    raise
                # Missing table was created; retry the action.
                continue

    def can_increment_view(self, repo_full_name: str, user_id: str | None) -> bool:
        """
        Check if a view can be counted for this user/repo combination.

        Returns True if:
        - User has never viewed this repo
        - User last viewed this repo more than VIEW_COOLDOWN_HOURS ago
        - user_id is None (anonymous, always allow but don't track)

        Args:
            repo_full_name: Full repository name (owner/repo)
            user_id: User identifier (optional)

        Returns:
            True if view should be counted, False otherwise
        """
        # Always allow anonymous views (but don't track them)
        if user_id is None:
            return True

        def action() -> bool:
            record = (
                self._session.query(RoadmapViewTracker)
                .filter_by(repo_full_name=repo_full_name, user_id=user_id)
                .one_or_none()
            )

            if record is None:
                # Never viewed before
                return True

            # Check if cooldown period has passed
            cooldown_threshold = datetime.now(timezone.utc) - timedelta(
                hours=self.VIEW_COOLDOWN_HOURS
            )
            return record.viewed_at < cooldown_threshold

        return self._with_table_guard(action)

    def record_view(self, repo_full_name: str, user_id: str | None) -> None:
        """
        Record a view in the tracker table.

        Uses UPSERT logic to update viewed_at if record exists,
        or insert new record if it doesn't.

        Args:
            repo_full_name: Full repository name (owner/repo)
            user_id: User identifier (optional, skips if None)
        """
        if user_id is None:
            # Don't track anonymous views in the database
            return

        def action() -> None:
            record = (
                self._session.query(RoadmapViewTracker)
                .filter_by(repo_full_name=repo_full_name, user_id=user_id)
                .one_or_none()
            )

            if record:
                # Update existing record
                record.viewed_at = datetime.now(timezone.utc)
            else:
                # Create new record
                new_record = RoadmapViewTracker(
                    repo_full_name=repo_full_name,
                    user_id=user_id,
                )
                self._session.add(new_record)

            try:
                self._session.commit()
            except IntegrityError:
                # Race condition: another request created the record
                self._session.rollback()
                # Try again to update it
                record = (
                    self._session.query(RoadmapViewTracker)
                    .filter_by(repo_full_name=repo_full_name, user_id=user_id)
                    .one_or_none()
                )
                if record:
                    record.viewed_at = datetime.now(timezone.utc)
                    self._session.commit()

        self._with_table_guard(action)

    def increment_view_if_eligible(
        self, repo_full_name: str, user_id: str | None
    ) -> bool:
        """
        Atomically check if view can be counted and record it if eligible.

        This method prevents race conditions by performing the eligibility check
        and record update in a single atomic operation. If two requests arrive
        simultaneously, only one will succeed in recording the view.

        Args:
            repo_full_name: Full repository name (owner/repo)
            user_id: User identifier (optional)

        Returns:
            True if view was counted (eligible), False otherwise
        """
        # Always allow anonymous views (but don't track them)
        if user_id is None:
            return True

        def action() -> bool:
            # Query with FOR UPDATE to lock the row during check
            record = (
                self._session.query(RoadmapViewTracker)
                .filter_by(repo_full_name=repo_full_name, user_id=user_id)
                .with_for_update()
                .one_or_none()
            )

            if record is None:
                # No existing record - try to create one
                try:
                    new_record = RoadmapViewTracker(
                        repo_full_name=repo_full_name,
                        user_id=user_id,
                    )
                    self._session.add(new_record)
                    self._session.commit()
                    return True
                except IntegrityError:
                    # Race condition: another request created the record
                    # This means the view shouldn't be counted
                    self._session.rollback()
                    return False

            # Record exists - check if cooldown period has passed
            cooldown_threshold = datetime.now(timezone.utc) - timedelta(
                hours=self.VIEW_COOLDOWN_HOURS
            )

            if record.viewed_at < cooldown_threshold:
                # Cooldown has passed - update the timestamp
                record.viewed_at = datetime.now(timezone.utc)
                self._session.commit()
                return True
            else:
                # Still within cooldown period
                return False

        return self._with_table_guard(action)
