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
)


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
