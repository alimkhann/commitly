"""Tests for GitHub service metadata collection."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services.github import (
    GitHubService,
    GitHubServiceError,
    RepositoryIdentity,
)


@pytest.fixture()
def github_service():
    return GitHubService(token="test-token")


@pytest.mark.asyncio
async def test_fetch_repository_with_metadata(github_service):
    """Test that fetch_repository collects all metadata fields."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    # Mock responses for all API calls
    repo_response = MagicMock()
    repo_response.json.return_value = {
        "id": 123,
        "name": "widgets",
        "full_name": "acme/widgets",
        "description": "Test repo",
        "default_branch": "main",
        "stargazers_count": 100,
        "language": "Python",
        "html_url": "https://github.com/acme/widgets",
        "owner": {"avatar_url": "https://avatars.githubusercontent.com/u/1?v=4"},
        "forks_count": 25,
        "pushed_at": "2024-01-15T10:30:00Z",
        "license": {"name": "MIT"},
    }
    repo_response.headers = {}

    languages_response = MagicMock()
    languages_response.json.return_value = {
        "Python": 50000,
        "TypeScript": 20000,
        "JavaScript": 10000,
    }

    topics_response = MagicMock()
    topics_response.status_code = 200
    topics_response.json.return_value = {"names": ["web", "api", "framework"]}

    contributors_response = MagicMock()
    contributors_response.json.return_value = [
        {"login": "user1"},
        {"login": "user2"},
        {"login": "user3"},
    ]
    contributors_response.headers = {"Link": ""}  # No next page

    with patch.object(github_service, "_request") as mock_request:
        # Setup mock to return different responses based on path
        def request_side_effect(method, path, **kwargs):
            if path == "/repos/acme/widgets":
                return repo_response
            if path == "/repos/acme/widgets/languages":
                return languages_response
            if path == "/repos/acme/widgets/topics":
                return topics_response
            if path == "/repos/acme/widgets/contributors":
                return contributors_response
            raise ValueError(f"Unexpected path: {path}")

        mock_request.side_effect = request_side_effect

        # Mock the topics endpoint which uses different headers
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            mock_client_instance.request.return_value = topics_response

            repo = await github_service.fetch_repository(identity)

    assert repo.full_name == "acme/widgets"
    assert repo.stars == 100
    assert repo.fork_count == 25
    assert repo.license == "MIT"
    assert repo.contributor_count == 3
    assert repo.languages == {"Python": 50000, "TypeScript": 20000, "JavaScript": 10000}
    assert repo.topics == ["web", "api", "framework"]
    assert repo.last_pushed_at is not None


@pytest.mark.asyncio
async def test_fetch_repo_handles_missing_metadata(github_service):
    """Test that fetch_repository handles missing metadata gracefully."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    repo_response = MagicMock()
    repo_response.json.return_value = {
        "id": 123,
        "name": "widgets",
        "full_name": "acme/widgets",
        "description": None,
        "default_branch": "main",
        "stargazers_count": 0,
        "language": None,
        "html_url": None,
        "owner": {},
        "forks_count": 0,
        "pushed_at": None,
        "license": None,
    }
    repo_response.headers = {}

    with patch.object(github_service, "_request") as mock_request:

        def request_side_effect(method, path, **kwargs):
            if path == "/repos/acme/widgets":
                return repo_response
            if path == "/repos/acme/widgets/languages":
                raise GitHubServiceError("Languages not available")
            if path == "/repos/acme/widgets/topics":
                raise GitHubServiceError("Topics not available")
            if path == "/repos/acme/widgets/contributors":
                raise GitHubServiceError("Contributors not available")
            raise ValueError(f"Unexpected path: {path}")

        mock_request.side_effect = request_side_effect

        # Mock topics endpoint
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            mock_client_instance.request.side_effect = Exception("Topics error")

            repo = await github_service.fetch_repository(identity)

    assert repo.full_name == "acme/widgets"
    assert repo.languages is None
    assert repo.topics is None
    assert repo.contributor_count == 0
    assert repo.license is None
    assert repo.last_pushed_at is None


@pytest.mark.asyncio
async def test_fetch_contributor_count_with_pagination(
    github_service,
):
    """Test that contributor count handles pagination correctly."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    # First page
    page1_response = MagicMock()
    page1_response.json.return_value = [{"login": f"user{i}"} for i in range(100)]
    page1_response.headers = {
        "Link": (
            "<https://api.github.com/repos/acme/widgets/contributors?page=2>; "
            'rel="next"'
        )
    }

    # Second page
    page2_response = MagicMock()
    page2_response.json.return_value = [{"login": f"user{i}"} for i in range(100, 150)]
    page2_response.headers = {"Link": ""}  # No next page

    with patch.object(github_service, "_request") as mock_request:
        call_count = 0

        def request_side_effect(method, path, **kwargs):
            nonlocal call_count
            call_count += 1
            if "contributors" in path:
                if call_count == 1:
                    return page1_response
                return page2_response
            raise ValueError(f"Unexpected path: {path}")

        mock_request.side_effect = request_side_effect

        count = await github_service._fetch_contributor_count(identity)

    assert count == 150


@pytest.mark.asyncio
async def test_fetch_languages(github_service):
    """Test fetching repository languages."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    response = MagicMock()
    response.json.return_value = {"Python": 50000, "TypeScript": 20000}

    with patch.object(github_service, "_request", return_value=response):
        languages = await github_service._fetch_languages(identity)

    assert languages == {"Python": 50000, "TypeScript": 20000}


@pytest.mark.asyncio
async def test_fetch_languages_handles_error(github_service):
    """Test that fetch_languages returns None on error."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    with patch.object(
        github_service, "_request", side_effect=GitHubServiceError("Not found")
    ):
        languages = await github_service._fetch_languages(identity)

    assert languages is None


@pytest.mark.asyncio
async def test_fetch_topics(github_service):
    """Test fetching repository topics."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"names": ["web", "api", "framework"]}

    with patch("httpx.AsyncClient") as mock_client:
        mock_client_instance = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        mock_client_instance.request.return_value = response

        topics = await github_service._fetch_topics(identity)

    assert topics == ["web", "api", "framework"]


@pytest.mark.asyncio
async def test_fetch_topics_handles_error(github_service):
    """Test that fetch_topics returns None on error."""
    identity = RepositoryIdentity(owner="acme", name="widgets")

    with patch("httpx.AsyncClient") as mock_client:
        mock_client_instance = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        mock_client_instance.request.side_effect = Exception("Error")

        topics = await github_service._fetch_topics(identity)

    assert topics is None
