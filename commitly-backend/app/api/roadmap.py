from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.auth import ClerkClaims, optional_clerk_auth, require_clerk_auth
from app.core.database import get_db
from app.models.roadmap import (
    PaginatedRoadmapList,
    RatingResponse,
    RoadmapRequest,
    RoadmapResponse,
    UserRepoStatePayload,
)
from app.services.roadmap_repository import CatalogQuery
from app.services.roadmap_service import RoadmapService, build_roadmap_service

router = APIRouter()


def get_roadmap_service(session: Session = Depends(get_db)) -> RoadmapService:
    return build_roadmap_service(session)


@router.get("/catalog", response_model=PaginatedRoadmapList)
async def list_public_catalog(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    language: list[str] = Query(default=[]),
    topic: list[str] = Query(default=[]),
    difficulty: str | None = Query(default=None),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    min_views: int | None = Query(default=None, ge=0),
    min_syncs: int | None = Query(default=None, ge=0),
    sort: str = Query("trending"),
    search: str | None = Query(default=None, max_length=120),
    service: RoadmapService = Depends(get_roadmap_service),
) -> PaginatedRoadmapList:
    query = CatalogQuery(
        page=page,
        page_size=page_size,
        languages=language,
        topics=topic,
        difficulty=difficulty,
        min_rating=min_rating,
        min_views=min_views,
        min_syncs=min_syncs,
        sort=sort,
        search=search,
    )
    return await service.list_public_catalog(query)


@router.get("/cached/{owner}/{repo}", response_model=RoadmapResponse)
async def get_cached_roadmap(
    owner: str,
    repo: str,
    current_user: ClerkClaims | None = Depends(optional_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapResponse:
    full_name = f"{owner}/{repo}"
    viewer_id = current_user["sub"] if current_user else None
    return await service.get_cached(full_name, viewer_id)


@router.post("/generate", response_model=RoadmapResponse)
async def generate_roadmap(
    payload: RoadmapRequest,
    service: RoadmapService = Depends(get_roadmap_service),
    current_user: ClerkClaims = Depends(require_clerk_auth),
) -> RoadmapResponse:
    return await service.generate(
        repo_url=str(payload.repo_url),
        force_refresh=payload.force_refresh,
        actor_id=current_user["sub"],
    )


@router.get("/repos/me", response_model=list[UserRepoStatePayload])
async def list_my_repositories(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[UserRepoStatePayload]:
    return await service.list_user_repos(current_user["sub"], include_archived=False)


@router.get("/repos/me/archived", response_model=list[UserRepoStatePayload])
async def list_archived_repositories(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[UserRepoStatePayload]:
    return await service.list_archived_repos(current_user["sub"])


@router.post("/sync/{owner}/{repo}", response_model=UserRepoStatePayload)
async def sync_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStatePayload:
    return await service.sync_repo(current_user["sub"], f"{owner}/{repo}")


@router.delete("/sync/{owner}/{repo}", response_model=UserRepoStatePayload)
async def desync_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStatePayload:
    return await service.desync_repo(current_user["sub"], f"{owner}/{repo}")


@router.post("/archive/{owner}/{repo}", response_model=UserRepoStatePayload)
async def archive_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStatePayload:
    return await service.archive_repo(current_user["sub"], f"{owner}/{repo}")


@router.post("/unarchive/{owner}/{repo}", response_model=UserRepoStatePayload)
async def unarchive_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStatePayload:
    return await service.unarchive_repo(current_user["sub"], f"{owner}/{repo}")


@router.post("/{owner}/{repo}/rating", response_model=RatingResponse)
async def set_rating(
    owner: str,
    repo: str,
    rating: int = Query(..., ge=1, le=5),
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RatingResponse:
    return await service.set_rating(current_user["sub"], f"{owner}/{repo}", rating)


@router.get("/{owner}/{repo}/rating", response_model=RatingResponse)
async def get_my_rating(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RatingResponse:
    return await service.get_rating(current_user["sub"], f"{owner}/{repo}")
