import asyncio
from datetime import datetime, timezone

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import inspect

from app.api.roadmap import get_roadmap_service
from app.models.roadmap import (
    RoadmapRepoSummary,
    RoadmapResponse,
    TimelineResource,
    TimelineStage,
    UserRepoStateResponse,
)
from app.services.github_tokens import GitHubTokenStore
from app.services.rag import CommitChunkStore
from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
from app.services.roadmap_service import RoadmapService


@pytest.fixture()
def roadmap_payload() -> RoadmapResponse:
    return RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=42,
            default_branch="main",
            html_url="https://github.com/acme/widgets",
            owner_avatar_url="https://avatars.githubusercontent.com/u/1?v=4",
        ),
        timeline=[
            TimelineStage(
                id="stage-1",
                title="Bootstrap",
                summary="Setup project",
                status="not-started",
                eta="30m",
                tasks=["Clone repo"],
                resources=[TimelineResource(label="Repo", href="https://github.com")],
            )
        ],
        cached=False,
        generated_at=datetime.now(timezone.utc),
    )


@pytest.fixture()
def stubbed_roadmap_service(client: TestClient, roadmap_payload: RoadmapResponse):
    class _StubService:
        def __init__(self) -> None:
            self.unpin_called: tuple[str, str] | None = None

        async def generate(
            self,
            repo_url: str,
            force_refresh: bool = False,
            actor_id: str | None = None,
        ):
            assert repo_url == "https://github.com/acme/widgets"
            return roadmap_payload

        async def get_cached(self, repo_full_name: str):
            assert repo_full_name == "acme/widgets"
            return roadmap_payload

        async def list_synced(self):
            return [roadmap_payload]

        async def list_catalog(self, page: int, page_size: int):
            return {
                "items": [roadmap_payload],
                "page": page,
                "page_size": page_size,
                "total_count": 1,
                "total_pages": 1,
            }

        async def list_user_pins(self, user_id: str):
            assert user_id == "user_123"
            return [roadmap_payload]

        async def sync_repo(self, owner: str, repo: str, user_id: str):
            return UserRepoStateResponse(
                repo_full_name=f"{owner}/{repo}",
                status="synced",
                is_archived=False,
                progress_percent=0,
                pinned_at=datetime.now(timezone.utc),
                repo=roadmap_payload.repo,
            )

        async def unpin_repo(self, user_id: str, repo_full_name: str):
            self.unpin_called = (user_id, repo_full_name)

    service = _StubService()
    client.app.dependency_overrides[get_roadmap_service] = lambda: service
    yield service
    client.app.dependency_overrides.pop(get_roadmap_service, None)


