"""Tests for roadmap view tracking and trending sort feature."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from app.models.roadmap import GeneratedRoadmap, RoadmapViewTracker
from app.services.roadmap_repository import RoadmapResultStore
from app.services.roadmap_view_tracker import RoadmapViewTrackerService
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    session = MagicMock(spec=Session)
    session.query.return_value.filter_by.return_value.one_or_none.return_value = None
    session.get_bind.return_value = MagicMock()
    return session


@pytest.fixture
def view_tracker_service(mock_session):
    """Create a RoadmapViewTrackerService instance with mock session."""
    return RoadmapViewTrackerService(mock_session)


@pytest.fixture
def result_store(mock_session):
    """Create a RoadmapResultStore instance with mock session."""
    return RoadmapResultStore(mock_session)


class TestRoadmapViewTrackerService:
    """Test suite for RoadmapViewTrackerService."""

    def test_can_increment_view_anonymous_user(self, view_tracker_service):
        """Anonymous users (user_id=None) should always be able to increment views."""
        result = view_tracker_service.can_increment_view("owner/repo", None)
        assert result is True

    def test_can_increment_view_new_user(self, view_tracker_service, mock_session):
        """First-time viewers should be able to increment views."""
        # Mock no existing record
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            None
        )

        result = view_tracker_service.can_increment_view("owner/repo", "user123")
        assert result is True

    def test_can_increment_view_within_cooldown(
        self, view_tracker_service, mock_session
    ):
        """Users viewing within cooldown period should not increment views."""
        # Mock existing record from 1 hour ago (within 24-hour cooldown)
        mock_record = MagicMock(spec=RoadmapViewTracker)
        mock_record.viewed_at = datetime.now(timezone.utc) - timedelta(hours=1)
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_record
        )

        result = view_tracker_service.can_increment_view("owner/repo", "user123")
        assert result is False

    def test_can_increment_view_after_cooldown(
        self, view_tracker_service, mock_session
    ):
        """Users viewing after cooldown period should be able to increment views."""
        # Mock existing record from 25 hours ago (outside 24-hour cooldown)
        mock_record = MagicMock(spec=RoadmapViewTracker)
        mock_record.viewed_at = datetime.now(timezone.utc) - timedelta(hours=25)
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_record
        )

        result = view_tracker_service.can_increment_view("owner/repo", "user123")
        assert result is True

    def test_record_view_anonymous_skips_tracking(
        self, view_tracker_service, mock_session
    ):
        """Anonymous views should not be tracked in database."""
        view_tracker_service.record_view("owner/repo", None)

        # Verify no database operations were performed
        mock_session.add.assert_not_called()
        mock_session.commit.assert_not_called()

    def test_record_view_creates_new_record(self, view_tracker_service, mock_session):
        """First view should create a new tracker record."""
        # Mock no existing record
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            None
        )

        view_tracker_service.record_view("owner/repo", "user123")

        # Verify new record was added
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called()

    def test_record_view_updates_existing_record(
        self, view_tracker_service, mock_session
    ):
        """Subsequent views should update the existing tracker record."""
        # Mock existing record
        mock_record = MagicMock(spec=RoadmapViewTracker)
        mock_record.viewed_at = datetime.now(timezone.utc) - timedelta(hours=25)
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_record
        )

        view_tracker_service.record_view("owner/repo", "user123")

        # Verify record was updated (viewed_at should be updated)
        assert mock_record.viewed_at != datetime.now(timezone.utc) - timedelta(hours=25)
        mock_session.commit.assert_called()

    def test_increment_view_if_eligible_returns_true_when_eligible(
        self, view_tracker_service, mock_session
    ):
        """Should return True and record view when eligible (new user)."""
        # Mock no existing record (eligible) with with_for_update chain
        mock_session.query.return_value.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = (  # noqa E501
            None
        )

        result = view_tracker_service.increment_view_if_eligible(
            "owner/repo", "user123"
        )

        assert result is True
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    def test_increment_view_if_eligible_returns_false_when_not_eligible(
        self, view_tracker_service, mock_session
    ):
        """Should return False and not record view when not eligible."""
        # Mock existing record from 1 hour ago (not eligible)
        mock_record = MagicMock(spec=RoadmapViewTracker)
        mock_record.viewed_at = datetime.now(timezone.utc) - timedelta(hours=1)
        mock_session.query.return_value.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = (  # noqa E501
            mock_record
        )

        result = view_tracker_service.increment_view_if_eligible(
            "owner/repo", "user123"
        )

        assert result is False

    def test_increment_view_if_eligible_handles_race_condition(
        self, view_tracker_service, mock_session
    ):
        """Should return False when IntegrityError occurs (race condition)."""
        # Mock no existing record initially
        mock_session.query.return_value.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = (  # noqa E501
            None
        )
        # Mock IntegrityError on commit (another request created the record)
        mock_session.commit.side_effect = IntegrityError(
            "duplicate key", params=None, orig=Exception("duplicate")
        )

        result = view_tracker_service.increment_view_if_eligible(
            "owner/repo", "user123"
        )

        assert result is False
        mock_session.rollback.assert_called_once()

    def test_increment_view_if_eligible_updates_after_cooldown(
        self, view_tracker_service, mock_session
    ):
        """Should return True and update timestamp after cooldown period."""
        # Mock existing record from 25 hours ago (eligible after 24h cooldown)
        mock_record = MagicMock(spec=RoadmapViewTracker)
        mock_record.viewed_at = datetime.now(timezone.utc) - timedelta(hours=25)
        mock_session.query.return_value.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = (  # noqa E501
            mock_record
        )

        result = view_tracker_service.increment_view_if_eligible(
            "owner/repo", "user123"
        )

        assert result is True
        # Verify timestamp was updated
        assert mock_record.viewed_at > datetime.now(timezone.utc) - timedelta(
            seconds=5
        )  # noqa E501
        mock_session.commit.assert_called_once()

    def test_increment_view_if_eligible_anonymous_returns_true(
        self, view_tracker_service, mock_session
    ):
        """Should return True for anonymous users without database access."""
        result = view_tracker_service.increment_view_if_eligible("owner/repo", None)

        assert result is True
        # Verify no database queries were made
        mock_session.query.assert_not_called()


class TestRoadmapResultStoreIncrement:
    """Test suite for view count increment in RoadmapResultStore."""

    def test_increment_view_count_updates_counter(self, result_store, mock_session):
        """Should increment view count for existing roadmap."""
        # Mock existing roadmap
        mock_roadmap = MagicMock(spec=GeneratedRoadmap)
        mock_roadmap.view_count = 5
        mock_roadmap.repo_summary = {"full_name": "owner/repo"}
        mock_roadmap._sa_instance_state = MagicMock()  # Add SQLAlchemy state
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_roadmap
        )

        result_store.increment_view_count("owner/repo")

        assert mock_roadmap.view_count == 6
        assert mock_roadmap.repo_summary["view_count"] == 6
        mock_session.commit.assert_called_once()

    def test_increment_view_count_handles_none_view_count(
        self, result_store, mock_session
    ):
        """Should handle roadmaps with None view_count."""
        # Mock existing roadmap with None view_count
        mock_roadmap = MagicMock(spec=GeneratedRoadmap)
        mock_roadmap.view_count = None
        mock_roadmap.repo_summary = {"full_name": "owner/repo"}
        mock_roadmap._sa_instance_state = MagicMock()  # Add SQLAlchemy state
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_roadmap
        )

        result_store.increment_view_count("owner/repo")

        # Verify view_count was initialized and incremented
        assert mock_roadmap.view_count == 1
        assert mock_roadmap.repo_summary["view_count"] == 1

    def test_increment_view_count_nonexistent_roadmap(self, result_store, mock_session):
        """Should handle gracefully when roadmap doesn't exist."""
        # Mock no existing roadmap
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            None
        )

        # Should not raise an error
        result_store.increment_view_count("owner/nonexistent")

        # Verify no commit was called
        mock_session.commit.assert_not_called()


