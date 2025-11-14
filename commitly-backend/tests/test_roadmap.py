from datetime import datetime, timezone

from fastapi.testclient import TestClient
import pytest

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
        async def generate(
            self,
            repo_url: str,
            force_refresh: bool = False,
            actor_id: str | None = None,
        ):
            assert repo_url == "https://github.com/acme/widgets"
            return roadmap_payload

    client.app.dependency_overrides[get_roadmap_service] = lambda: _StubService()
    yield
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


def test_generate_roadmap_requires_auth(client: TestClient):
    response = client.post(
        "/api/v1/roadmap/generate", json={"repo_url": "https://github.com/acme/widgets"}
    )
    assert response.status_code == 401
