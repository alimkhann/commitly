"""Tests for catalog filtering, sorting, and pagination functionality."""

import pytest

from app.models.roadmap import RoadmapResponse
from app.services.roadmap_service import RoadmapService


class TestCatalogFilters:
    """Test catalog filtering functionality."""

    @pytest.mark.asyncio
    async def test_list_catalog_no_filters(self, roadmap_service: RoadmapService):
        """Test listing catalog without any filters."""
        results, total_count = await roadmap_service.list_catalog(page=1, page_size=10)
        assert isinstance(results, list)
        assert isinstance(total_count, int)
        assert len(results) <= 10
        for result in results:
            assert isinstance(result, RoadmapResponse)

    @pytest.mark.asyncio
    async def test_list_catalog_language_filter(self, roadmap_service: RoadmapService):
        """Test filtering by language."""
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=10, language="Python"
        )
        for result in results:
            assert result.repo_summary.get("language") == "Python"

    @pytest.mark.asyncio
    async def test_list_catalog_tag_filter(self, roadmap_service: RoadmapService):
        """Test filtering by tag."""
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=10, tag="machine-learning"
        )
        for result in results:
            topics = result.repo_summary.get("topics", [])
            assert "machine-learning" in topics

    @pytest.mark.asyncio
    async def test_list_catalog_difficulty_filter(
        self, roadmap_service: RoadmapService
    ):
        """Test filtering by difficulty."""
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=10, difficulty="beginner"
        )
        for result in results:
            assert result.repo_summary.get("difficulty") == "beginner"

    @pytest.mark.asyncio
    async def test_list_catalog_min_rating_filter(
        self, roadmap_service: RoadmapService
    ):
        """Test filtering by minimum rating."""
        min_rating = 4.0
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=10, min_rating=min_rating
        )
        for result in results:
            rating_count = result.repo_summary.get("rating_count", 0)
            rating_sum = result.repo_summary.get("rating_sum", 0)
            if rating_count > 0:
                avg_rating = rating_sum / rating_count
                assert avg_rating >= min_rating

    @pytest.mark.asyncio
    async def test_list_catalog_min_views_filter(self, roadmap_service: RoadmapService):
        """Test filtering by minimum views."""
        min_views = 100
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=10, min_views=min_views
        )
        for result in results:
            view_count = result.repo_summary.get("view_count", 0)
            assert view_count >= min_views

    @pytest.mark.asyncio
    async def test_list_catalog_min_syncs_filter(self, roadmap_service: RoadmapService):
        """Test filtering by minimum syncs."""
        min_syncs = 10
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=10, min_syncs=min_syncs
        )
        for result in results:
            sync_count = result.repo_summary.get("sync_count", 0)
            assert sync_count >= min_syncs

    @pytest.mark.asyncio
    async def test_list_catalog_combined_filters(self, roadmap_service: RoadmapService):
        """Test multiple filters combined."""
        results, total_count = await roadmap_service.list_catalog(
            page=1,
            page_size=10,
            language="Python",
            difficulty="intermediate",
            min_rating=3.5,
            min_views=50,
        )
        for result in results:
            assert result.repo_summary.get("language") == "Python"
            assert result.repo_summary.get("difficulty") == "intermediate"
            view_count = result.repo_summary.get("view_count", 0)
            assert view_count >= 50
            rating_count = result.repo_summary.get("rating_count", 0)
            rating_sum = result.repo_summary.get("rating_sum", 0)
            if rating_count > 0:
                avg_rating = rating_sum / rating_count
                assert avg_rating >= 3.5


class TestCatalogSorting:
    """Test catalog sorting functionality."""

    @pytest.mark.asyncio
    async def test_sort_by_newest(self, roadmap_service: RoadmapService):
        """Test sorting by newest (created_at DESC)."""
        results, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, sort="newest"
        )
        if len(results) > 1:
            # Check that results are ordered by created_at DESC
            for i in range(len(results) - 1):
                assert results[i].created_at >= results[i + 1].created_at

    @pytest.mark.asyncio
    async def test_sort_by_most_viewed(self, roadmap_service: RoadmapService):
        """Test sorting by most viewed."""
        results, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, sort="most_viewed"
        )
        if len(results) > 1:
            # Check that results are ordered by view_count DESC
            for i in range(len(results) - 1):
                view_count_i = results[i].repo_summary.get("view_count", 0)
                view_count_next = results[i + 1].repo_summary.get("view_count", 0)
                assert view_count_i >= view_count_next

    @pytest.mark.asyncio
    async def test_sort_by_most_synced(self, roadmap_service: RoadmapService):
        """Test sorting by most synced."""
        results, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, sort="most_synced"
        )
        if len(results) > 1:
            # Check that results are ordered by sync_count DESC
            for i in range(len(results) - 1):
                sync_count_i = results[i].repo_summary.get("sync_count", 0)
                sync_count_next = results[i + 1].repo_summary.get("sync_count", 0)
                assert sync_count_i >= sync_count_next

    @pytest.mark.asyncio
    async def test_sort_by_highest_rated(self, roadmap_service: RoadmapService):
        """Test sorting by highest rated."""
        results, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, sort="highest_rated"
        )
        if len(results) > 1:
            # Check that results are ordered by avg_rating DESC
            for i in range(len(results) - 1):
                rating_count_i = results[i].repo_summary.get("rating_count", 0)
                rating_sum_i = results[i].repo_summary.get("rating_sum", 0)
                avg_rating_i = (
                    rating_sum_i / rating_count_i if rating_count_i > 0 else 0
                )

                rating_count_next = results[i + 1].repo_summary.get("rating_count", 0)
                rating_sum_next = results[i + 1].repo_summary.get("rating_sum", 0)
                avg_rating_next = (
                    rating_sum_next / rating_count_next if rating_count_next > 0 else 0
                )

                assert avg_rating_i >= avg_rating_next

    @pytest.mark.asyncio
    async def test_sort_by_trending(self, roadmap_service: RoadmapService):
        """Test sorting by trending score."""
        results, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, sort="trending"
        )

        def calculate_trending_score(result):
            view_count = result.repo_summary.get("view_count", 0)
            sync_count = result.repo_summary.get("sync_count", 0)
            rating_count = result.repo_summary.get("rating_count", 0)
            rating_sum = result.repo_summary.get("rating_sum", 0)
            avg_rating = rating_sum / rating_count if rating_count > 0 else 0
            return view_count * 0.4 + sync_count * 0.3 + avg_rating * 6 * 0.3

        if len(results) > 1:
            # Check that results are ordered by trending score DESC
            for i in range(len(results) - 1):
                score_i = calculate_trending_score(results[i])
                score_next = calculate_trending_score(results[i + 1])
                assert score_i >= score_next


