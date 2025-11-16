from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.auth import ClerkClaims, optional_clerk_auth, require_clerk_auth
from app.core.database import get_db
from app.models.roadmap import (
    CatalogPage,
    RatingRequest,
    RatingResponse,
    RoadmapRequest,
    RoadmapResponse,
    UserRepoStateResponse,
)
from app.services.roadmap_repository import SortOption
from app.services.roadmap_service import RoadmapService, build_roadmap_service

router = APIRouter()


def get_roadmap_service(session: Session = Depends(get_db)) -> RoadmapService:
    return build_roadmap_service(session)


def get_user_id(claims: ClerkClaims) -> str:
    """Extract user ID from ClerkClaims, raising error if missing."""
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in authentication claims",
        )
    return user_id


@router.get("/catalog", response_model=CatalogPage)
async def list_roadmaps(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    language: str | None = Query(None, description="Filter by programming language"),
    tag: str | None = Query(None, description="Filter by topic/tag"),
    difficulty: str | None = Query(None, description="Filter by difficulty"),
    min_rating: float | None = Query(
        None, ge=1.0, le=5.0, description="Minimum average rating"
    ),
    min_views: int | None = Query(None, ge=0, description="Minimum view count"),
    min_syncs: int | None = Query(None, ge=0, description="Minimum sync count"),
    sort: str = Query(
        "newest",
        description=(
            "Sort order: newest, most_viewed, most_synced, "
            "highest_rated, trending"
        ),
    ),
    service: RoadmapService = Depends(get_roadmap_service),
) -> CatalogPage:
    """List catalog with filters, sorting, and pagination."""
    import math

    items, total_count = await service.list_catalog(
        page=page,
        page_size=page_size,
        language=language,
        tag=tag,
        difficulty=difficulty,
        min_rating=min_rating,
        min_views=min_views,
        min_syncs=min_syncs,
        sort=sort,
    )

    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

    return CatalogPage(
        items=items,
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
    )


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
    user_id = get_user_id(current_user)
    return await service.generate(
        repo_url=str(payload.repo_url),
        force_refresh=payload.force_refresh,
        actor_id=user_id,
    )


@router.get("/pins", response_model=list[RoadmapResponse])
async def list_pinned_roadmaps(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[RoadmapResponse]:
    return await service.list_user_pins(get_user_id(current_user))


@router.delete("/pins/{owner}/{repo}", status_code=status.HTTP_204_NO_CONTENT)
async def unpin_roadmap(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Response:
    await service.unpin_repo(get_user_id(current_user), f"{owner}/{repo}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/user-repos", response_model=list[UserRepoStateResponse])
async def list_user_repositories(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[UserRepoStateResponse]:
    return await service.list_user_repos(get_user_id(current_user))


@router.post("/sync/{owner}/{repo}", response_model=UserRepoStateResponse)
async def sync_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStateResponse:
    return await service.sync_repo(owner, repo, get_user_id(current_user))


@router.delete("/sync/{owner}/{repo}", status_code=status.HTTP_204_NO_CONTENT)
async def desync_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Response:
    await service.desync_repo(owner, repo, get_user_id(current_user))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/archive/{owner}/{repo}", response_model=UserRepoStateResponse)
async def archive_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStateResponse:
    return await service.archive_repo(owner, repo, get_user_id(current_user))


@router.post("/unarchive/{owner}/{repo}", response_model=UserRepoStateResponse)
async def unarchive_repository(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> UserRepoStateResponse:
    return await service.unarchive_repo(owner, repo, get_user_id(current_user))


@router.get("/archived", response_model=list[UserRepoStateResponse])
async def list_archived_repositories(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> list[UserRepoStateResponse]:
    return await service.list_archived_repos(get_user_id(current_user))


@router.post("/{owner}/{repo}/rating", response_model=RatingResponse)
async def set_repository_rating(
    owner: str,
    repo: str,
    payload: RatingRequest,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RatingResponse:
    return service.set_rating(get_user_id(current_user), owner, repo, payload.rating)


@router.get("/{owner}/{repo}/rating", response_model=RatingResponse | None)
async def get_repository_rating(
    owner: str,
    repo: str,
    current_user: ClerkClaims = Depends(require_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RatingResponse | None:
    return service.get_user_rating(get_user_id(current_user), owner, repo)


@router.post("/{owner}/{repo}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_roadmap_view(
    owner: str,
    repo: str,
    current_user: Optional[ClerkClaims] = Depends(optional_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Response:
    """
    Record a view of a roadmap timeline.

    Authentication is optional. If authenticated, implements anti-spam logic
    (only one view per user per 24-hour window). Anonymous views are always counted.
    """
    user_id = current_user.get("sub") if current_user else None
    await service.record_roadmap_view(f"{owner}/{repo}", user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