def test_generate_roadmap_happy_path(
    client: TestClient, auth_headers, stubbed_roadmap_service, roadmap_payload
):
    response = client.post(
        "/api/v1/roadmap/generate",
        json={"repo_url": "https://github.com/acme/widgets"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["repo"]["full_name"] == roadmap_payload.repo.full_name


def test_generate_roadmap_requires_auth(client: TestClient, stubbed_roadmap_service):
    response = client.post(
        "/api/v1/roadmap/generate", json={"repo_url": "https://github.com/acme/widgets"}
    )
    assert response.status_code == 401


def test_get_cached_roadmap(
    client: TestClient, stubbed_roadmap_service, roadmap_payload
):
    response = client.get("/api/v1/roadmap/cached/acme/widgets")
    assert response.status_code == 200
    assert response.json()["repo"]["full_name"] == roadmap_payload.repo.full_name


def test_catalog_endpoint(client: TestClient, stubbed_roadmap_service):
    response = client.get("/api/v1/roadmap/catalog")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["repo"]["full_name"] == "acme/widgets"


def test_list_user_pins(
    client: TestClient,
    auth_headers,
    stubbed_roadmap_service,
    roadmap_payload,
):
    response = client.get("/api/v1/roadmap/pins", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["repo"]["full_name"] == roadmap_payload.repo.full_name


def test_unpin_repo(client: TestClient, auth_headers, stubbed_roadmap_service):
    response = client.delete("/api/v1/roadmap/pins/acme/widgets", headers=auth_headers)
    assert response.status_code == 204
    assert stubbed_roadmap_service.unpin_called == ("user_123", "acme/widgets")


def test_pins_endpoint_recovers_when_tables_missing(client: TestClient, auth_headers):
    from app.core.database import Base, engine
    from app.models.roadmap import GeneratedRoadmap, UserSyncedRepo

    UserSyncedRepo.__table__.drop(bind=engine, checkfirst=True)
    GeneratedRoadmap.__table__.drop(bind=engine, checkfirst=True)

    response = client.get("/api/v1/roadmap/pins", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []

    inspector = inspect(engine)
    assert inspector.has_table(UserSyncedRepo.__tablename__)
    assert inspector.has_table(GeneratedRoadmap.__tablename__)

    # Restore declarative metadata state for subsequent tests.
    Base.metadata.create_all(bind=engine, checkfirst=True)


def test_sync_endpoint(client: TestClient, auth_headers, stubbed_roadmap_service):
    response = client.post("/api/v1/roadmap/sync/acme/widgets", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "synced"
    assert data["progress_percent"] == 0
    assert data["repo"]["full_name"] == "acme/widgets"


def test_sync_repo_idempotent(db_session):
    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,  # not needed since we seed the roadmap
        token_store=GitHubTokenStore(db_session),
    )

    roadmap = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap)

    first = asyncio.run(service.sync_repo("acme", "widgets", "user_sync"))
    second = asyncio.run(service.sync_repo("acme", "widgets", "user_sync"))

    assert first.status == "synced"
    assert second.status == "synced"

    record = result_store.get("acme/widgets")
    assert record.repo.full_name == "acme/widgets"
    # sync_count should only increment on first sync for this user
    assert record.repo.sync_count == 1


def test_desync_endpoint(client: TestClient, auth_headers, db_session):
    """Test desync endpoint removes repository from user's synced repos."""
    from app.services.github_tokens import GitHubTokenStore
    from app.services.rag import CommitChunkStore
    from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
    from app.services.roadmap_service import RoadmapService

    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,
        token_store=GitHubTokenStore(db_session),
    )

    # Create a roadmap and sync it
    roadmap = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap)
    asyncio.run(service.sync_repo("acme", "widgets", "user_123"))

    # Verify it's synced
    states = pin_store.list_states("user_123")
    assert len(states) == 1
    assert states[0].repo_full_name == "acme/widgets"

    # Desync it
    response = client.delete("/api/v1/roadmap/sync/acme/widgets", headers=auth_headers)
    assert response.status_code == 204

    # Verify it's removed
    states_after = pin_store.list_states("user_123")
    assert len(states_after) == 0


def test_desync_endpoint_requires_auth(client: TestClient, db_session):
    """Test desync endpoint requires authentication."""
    response = client.delete("/api/v1/roadmap/sync/acme/widgets")
    assert response.status_code == 401


def test_desync_nonexistent_repo(client: TestClient, auth_headers, db_session):
    """Test desync endpoint handles nonexistent repo gracefully."""
    response = client.delete(
        "/api/v1/roadmap/sync/nonexistent/repo", headers=auth_headers
    )
    # Should return 204 even if repo doesn't exist (idempotent operation)
    assert response.status_code == 204


def test_archive_endpoint(client: TestClient, auth_headers, db_session):
    """Test archive endpoint archives a repository."""
    from app.services.github_tokens import GitHubTokenStore
    from app.services.rag import CommitChunkStore
    from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
    from app.services.roadmap_service import RoadmapService

    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,
        token_store=GitHubTokenStore(db_session),
    )

    # Create a roadmap and sync it
    roadmap = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap)
    asyncio.run(service.sync_repo("acme", "widgets", "user_123"))

    # Verify it's not archived
    states = pin_store.list_states("user_123")
    assert len(states) == 1
    assert states[0].is_archived is False

    # Archive it
    response = client.post("/api/v1/roadmap/archive/acme/widgets", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["is_archived"] is True
    assert data["repo_full_name"] == "acme/widgets"

    # Verify it's archived in database
    states_after = pin_store.list_states("user_123")
    assert len(states_after) == 1
    assert states_after[0].is_archived is True


def test_archive_endpoint_requires_auth(client: TestClient, db_session):
    """Test archive endpoint requires authentication."""
    response = client.post("/api/v1/roadmap/archive/acme/widgets")
    assert response.status_code == 401


def test_archive_nonexistent_repo(client: TestClient, auth_headers, db_session):
    """Test archive endpoint returns 404 for nonexistent repo."""
    response = client.post(
        "/api/v1/roadmap/archive/nonexistent/repo", headers=auth_headers
    )
    assert response.status_code == 404
    assert "not synced" in response.json()["detail"].lower()


def test_unarchive_endpoint(client: TestClient, auth_headers, db_session):
    """Test unarchive endpoint unarchives a repository."""
    from app.services.github_tokens import GitHubTokenStore
    from app.services.rag import CommitChunkStore
    from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
    from app.services.roadmap_service import RoadmapService

    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,
        token_store=GitHubTokenStore(db_session),
    )

    # Create a roadmap and sync it
    roadmap = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap)
    asyncio.run(service.sync_repo("acme", "widgets", "user_123"))

    # Archive it first
    asyncio.run(service.archive_repo("acme", "widgets", "user_123"))

    # Verify it's archived
    archived = pin_store.list_archived("user_123")
    assert len(archived) == 1
    assert archived[0].is_archived is True

    # Unarchive it
    response = client.post(
        "/api/v1/roadmap/unarchive/acme/widgets", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_archived"] is False
    assert data["repo_full_name"] == "acme/widgets"

    # Verify it's unarchived in database
    archived_after = pin_store.list_archived("user_123")
    assert len(archived_after) == 0

    states = pin_store.list_states("user_123")
    assert len(states) == 1
    assert states[0].is_archived is False


def test_unarchive_endpoint_requires_auth(client: TestClient, db_session):
    """Test unarchive endpoint requires authentication."""
    response = client.post("/api/v1/roadmap/unarchive/acme/widgets")
    assert response.status_code == 401


def test_unarchive_nonexistent_repo(client: TestClient, auth_headers, db_session):
    """Test unarchive endpoint returns 404 for nonexistent repo."""
    response = client.post(
        "/api/v1/roadmap/unarchive/nonexistent/repo", headers=auth_headers
    )
    assert response.status_code == 404
    assert "not archived" in response.json()["detail"].lower()


def test_unarchive_not_archived_repo(client: TestClient, auth_headers, db_session):
    """Test unarchive endpoint returns 404 for repo that's not archived."""
    from app.services.github_tokens import GitHubTokenStore
    from app.services.rag import CommitChunkStore
    from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
    from app.services.roadmap_service import RoadmapService

    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,
        token_store=GitHubTokenStore(db_session),
    )

    # Create a roadmap and sync it (but don't archive)
    roadmap = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap)
    asyncio.run(service.sync_repo("acme", "widgets", "user_123"))

    # Try to unarchive (should fail)
    response = client.post(
        "/api/v1/roadmap/unarchive/acme/widgets", headers=auth_headers
    )
    assert response.status_code == 404
    assert "not archived" in response.json()["detail"].lower()