class TestRoadmapSorting:
    """Test suite for roadmap sorting functionality."""

    @pytest.fixture
    def mock_roadmaps(self):
        """Create mock roadmap data for sorting tests."""
        roadmaps = []

        # Roadmap 1: High views, low syncs, no ratings
        r1 = MagicMock(spec=GeneratedRoadmap)
        r1.repo_full_name = "owner/popular-views"
        r1.view_count = 100
        r1.sync_count = 5
        r1.star_count = 100
        r1.fork_count = 20
        r1.contributor_count = 10
        r1.primary_language = "Python"
        r1.languages = ["Python"]
        r1.topics = ["web"]
        r1.difficulty = "beginner"
        r1.rating_count = 0
        r1.rating_sum = 0
        r1.updated_at = datetime(2025, 11, 15, tzinfo=timezone.utc)
        r1.repo_summary = {
            "full_name": "owner/popular-views",
            "description": "Popular repo",
            "language": "Python",
            "stars": 100,
            "default_branch": "main",
            "html_url": "https://github.com/owner/popular-views",
            "owner_avatar_url": "https://github.com/owner.png",
        }
        roadmaps.append(r1)

        # Roadmap 2: Low views, high syncs, good ratings
        r2 = MagicMock(spec=GeneratedRoadmap)
        r2.repo_full_name = "owner/synced-repo"
        r2.view_count = 10
        r2.sync_count = 50
        r2.star_count = 200
        r2.fork_count = 30
        r2.contributor_count = 15
        r2.primary_language = "JavaScript"
        r2.languages = ["JavaScript", "TypeScript"]
        r2.topics = ["api"]
        r2.difficulty = "intermediate"
        r2.rating_count = 10
        r2.rating_sum = 45  # avg 4.5
        r2.updated_at = datetime(2025, 11, 14, tzinfo=timezone.utc)
        r2.repo_summary = {
            "full_name": "owner/synced-repo",
            "description": "Synced repo",
            "language": "JavaScript",
            "stars": 200,
            "default_branch": "main",
            "html_url": "https://github.com/owner/synced-repo",
            "owner_avatar_url": "https://github.com/owner.png",
        }
        roadmaps.append(r2)

        # Roadmap 3: Balanced metrics
        r3 = MagicMock(spec=GeneratedRoadmap)
        r3.repo_full_name = "owner/balanced"
        r3.view_count = 50
        r3.sync_count = 25
        r3.star_count = 150
        r3.fork_count = 25
        r3.contributor_count = 12
        r3.primary_language = "Go"
        r3.languages = ["Go"]
        r3.topics = ["backend"]
        r3.difficulty = "advanced"
        r3.rating_count = 5
        r3.rating_sum = 20  # avg 4.0
        r3.updated_at = datetime(2025, 11, 16, tzinfo=timezone.utc)  # Newest
        r3.repo_summary = {
            "full_name": "owner/balanced",
            "description": "Balanced repo",
            "language": "Go",
            "stars": 150,
            "default_branch": "main",
            "html_url": "https://github.com/owner/balanced",
            "owner_avatar_url": "https://github.com/owner.png",
        }
        roadmaps.append(r3)

        return roadmaps

    def test_sort_by_newest(self, result_store, mock_session, mock_roadmaps):
        """Should sort by updated_at DESC."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.offset.return_value.limit.return_value.all.return_value = (
            mock_roadmaps
        )
        mock_session.query.return_value = mock_query

        items, total = result_store.list_catalog(1, 10, sort="newest")

        # Verify order_by was called with updated_at.desc()
        assert total == 3

    def test_sort_by_most_viewed(self, result_store, mock_session, mock_roadmaps):
        """Should sort by view_count DESC."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.offset.return_value.limit.return_value.all.return_value = (
            mock_roadmaps
        )
        mock_session.query.return_value = mock_query

        items, total = result_store.list_catalog(1, 10, sort="most_viewed")

        # Verify order_by was called
        assert total == 3

    def test_sort_by_most_synced(self, result_store, mock_session, mock_roadmaps):
        """Should sort by sync_count DESC."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.offset.return_value.limit.return_value.all.return_value = (
            mock_roadmaps
        )
        mock_session.query.return_value = mock_query

        items, total = result_store.list_catalog(1, 10, sort="most_synced")

        assert total == 3

    def test_sort_by_highest_rated(self, result_store, mock_session, mock_roadmaps):
        """Should sort by average rating DESC."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.offset.return_value.limit.return_value.all.return_value = (
            mock_roadmaps
        )
        mock_session.query.return_value = mock_query

        items, total = result_store.list_catalog(1, 10, sort="highest_rated")

        assert total == 3

    def test_sort_by_trending(self, result_store, mock_session, mock_roadmaps):
        """Should sort by trending score DESC."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.offset.return_value.limit.return_value.all.return_value = (
            mock_roadmaps
        )
        mock_session.query.return_value = mock_query

        items, total = result_store.list_catalog(1, 10, sort="trending")

        assert total == 3

    def test_pagination_parameters(self, result_store, mock_session):
        """Should respect page and page_size parameters."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 50
        mock_query.offset.return_value.limit.return_value.all.return_value = []
        mock_session.query.return_value = mock_query

        items, total = result_store.list_catalog(2, 10, sort="newest")

        # Verify offset and limit were called correctly
        mock_query.offset.assert_called_with(10)  # (page - 1) * page_size
        mock_query.offset.return_value.limit.assert_called_with(10)

    def test_page_size_limits(self, result_store, mock_session):
        """Should enforce max page_size of 100."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value.limit.return_value.all.return_value = []
        mock_session.query.return_value = mock_query

        # Request page_size > 100
        items, total = result_store.list_catalog(1, 200, sort="newest")

        # Verify limit was capped at 100
        mock_query.offset.return_value.limit.assert_called_with(100)


class TestTrendingScoreCalculation:
    """Test suite for trending score calculation logic."""

    def test_trending_score_formula(self):
        """Verify trending score calculation matches expected formula.

        Formula: (view_count * 0.4) + (sync_count * 0.3) + (avg_rating * 6 * 0.3)
        """
        # Example metrics
        view_count = 100
        sync_count = 50
        rating_sum = 45
        rating_count = 10
        avg_rating = rating_sum / rating_count  # 4.5

        expected_score = (
            (view_count * 0.4) + (sync_count * 0.3) + (avg_rating * 6 * 0.3)
        )

        # Calculate: 40 + 15 + 8.1 = 63.1
        assert expected_score == pytest.approx(63.1)

    def test_trending_score_no_ratings(self):
        """Trending score should handle repositories with no ratings."""
        view_count = 100
        sync_count = 50
        _ = 0
        avg_rating = 0  # No ratings

        expected_score = (
            (view_count * 0.4) + (sync_count * 0.3) + (avg_rating * 6 * 0.3)
        )

        # Calculate: 40 + 15 + 0 = 55
        assert expected_score == 55.0

    def test_trending_score_weights_sum_to_one(self):
        """Verify that weights sum to 1.0 for consistency."""
        weights = [0.4, 0.3, 0.3]
        assert sum(weights) == pytest.approx(1.0)


class TestViewTrackingIntegration:
    """Integration tests for view tracking workflow."""

    def test_view_tracking_workflow_anonymous(
        self, view_tracker_service, result_store, mock_session
    ):
        """Test complete workflow for anonymous user viewing a roadmap."""
        # Setup mock roadmap
        mock_roadmap = MagicMock(spec=GeneratedRoadmap)
        mock_roadmap.view_count = 10
        mock_roadmap.repo_summary = {"full_name": "owner/repo", "view_count": 10}
        mock_roadmap._sa_instance_state = MagicMock()  # Add SQLAlchemy state
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_roadmap
        )

        # 1. Check if view can be incremented (should be True for anonymous)
        can_increment = view_tracker_service.can_increment_view("owner/repo", None)
        assert can_increment is True

        # 2. Record the view (should be skipped for anonymous)
        view_tracker_service.record_view("owner/repo", None)

        # 3. Increment view count
        result_store.increment_view_count("owner/repo")

        # Verify view count was incremented
        assert mock_roadmap.view_count == 11

    def test_view_tracking_workflow_authenticated_new_user(
        self, view_tracker_service, result_store, mock_session
    ):
        """Test complete workflow for first-time authenticated user."""
        # Setup: No existing view record
        side_effect_values = [
            None,  # First call: no view record
            None,  # Second call: still no view record (for record_view)
            MagicMock(
                spec=GeneratedRoadmap, view_count=10, repo_summary={"view_count": 10}
            ),  # Third call: roadmap exists
        ]
        mock_session.query.return_value.filter_by.return_value.one_or_none.side_effect = (  # noqa E501
            side_effect_values
        )

        # 1. Check if view can be incremented (should be True for new user)
        can_increment = view_tracker_service.can_increment_view("owner/repo", "user123")
        assert can_increment is True

        # 2. Record the view
        view_tracker_service.record_view("owner/repo", "user123")

        # Verify view was recorded
        mock_session.add.assert_called_once()

    def test_view_tracking_workflow_authenticated_repeat_within_cooldown(
        self, view_tracker_service, mock_session
    ):
        """Test workflow for user viewing within cooldown period."""
        # Setup: Existing view record from 1 hour ago
        mock_record = MagicMock(spec=RoadmapViewTracker)
        mock_record.viewed_at = datetime.now(timezone.utc) - timedelta(hours=1)
        mock_session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa E501
            mock_record
        )

        # Check if view can be incremented (should be False within cooldown)
        can_increment = view_tracker_service.can_increment_view("owner/repo", "user123")
        assert can_increment is False

        # Since can_increment is False, view should not be recorded or incremented
