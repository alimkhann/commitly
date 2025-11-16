from datetime import datetime, timezone

from fastapi.testclient import TestClient
import pytest

from app.api.roadmap import get_roadmap_service
from app.models.roadmap import (
  PaginatedRoadmapList,
  PublicRoadmapRecord,
  RatingResponse,
  RoadmapRepoSummary,
  RoadmapResponse,
  RoadmapStats,
  TimelineResource,
  TimelineStage,
  UserRepoStatePayload,
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
      self.synced = False

    async def generate(self, repo_url: str, force_refresh: bool = False, actor_id: str | None = None):
      assert repo_url == "https://github.com/acme/widgets"
      return roadmap_payload

    async def get_cached(self, repo_full_name: str, viewer_id: str | None = None):
      assert repo_full_name == "acme/widgets"
      return roadmap_payload

    async def list_public_catalog(self, query):
      record = PublicRoadmapRecord(
        repo=roadmap_payload.repo,
        stats=RoadmapStats(
          primary_language="Python",
          languages=["Python"],
          topics=["ai"],
          difficulty="intro",
          star_count=42,
          fork_count=10,
          contributor_count=3,
          last_pushed_at=roadmap_payload.generated_at,
          license="MIT",
          view_count=5,
          sync_count=1,
          rating_count=0,
          rating_sum=0,
          average_rating=None,
        ),
      )
      return PaginatedRoadmapList(items=[record], page=1, page_size=1, total_count=1, total_pages=1)

    async def list_user_repos(self, user_id: str, include_archived: bool = False):
      record = PublicRoadmapRecord(
        repo=roadmap_payload.repo,
        stats=RoadmapStats(
          primary_language="Python",
          languages=["Python"],
          topics=["ai"],
          difficulty="intro",
          star_count=42,
          fork_count=10,
          contributor_count=3,
          last_pushed_at=roadmap_payload.generated_at,
          license="MIT",
          view_count=5,
          sync_count=1,
          rating_count=0,
          rating_sum=0,
          average_rating=None,
        ),
      )
      return [UserRepoStatePayload(
        repo=record,
        status="synced",
        progress_percent=0,
        is_archived=False,
        synced_at=datetime.now(timezone.utc),
        last_viewed_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
      )]

    async def list_archived_repos(self, user_id: str):
      return []

    async def sync_repo(self, user_id: str, repo_full_name: str):
      self.synced = True
      return (await self.list_user_repos(user_id))[0]

    async def desync_repo(self, user_id: str, repo_full_name: str):
      self.synced = False
      return (await self.list_user_repos(user_id))[0]

    async def archive_repo(self, user_id: str, repo_full_name: str):
      return (await self.list_user_repos(user_id))[0]

    async def unarchive_repo(self, user_id: str, repo_full_name: str):
      return (await self.list_user_repos(user_id))[0]

    async def set_rating(self, user_id: str, repo_full_name: str, rating: int):
      return RatingResponse(rating=rating, average_rating=rating, rating_count=1)

    async def get_rating(self, user_id: str, repo_full_name: str):
      return RatingResponse(rating=None, average_rating=None, rating_count=0)

  service = _StubService()
  client.app.dependency_overrides[get_roadmap_service] = lambda: service
  yield service
  client.app.dependency_overrides.pop(get_roadmap_service, None)


def test_generate_roadmap_happy_path(client: TestClient, auth_headers, stubbed_roadmap_service, roadmap_payload):
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


def test_get_cached_roadmap(client: TestClient, stubbed_roadmap_service, roadmap_payload):
  response = client.get("/api/v1/roadmap/cached/acme/widgets")
  assert response.status_code == 200
  assert response.json()["repo"]["full_name"] == roadmap_payload.repo.full_name


def test_catalog_endpoint(client: TestClient, stubbed_roadmap_service):
  response = client.get("/api/v1/roadmap/catalog")
  assert response.status_code == 200
  body = response.json()
  assert body["total_count"] == 1
  assert len(body["items"]) == 1


def test_list_user_repos(client: TestClient, auth_headers, stubbed_roadmap_service):
  response = client.get("/api/v1/roadmap/repos/me", headers=auth_headers)
  assert response.status_code == 200
  assert response.json()[0]["status"] == "synced"
