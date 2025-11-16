from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Sequence

from fastapi import HTTPException, status

from app.core.cache import RedisJSONCache, redis_cache
from app.core.config import settings
from app.models.roadmap import (
    PaginatedRoadmapList,
    PublicRoadmapRecord,
    RatingResponse,
    RoadmapRepoSummary,
    RoadmapResponse,
    TimelineStage,
    UserRepoStatePayload,
)
from app.services.ai.gemini import (
    GeminiConfigurationError,
    GeminiGenerationError,
    GeminiRoadmapGenerator,
)
from app.services.github import (
    CommitSnapshot,
    GitHubAuthenticationError,
    GitHubRateLimitExceeded,
    GitHubService,
    GitHubServiceError,
    RepositoryIdentity,
    RepositoryMetadata,
    parse_github_url,
)
from app.services.github_tokens import GitHubTokenStore
from app.services.rag import ChunkStorageError, CommitChunk, CommitChunkStore
from app.services.roadmap_repository import (
    CatalogQuery,
    GeneratedRoadmapMetadata,
    RoadmapRatingStore,
    RoadmapResultStore,
    UserRepoStateStore,
)


class RoadmapService:
    def __init__(
        self,
        chunk_store: CommitChunkStore,
        result_store: RoadmapResultStore,
        user_repo_store: UserRepoStateStore,
        rating_store: RoadmapRatingStore,
        generator: GeminiRoadmapGenerator,
        token_store: GitHubTokenStore,
        cache: RedisJSONCache | None = None,
        cache_ttl: int = settings.roadmap_cache_ttl_seconds,
        commit_limit: int = settings.github_commit_limit,
        timeline_fraction: float = settings.roadmap_timeline_fraction,
    ) -> None:
        self._chunk_store = chunk_store
        self._generator = generator
        self._token_store = token_store
        self._cache = cache
        self._cache_ttl = cache_ttl
        self._commit_limit = commit_limit
        self._timeline_fraction = timeline_fraction
        self._default_token = settings.github_token
        self._result_store = result_store
        self._user_repo_store = user_repo_store
        self._rating_store = rating_store

    async def generate(
        self,
        repo_url: str,
        force_refresh: bool = False,
        actor_id: str | None = None,
    ) -> RoadmapResponse:
        identity = self._parse_identity(repo_url)
        cache_key = f"roadmap:{identity.full_name.lower()}"
        if not force_refresh and self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                response = RoadmapResponse.model_validate(cached)
                if actor_id:
                    self._user_repo_store.touch_unsynced(actor_id, identity.full_name)
                return response
        token = None
        if actor_id:
            record = self._token_store.get_token(actor_id)
            if record:
                token = record.access_token
        if token is None:
            token = self._default_token
        if not token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Connect GitHub to generate a roadmap",
            )
        github_client = GitHubService(token=token)
        repo = await self._fetch_repo(github_client, identity)
        try:
            commits = await github_client.fetch_commits(
                identity, repo.default_branch, self._commit_limit
            )
        except GitHubAuthenticationError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
            )
        except GitHubRateLimitExceeded as exc:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)
            )
        except GitHubServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            )
        if not commits:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Repository does not contain commits",
            )
        chunks = self._build_chunks(repo.full_name, commits)
        try:
            self._chunk_store.persist(chunks)
        except ChunkStorageError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )
        stage_budget = max(1, math.ceil(len(commits) * self._timeline_fraction))
        try:
            timeline = await self._generator.generate(repo, chunks, stage_budget)
        except GeminiGenerationError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            )
        response = RoadmapResponse(
            repo=self._to_summary(repo),
            timeline=timeline,
            cached=False,
            generated_at=datetime.now(timezone.utc),
        )
        metadata = self._build_metadata(repo, timeline)
        if self._cache:
            await self._cache.set(
                cache_key, response.model_dump(mode="json"), self._cache_ttl
            )
        self._result_store.upsert(response, metadata)
        if actor_id:
            self._user_repo_store.touch_unsynced(actor_id, repo.full_name)
        return response

    async def get_cached(
        self, repo_full_name: str, viewer_id: str | None = None
    ) -> RoadmapResponse:
        result = self._result_store.get(repo_full_name)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timeline has not been generated for this repository.",
            )
        self._user_repo_store.record_view(viewer_id, repo_full_name)
        if viewer_id:
            self._user_repo_store.touch_unsynced(viewer_id, repo_full_name)
        return result

    async def list_public_catalog(self, query: CatalogQuery) -> PaginatedRoadmapList:
        clamped = self._normalize_catalog_query(query)
        items, total = self._result_store.paginate_catalog(clamped)
        total_pages = max(1, math.ceil(total / clamped.page_size))
        return PaginatedRoadmapList(
            items=items,
            page=clamped.page,
            page_size=clamped.page_size,
            total_count=total,
            total_pages=total_pages,
        )

    async def list_user_repos(
        self, user_id: str, include_archived: bool = False
    ) -> list[UserRepoStatePayload]:
        records = self._user_repo_store.list_states(user_id, include_archived)
        payloads: list[UserRepoStatePayload] = []
        for state, record in records:
            if not include_archived and state.is_archived:
                continue
            public_record = self._result_store.build_public_record(record)
            payloads.append(self._to_user_payload(state, public_record))
        return payloads

    async def list_archived_repos(self, user_id: str) -> list[UserRepoStatePayload]:
        states = self._user_repo_store.list_states(user_id, include_archived=True)
        payloads: list[UserRepoStatePayload] = []
        for state, record in states:
            if not state.is_archived:
                continue
            public_record = self._result_store.build_public_record(record)
            payloads.append(self._to_user_payload(state, public_record))
        return payloads

    async def sync_repo(
        self, user_id: str, repo_full_name: str
    ) -> UserRepoStatePayload:
        public_record = self._result_store.get_public_record(repo_full_name)
        if not public_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timeline has not been generated for this repository.",
            )
        state_tuple = self._user_repo_store.mark_synced(user_id, repo_full_name)
        if state_tuple[0] is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create repo state",
            )
        state, transitioned = state_tuple
        if transitioned:
            self._result_store.adjust_sync_count(repo_full_name, 1)
        return self._to_user_payload(state, public_record)

    async def desync_repo(
        self, user_id: str, repo_full_name: str
    ) -> UserRepoStatePayload:
        public_record = self._result_store.get_public_record(repo_full_name)
        if not public_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timeline has not been generated for this repository.",
            )
        state, transitioned = self._user_repo_store.mark_unsynced(
            user_id, repo_full_name
        )
        if state is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="You have no saved state for this repository.",
            )
        if transitioned:
            self._result_store.adjust_sync_count(repo_full_name, -1)
        return self._to_user_payload(state, public_record)

    async def archive_repo(
        self, user_id: str, repo_full_name: str
    ) -> UserRepoStatePayload:
        public_record = self._get_public_record_or_404(repo_full_name)
        state = self._user_repo_store.archive(user_id, repo_full_name)
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="You have no saved state for this repository.",
            )
        return self._to_user_payload(state, public_record)

    async def unarchive_repo(
        self, user_id: str, repo_full_name: str
    ) -> UserRepoStatePayload:
        public_record = self._get_public_record_or_404(repo_full_name)
        state = self._user_repo_store.unarchive(user_id, repo_full_name)
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="You have no saved state for this repository.",
            )
        return self._to_user_payload(state, public_record)

    async def set_rating(
        self, user_id: str, repo_full_name: str, rating: int
    ) -> RatingResponse:
        if rating < 1 or rating > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rating must be between 1 and 5",
            )
        state = self._user_repo_store.list_states(user_id, include_archived=True)
        state_map = {item[0].repo_full_name: item[0] for item in state}
        current_state = state_map.get(repo_full_name)
        if not current_state or current_state.status != "synced":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sync the repository before leaving a rating",
            )
        self._rating_store.upsert(user_id, repo_full_name, rating)
        public_record = self._get_public_record_or_404(repo_full_name)
        return RatingResponse(
            rating=rating,
            average_rating=public_record.stats.average_rating,
            rating_count=public_record.stats.rating_count,
        )

    async def get_rating(self, user_id: str, repo_full_name: str) -> RatingResponse:
        public_record = self._get_public_record_or_404(repo_full_name)
        record = self._rating_store.get(user_id, repo_full_name)
        return RatingResponse(
            rating=record.rating if record else None,
            average_rating=public_record.stats.average_rating,
            rating_count=public_record.stats.rating_count,
        )

    def _parse_identity(self, repo_url: str) -> RepositoryIdentity:
        try:
            return parse_github_url(repo_url)
        except GitHubServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            )

    async def _fetch_repo(
        self, github: GitHubService, identity: RepositoryIdentity
    ) -> RepositoryMetadata:
        try:
            return await github.fetch_repository(identity)
        except GitHubAuthenticationError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
            )
        except GitHubServiceError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    def _build_chunks(
        self, full_name: str, commits: Sequence[CommitSnapshot]
    ) -> list[CommitChunk]:
        chronological = list(reversed(commits))
        chunks: list[CommitChunk] = []
        for index, commit in enumerate(chronological):
            chunk_type = "initial-full" if index == 0 else "diff-only"
            body_lines = [commit.message.strip(), ""]
            for file in commit.files:
                patch = file.patch or f"[{file.status}]"
                body_lines.append(f"File: {file.filename}")
                if chunk_type == "initial-full" or patch:
                    body_lines.append(patch)
                body_lines.append("")
            content = "\n".join(body_lines).strip()
            chunks.append(
                CommitChunk(
                    repo_full_name=full_name,
                    commit_sha=commit.sha,
                    chunk_type=chunk_type,
                    content=content,
                    authored_at=commit.authored_date,
                )
            )
        return chunks

    def _to_summary(self, repo: RepositoryMetadata) -> RoadmapRepoSummary:
        return RoadmapRepoSummary(
            full_name=repo.full_name,
            description=repo.description,
            language=repo.language,
            stars=repo.stars,
            default_branch=repo.default_branch,
            html_url=repo.html_url,
            owner_avatar_url=repo.owner_avatar_url,
        )

    def _build_metadata(
        self, repo: RepositoryMetadata, timeline: Sequence[TimelineStage]
    ) -> GeneratedRoadmapMetadata:
        difficulty = self._derive_difficulty(repo, timeline)
        return GeneratedRoadmapMetadata(
            primary_language=repo.language,
            languages=repo.languages,
            topics=repo.topics,
            difficulty=difficulty,
            star_count=repo.stars,
            fork_count=repo.forks,
            contributor_count=repo.contributor_count,
            last_pushed_at=repo.last_pushed_at,
            license=repo.license,
        )

    def _derive_difficulty(
        self, repo: RepositoryMetadata, timeline: Sequence[TimelineStage]
    ) -> str:
        contributor_score = repo.contributor_count or 0
        star_score = repo.stars
        fork_score = repo.forks
        stage_score = len(timeline)
        composite = (
            star_score + fork_score * 2 + contributor_score * 10 + stage_score * 25
        )
        if composite < 500:
            return "intro"
        if composite < 2000:
            return "easy"
        if composite < 5000:
            return "medium"
        return "hard"

    def _normalize_catalog_query(self, query: CatalogQuery) -> CatalogQuery:
        page = max(1, query.page)
        page_size = max(1, min(50, query.page_size or 12))
        languages = [value for value in (query.languages or []) if value]
        topics = [value for value in (query.topics or []) if value]
        sort = query.sort or "trending"
        return CatalogQuery(
            page=page,
            page_size=page_size,
            languages=languages,
            topics=topics,
            difficulty=query.difficulty,
            min_rating=query.min_rating,
            min_views=query.min_views,
            min_syncs=query.min_syncs,
            sort=sort,
            search=query.search,
        )

    def _to_user_payload(
        self, state, record: PublicRoadmapRecord
    ) -> UserRepoStatePayload:
        return UserRepoStatePayload(
            repo=record,
            status=state.status,
            progress_percent=state.progress_percent,
            is_archived=state.is_archived,
            synced_at=state.synced_at,
            last_viewed_at=state.last_viewed_at,
            created_at=state.created_at,
            updated_at=state.updated_at,
        )

    def _get_public_record_or_404(self, repo_full_name: str) -> PublicRoadmapRecord:
        record = self._result_store.get_public_record(repo_full_name)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timeline has not been generated for this repository.",
            )
        return record


def build_roadmap_service(
    session, cache: RedisJSONCache | None = redis_cache
) -> RoadmapService:
    try:
        generator = GeminiRoadmapGenerator(
            settings.gemini_api_key or "", settings.gemini_model
        )
    except GeminiConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    result_store = RoadmapResultStore(session)
    user_repo_store = UserRepoStateStore(session, result_store)
    rating_store = RoadmapRatingStore(session, result_store)
    return RoadmapService(
        chunk_store=CommitChunkStore(session),
        generator=generator,
        token_store=GitHubTokenStore(session),
        cache=cache,
        result_store=result_store,
        user_repo_store=user_repo_store,
        rating_store=rating_store,
    )