class TestCatalogPagination:
    """Test catalog pagination functionality."""

    @pytest.mark.asyncio
    async def test_pagination_first_page(self, roadmap_service: RoadmapService):
        """Test first page of results."""
        page_size = 5
        results, total_count = await roadmap_service.list_catalog(
            page=1, page_size=page_size
        )
        assert len(results) <= page_size
        assert total_count >= 0

    @pytest.mark.asyncio
    async def test_pagination_second_page(self, roadmap_service: RoadmapService):
        """Test second page of results."""
        page_size = 5
        # Get first page
        first_page, total_count = await roadmap_service.list_catalog(
            page=1, page_size=page_size
        )
        # Get second page
        second_page, _ = await roadmap_service.list_catalog(page=2, page_size=page_size)

        if total_count > page_size:
            # Pages should have different results
            first_page_ids = {r.roadmap_id for r in first_page}
            second_page_ids = {r.roadmap_id for r in second_page}
            assert first_page_ids.isdisjoint(second_page_ids)

    @pytest.mark.asyncio
    async def test_pagination_beyond_last_page(self, roadmap_service: RoadmapService):
        """Test requesting page beyond available results."""
        results, total_count = await roadmap_service.list_catalog(
            page=9999, page_size=10
        )
        assert len(results) == 0
        assert total_count >= 0

    @pytest.mark.asyncio
    async def test_pagination_page_size_consistency(
        self, roadmap_service: RoadmapService
    ):
        """Test that page size is respected."""
        page_sizes = [5, 10, 20]
        for page_size in page_sizes:
            results, _ = await roadmap_service.list_catalog(page=1, page_size=page_size)
            assert len(results) <= page_size

    @pytest.mark.asyncio
    async def test_pagination_total_count_consistency(
        self, roadmap_service: RoadmapService
    ):
        """Test that total_count is consistent across pages."""
        _, total_count_page1 = await roadmap_service.list_catalog(page=1, page_size=10)
        _, total_count_page2 = await roadmap_service.list_catalog(page=2, page_size=10)
        assert total_count_page1 == total_count_page2


class TestCatalogEdgeCases:
    """Test edge cases for catalog functionality."""

    @pytest.mark.asyncio
    async def test_empty_results(self, roadmap_service: RoadmapService):
        """Test handling of empty results."""
        results, total_count = await roadmap_service.list_catalog(
            page=1,
            page_size=10,
            language="NonexistentLanguage",
            min_rating=5.0,
            min_views=1000000,
        )
        assert len(results) == 0
        assert total_count == 0

    @pytest.mark.asyncio
    async def test_invalid_page_number(self, roadmap_service: RoadmapService):
        """Test that page number is properly validated."""
        # Page 0 should work (will be treated as page 1)
        results, _ = await roadmap_service.list_catalog(page=0, page_size=10)
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_min_rating_boundary(self, roadmap_service: RoadmapService):
        """Test minimum rating at boundary values."""
        # Test with exactly 1.0
        results_1, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, min_rating=1.0
        )
        assert isinstance(results_1, list)

        # Test with exactly 5.0
        results_5, _ = await roadmap_service.list_catalog(
            page=1, page_size=10, min_rating=5.0
        )
        assert isinstance(results_5, list)

    @pytest.mark.asyncio
    async def test_filter_with_sorting(self, roadmap_service: RoadmapService):
        """Test that filters work correctly with sorting."""
        results, _ = await roadmap_service.list_catalog(
            page=1,
            page_size=10,
            language="Python",
            sort="most_viewed",
        )
        # All results should match filter
        for result in results:
            assert result.repo_summary.get("language") == "Python"
        # And should be sorted by views
        if len(results) > 1:
            for i in range(len(results) - 1):
                view_count_i = results[i].repo_summary.get("view_count", 0)
                view_count_next = results[i + 1].repo_summary.get("view_count", 0)
                assert view_count_i >= view_count_next
