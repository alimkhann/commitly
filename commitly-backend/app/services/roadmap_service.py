from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Sequence

from fastapi import HTTPException, status

from app.core.cache import RedisJSONCache, redis_cache
from app.core.config import settings
from app.models.roadmap import (
    RoadmapCatalogPage,
    RoadmapRepoSummary,
    RoadmapResponse,
    UserRepoStateResponse,
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
from app.services.roadmap_repository import RoadmapResultStore, UserSyncedRepoStore


class RoadmapService:
    def __init__(
        self,
        chunk_store: CommitChunkStore,
        result_store: RoadmapResultStore,
        pin_store: UserSyncedRepoStore,
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
        self._pin_store = pin_store

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
                if actor_id:
                    self._pin_store.pin(actor_id, identity.full_name)
                return RoadmapResponse.model_validate(cached)
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

        # Classify difficulty using AI
        try:
            difficulty = await self._generator.classify_difficulty(repo, chunks)
        except Exception:
            # If difficulty classification fails, default to medium
            difficulty = "medium"

        response = RoadmapResponse(
            repo=self._to_summary(repo, difficulty),
            timeline=timeline,
            cached=False,
            generated_at=datetime.now(timezone.utc),
        )
        if self._cache:
            await self._cache.set(
                cache_key, response.model_dump(mode="json"), self._cache_ttl
            )
        self._result_store.upsert(response)
        self._pin_store.pin(actor_id, repo.full_name)
        return response

    async def get_cached(self, repo_full_name: str) -> RoadmapResponse:
        result = self._result_store.get(repo_full_name)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timeline has not been generated for this repository.",
            )
        return result

    async def list_synced(self) -> list[RoadmapResponse]:
        return self._result_store.list()

    async def list_catalog(self, page: int, page_size: int) -> RoadmapCatalogPage:
        items, total = self._result_store.list_paginated(page, page_size)
        total_pages = max(1, math.ceil(total / page_size)) if total else 1
        return RoadmapCatalogPage(
            items=items,
            page=page,
            page_size=page_size,
            total_count=total,
            total_pages=total_pages,
        )

    async def list_user_pins(self, user_id: str) -> list[RoadmapResponse]:
        return self._pin_store.list(user_id)

    async def list_user_repos(self, user_id: str) -> list[UserRepoStateResponse]:
        return self._pin_store.list_states(user_id)

    async def sync_repo(
        self, owner: str, repo: str, user_id: str
    ) -> UserRepoStateResponse:
        full_name = f"{owner}/{repo}"
        roadmap = self._result_store.get(full_name)
        if roadmap is None:
            await self.generate(
                repo_url=f"https://github.com/{full_name}",
                force_refresh=False,
                actor_id=user_id,
            )
            roadmap = self._result_store.get(full_name)
        if roadmap is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roadmap could not be generated for this repository.",
            )
        was_synced = any(
            state.repo_full_name == full_name
            for state in self._pin_store.list_states(user_id)
        )

        _ = self._pin_store.upsert_state(
            user_id,
            full_name,
            status="synced",
            is_archived=False,
            progress_percent=0,
        )
        record_after = self._result_store.get(full_name)
        if not was_synced:
            self._result_store.increment_sync_count(full_name)
            record_after = self._result_store.get(full_name)
        return UserRepoStateResponse(
            repo_full_name=full_name,
            status="synced",
            is_archived=False,
            progress_percent=0,
            pinned_at=datetime.now(timezone.utc),
            repo=(record_after.repo if record_after else roadmap.repo),
        )

    async def desync_repo(self, owner: str, repo: str, user_id: str) -> None:
        full_name = f"{owner}/{repo}"
        states = self._pin_store.list_states(user_id)
        had_state = any(state.repo_full_name == full_name for state in states)
        self._pin_store.unpin(user_id, full_name)
        if had_state:
            self._result_store.decrement_sync_count(full_name)

    async def unpin_repo(self, user_id: str, repo_full_name: str) -> None:
        self._pin_store.unpin(user_id, repo_full_name)

    async def archive_repo(
        self, owner: str, repo: str, user_id: str
    ) -> UserRepoStateResponse:
        """Archive a repository for a user."""
        full_name = f"{owner}/{repo}"
        states = self._pin_store.list_states(user_id)
        existing_state = next(
            (state for state in states if state.repo_full_name == full_name), None
        )
        if not existing_state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository is not synced for this user.",
            )
        self._pin_store.archive(user_id, full_name)
        updated_states = self._pin_store.list_states(user_id)
        updated_state = next(
            (state for state in updated_states if state.repo_full_name == full_name),
            None,
        )
        if not updated_state:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to archive repository.",
            )
        return updated_state

    async def unarchive_repo(
        self, owner: str, repo: str, user_id: str
    ) -> UserRepoStateResponse:
        """Unarchive a repository for a user."""
        full_name = f"{owner}/{repo}"
        archived = self._pin_store.list_archived(user_id)
        existing_archived = next(
            (state for state in archived if state.repo_full_name == full_name), None
        )
        if not existing_archived:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository is not archived for this user.",
            )
        self._pin_store.unarchive(user_id, full_name)
        updated_states = self._pin_store.list_states(user_id)
        updated_state = next(
            (state for state in updated_states if state.repo_full_name == full_name),
            None,
        )
        if not updated_state:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to unarchive repository.",
            )
        return updated_state

    async def list_archived_repos(self, user_id: str) -> list[UserRepoStateResponse]:
        """List archived repositories for a user."""
        return self._pin_store.list_archived(user_id)

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

    def _to_summary(
        self, repo: RepositoryMetadata, difficulty: str = "medium"
    ) -> RoadmapRepoSummary:
        # Extract primary language and all languages
        primary_language = repo.language
        languages_list = None
        if repo.languages:
            # Sort languages by bytes (descending) and get list of language names
            sorted_languages = sorted(
                repo.languages.items(), key=lambda x: x[1], reverse=True
            )
            languages_list = [lang for lang, _ in sorted_languages]
            # If no primary language but we have languages, use the top one
            if not primary_language and languages_list:
                primary_language = languages_list[0]

        return RoadmapRepoSummary(
            full_name=repo.full_name,
            description=repo.description,
            language=repo.language,
            stars=repo.stars,
            default_branch=repo.default_branch,
            html_url=repo.html_url,
            owner_avatar_url=repo.owner_avatar_url,
            primary_language=primary_language,
            languages=languages_list,
            topics=repo.topics,
            difficulty=difficulty,
            star_count=repo.stars,
            fork_count=repo.fork_count,
            last_pushed_at=repo.last_pushed_at,
            license=repo.license,
            contributor_count=repo.contributor_count,
        )


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
    pin_store = UserSyncedRepoStore(session, result_store)
    return RoadmapService(
        chunk_store=CommitChunkStore(session),
        generator=generator,
        token_store=GitHubTokenStore(session),
        cache=cache,
        result_store=result_store,
        pin_store=pin_store,
    )