def test_list_archived_endpoint(client: TestClient, auth_headers, db_session):
    """Test list archived endpoint returns archived repositories."""
    from app.services.github_tokens import GitHubTokenStore
    from app.services.rag import CommitChunkStore
    from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
    from app.services.roadmap_service import RoadmapService

    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,
        token_store=GitHubTokenStore(db_session),
    )

    # Create two roadmaps
    roadmap1 = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo 1",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    roadmap2 = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/tools",
            description="Test repo 2",
            language="TypeScript",
            stars=20,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap1)
    result_store.upsert(roadmap2)

    # Sync both
    asyncio.run(service.sync_repo("acme", "widgets", "user_123"))
    asyncio.run(service.sync_repo("acme", "tools", "user_123"))

    # Archive one
    asyncio.run(service.archive_repo("acme", "widgets", "user_123"))

    # List archived
    response = client.get("/api/v1/roadmap/archived", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["repo_full_name"] == "acme/widgets"
    assert data[0]["is_archived"] is True

    # Archive the other one
    asyncio.run(service.archive_repo("acme", "tools", "user_123"))

    # List archived again
    response = client.get("/api/v1/roadmap/archived", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    repo_names = {repo["repo_full_name"] for repo in data}
    assert repo_names == {"acme/widgets", "acme/tools"}
    assert all(repo["is_archived"] is True for repo in data)


def test_list_archived_endpoint_requires_auth(client: TestClient, db_session):
    """Test list archived endpoint requires authentication."""
    response = client.get("/api/v1/roadmap/archived")
    assert response.status_code == 401


def test_list_archived_empty(client: TestClient, auth_headers, db_session):
    """Test list archived endpoint returns empty list when no archived repos."""
    response = client.get("/api/v1/roadmap/archived", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_archive_unarchive_cycle(client: TestClient, auth_headers, db_session):
    """Test that archive/unarchive cycle works correctly."""
    from app.services.github_tokens import GitHubTokenStore
    from app.services.rag import CommitChunkStore
    from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore
    from app.services.roadmap_service import RoadmapService

    result_store = RoadmapResultStore(db_session)
    pin_store = UserSyncedRepoStore(db_session, result_store)
    service = RoadmapService(
        chunk_store=CommitChunkStore(db_session),
        result_store=result_store,
        pin_store=pin_store,
        generator=None,
        token_store=GitHubTokenStore(db_session),
    )

    # Create and sync a roadmap
    roadmap = RoadmapResponse(
        repo=RoadmapRepoSummary(
            full_name="acme/widgets",
            description="Test repo",
            language="Python",
            stars=10,
            default_branch="main",
            html_url=None,
            owner_avatar_url=None,
        ),
        timeline=[],
        cached=True,
        generated_at=datetime.now(timezone.utc),
    )
    result_store.upsert(roadmap)
    asyncio.run(service.sync_repo("acme", "widgets", "user_123"))

    # Archive it
    response = client.post("/api/v1/roadmap/archive/acme/widgets", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_archived"] is True

    # Unarchive it
    response = client.post(
        "/api/v1/roadmap/unarchive/acme/widgets", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["is_archived"] is False

    # Archive it again
    response = client.post("/api/v1/roadmap/archive/acme/widgets", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_archived"] is True

    # Verify final state
    states = pin_store.list_states("user_123")
    assert len(states) == 1
    assert states[0].is_archived is True
