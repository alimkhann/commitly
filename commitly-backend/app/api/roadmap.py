from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.auth import ClerkClaims, require_clerk_auth
from app.core.database import get_db
from app.models.roadmap import (
    RatingRequest,
    RatingResponse,
    RoadmapCatalogPage,
    RoadmapRequest,
    RoadmapResponse,
    UserRepoStateResponse,
)
from app.services.roadmap_service import RoadmapService, build_roadmap_service

router = APIRouter()


def get_roadmap_service(session: Session = Depends(get_db)) -> RoadmapService:
    return build_roadmap_service(session)


@router.get("/catalog", response_model=RoadmapCatalogPage)
async def list_roadmaps(
    page: int = 1,
    page_size: int = 20,
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapCatalogPage:
    return await service.list_catalog(page, page_size)


@router.get("/cached/{owner}/{repo}", response_model=RoadmapResponse)
async def get_cached_roadmap(
    owner: str,
    repo: str,
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapResponse:
    full_name = f"{owner}/{repo}"
    return await service.get_cached(full_name)


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


@router.get("/pins", response_model=list[RoadmapResponse])
async def list_pinned_roadmaps(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[RoadmapResponse]:
    return await service.list_user_pins(current_user["sub"])


@router.delete("/pins/{owner}/{repo}", status_code=status.HTTP_204_NO_CONTENT)
async def unpin_roadmap(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Response:
    await service.unpin_repo(current_user["sub"], f"{owner}/{repo}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/user-repos", response_model=list[UserRepoStateResponse])
async def list_user_repositories(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[UserRepoStateResponse]:
    return await service.list_user_repos(current_user["sub"])


@router.post("/sync/{owner}/{repo}", response_model=UserRepoStateResponse)
async def sync_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStateResponse:
    return await service.sync_repo(owner, repo, current_user["sub"])


@router.delete("/sync/{owner}/{repo}", status_code=status.HTTP_204_NO_CONTENT)
async def desync_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Response:
    await service.desync_repo(owner, repo, current_user["sub"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/archive/{owner}/{repo}", response_model=UserRepoStateResponse)
async def archive_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStateResponse:
    return await service.archive_repo(owner, repo, current_user["sub"])


@router.post("/unarchive/{owner}/{repo}", response_model=UserRepoStateResponse)
async def unarchive_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStateResponse:
    return await service.unarchive_repo(owner, repo, current_user["sub"])


@router.get("/archived", response_model=list[UserRepoStateResponse])
async def list_archived_repositories(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[UserRepoStateResponse]:
    return await service.list_archived_repos(current_user["sub"])


@router.post("/{owner}/{repo}/rating", response_model=RatingResponse)
async def set_repository_rating(
    owner: str,
    repo: str,
    payload: RatingRequest,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RatingResponse:
    return service.set_rating(current_user["sub"], owner, repo, payload.rating)


@router.get("/{owner}/{repo}/rating", response_model=RatingResponse | None)
async def get_repository_rating(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RatingResponse | None:
    return service.get_user_rating(current_user["sub"], owner, repo)
