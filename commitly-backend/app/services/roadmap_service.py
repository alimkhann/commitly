from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Sequence, cast

from app.core.cache import RedisJSONCache, redis_cache
from app.core.config import settings
from app.models.roadmap import (
    RatingResponse,
    RoadmapRepoSummary,
    RoadmapResponse,
    StageTask,
    TimelineResource,
    TimelineStage,
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
from app.services.roadmap_rating_store import RoadmapRatingStore
from app.services.roadmap_repository import (
    RoadmapResultStore,
    UserSyncedRepoStore,
)
from app.services.roadmap_view_tracker import RoadmapViewTrackerService
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

BlockingCallable = Callable[..., Any]


class RoadmapService:
    def __init__(
        self,
        chunk_store: CommitChunkStore,
        result_store: RoadmapResultStore,
        pin_store: UserSyncedRepoStore,
        generator: GeminiRoadmapGenerator,
        token_store: GitHubTokenStore,
        rating_store: RoadmapRatingStore | None = None,
        view_tracker: RoadmapViewTrackerService | None = None,
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
        self._rating_store = rating_store
        self._view_tracker = view_tracker

    def _calculate_stage_budget(self, commit_count: int) -> int:
        """
        Calculate the number of stages based on commit count.
        We want a curve that gives ~8-10 stages for small repos (40 commits)
        and scales up to ~25 stages for large repos (500+ commits).
        """
        if commit_count < 10:
            return max(3, commit_count // 2)

        # Base of 7 stages + 1 stage for every 20 commits
        budget = 7 + int(commit_count / 20)

        # Cap at 25 stages to keep the roadmap manageable
        return min(25, budget)

    async def generate(
        self,
        repo_url: str,
        force_refresh: bool = False,
        actor_id: str | None = None,
    ) -> RoadmapResponse:
        logger.info(
            f"Generating roadmap for {repo_url} \
                (force_refresh={force_refresh}, actor={actor_id})"
        )
        identity = self._parse_identity(repo_url)
        cache_key = f"roadmap:{identity.full_name.lower()}"
        if not force_refresh and self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                logger.info(f"Returning cached roadmap for {identity.full_name}")
                if actor_id:
                    await self._run_db(
                        self._pin_store.pin, actor_id, identity.full_name
                    )
                return RoadmapResponse.model_validate(cached)
        token = None
        if actor_id:
            record = await self._run_db(self._token_store.get_token, actor_id)
            if record:
                token = record.access_token
        if token is None:
            token = self._default_token
        if not token:
            logger.warning("No GitHub token available for generation")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Connect GitHub to generate a roadmap",
            )
        github_client = GitHubService(token=token)
        try:
            repo = await self._fetch_repo(github_client, identity)
        except HTTPException as exc:
            if (
                exc.status_code == status.HTTP_401_UNAUTHORIZED
                and token != self._default_token
                and self._default_token
            ):
                logger.warning(
                    f"User token invalid for {identity.full_name}, \
                    falling back to default token"
                )
                # Fallback to default token if user token is invalid
                github_client = GitHubService(token=self._default_token)
                repo = await self._fetch_repo(github_client, identity)
            else:
                logger.error(f"Failed to fetch repo {identity.full_name}: {exc.detail}")
                raise exc

        try:
            commits = await github_client.fetch_commits(
                identity, repo.default_branch, self._commit_limit
            )
        except GitHubAuthenticationError as exc:
            logger.error(
                f"GitHub auth error fetching commits for {identity.full_name}: {exc}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
            )
        except GitHubRateLimitExceeded as exc:
            logger.error(f"GitHub rate limit exceeded for {identity.full_name}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)
            )
        except GitHubServiceError as exc:
            logger.error(f"GitHub service error for {identity.full_name}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            )
        if not commits:
            logger.warning(f"No commits found for {identity.full_name}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Repository does not contain commits",
            )

        logger.info(f"Fetched {len(commits)} commits for {identity.full_name}")
        chunks = self._build_chunks(repo.full_name, commits)
        try:
            await self._run_db(self._chunk_store.persist, chunks)
        except ChunkStorageError as exc:
            logger.error(f"Failed to persist chunks for {identity.full_name}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )
        stage_budget = self._calculate_stage_budget(len(commits))
        logger.info(f"Planning {stage_budget} stages for {identity.full_name}")
        try:
            timeline = await self._generator.generate(repo, chunks, stage_budget)
        except GeminiGenerationError as exc:
            logger.error(f"Gemini generation failed for {identity.full_name}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            )

        # Prepend Setup Stage and re-index
        setup_stage = self._build_setup_stage(repo)
        timeline.insert(0, setup_stage)
        for i, stage in enumerate(timeline):
            stage.index = i + 1

        # Classify difficulty using AI
        try:
            difficulty = await self._generator.classify_difficulty(repo, chunks)
        except Exception as e:
            logger.warning(
                f"Difficulty classification failed for {identity.full_name}: {e}"
            )
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
        await self._run_db(self._result_store.upsert, response)
        await self._run_db(self._pin_store.pin, actor_id, repo.full_name)
        logger.info(f"Successfully generated roadmap for {identity.full_name}")
        return response

    async def generate_stream(
        self,
        repo_url: str,
        force_refresh: bool = False,
        actor_id: str | None = None,
    ):
        """
        Generates a roadmap while yielding progress updates.
        Yields JSON strings: {"type": "progress"|"result"|"error", ...}
        """
        logger.info(
            f"Starting stream generation for {repo_url} \
                  (force_refresh={force_refresh}, actor={actor_id})"
        )
        identity = self._parse_identity(repo_url)
        cache_key = f"roadmap:{identity.full_name.lower()}"

        # Check cache first
        if not force_refresh and self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                logger.info(
                    f"Cache hit for {identity.full_name}, returning cached result"
                )
                if actor_id:
                    await self._run_db(
                        self._pin_store.pin, actor_id, identity.full_name
                    )
                yield json.dumps({"type": "result", "data": cached})
                return

        token = None
        if actor_id:
            record = await self._run_db(self._token_store.get_token, actor_id)
            if record:
                token = record.access_token
        if token is None:
            token = self._default_token

        if not token:
            logger.warning("No GitHub token available for stream generation")
            yield json.dumps(
                {"type": "error", "message": "Connect GitHub to generate a roadmap"}
            )
            return

        yield json.dumps({"type": "progress", "message": "Connecting to GitHub..."})

        github_client = GitHubService(token=token)
        try:
            repo = await self._fetch_repo(github_client, identity)
        except Exception as exc:
            # Try fallback token logic if needed, simplified here
            if token != self._default_token and self._default_token:
                logger.warning(
                    f"User token invalid for {identity.full_name}, \
                        falling back to default token"
                )
                github_client = GitHubService(token=self._default_token)
                try:
                    repo = await self._fetch_repo(github_client, identity)
                except Exception as e:
                    logger.error(
                        f"Failed to fetch repo {identity.full_name} \
                              with default token: {e}"
                    )
                    yield json.dumps({"type": "error", "message": str(e)})
                    return
            else:
                logger.error(f"Failed to fetch repo {identity.full_name}: {exc}")
                yield json.dumps({"type": "error", "message": str(exc)})
                return

        yield json.dumps(
            {
                "type": "progress",
                "message": f"Fetching commit history for {repo.full_name}...",
            }
        )

        try:
            commits = await github_client.fetch_commits(
                identity, repo.default_branch, self._commit_limit
            )
        except Exception as exc:
            logger.error(f"Failed to fetch commits for {identity.full_name}: {exc}")
            yield json.dumps({"type": "error", "message": str(exc)})
            return

        if not commits:
            logger.warning(f"No commits found for {identity.full_name}")
            yield json.dumps(
                {"type": "error", "message": "Repository does not contain commits"}
            )
            return

        logger.info(f"Fetched {len(commits)} commits for {identity.full_name}")
        chunks = self._build_chunks(repo.full_name, commits)
        try:
            await self._run_db(self._chunk_store.persist, chunks)
        except ChunkStorageError as exc:
            logger.error(f"Failed to persist chunks for {identity.full_name}: {exc}")
            yield json.dumps({"type": "error", "message": str(exc)})
            return

        stage_budget = self._calculate_stage_budget(len(commits))
        logger.info(f"Planning {stage_budget} stages for {identity.full_name}")

        # Queue for bridging callback to generator
        queue = asyncio.Queue()

        async def progress_callback(msg: str):
            logger.debug(f"Progress update for {identity.full_name}: {msg}")
            await queue.put({"type": "progress", "message": msg})

        async def run_generation():
            try:
                timeline = await self._generator.generate(
                    repo, chunks, stage_budget, progress_callback=progress_callback
                )

                # Post-processing
                setup_stage = self._build_setup_stage(repo)
                timeline.insert(0, setup_stage)
                for i, stage in enumerate(timeline):
                    stage.index = i + 1

                # Difficulty
                await queue.put(
                    {"type": "progress", "message": "Classifying difficulty..."}
                )
                try:
                    difficulty = await self._generator.classify_difficulty(repo, chunks)
                except Exception as e:
                    logger.warning(
                        f"Difficulty classification failed \
                            for {identity.full_name}: {e}"
                    )
                    difficulty = "medium"

                response = RoadmapResponse(
                    repo=self._to_summary(repo, difficulty),
                    timeline=timeline,
                    cached=False,
                    generated_at=datetime.now(timezone.utc),
                )

                # Cache and Store
                if self._cache:
                    await self._cache.set(
                        cache_key, response.model_dump(mode="json"), self._cache_ttl
                    )
                await self._run_db(self._result_store.upsert, response)
                if actor_id:
                    await self._run_db(self._pin_store.pin, actor_id, repo.full_name)

                logger.info(f"Stream generation completed for {identity.full_name}")
                await queue.put(
                    {"type": "result", "data": response.model_dump(mode="json")}
                )
            except Exception as e:
                logger.error(f"Stream generation failed for {identity.full_name}: {e}")
                await queue.put({"type": "error", "message": str(e)})
            finally:
                await queue.put(None)

        # Start generation task
        task = asyncio.create_task(run_generation())

        # Yield events
        while True:
            item = await queue.get()
            if item is None:
                break
            yield json.dumps(item)

        # Ensure task is done (should be if None was put)
        await task

    async def get_cached(self, repo_full_name: str) -> RoadmapResponse:
        result = await self._run_db(self._result_store.get, repo_full_name)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timeline has not been generated for this repository.",
            )
        return result

    async def list_synced(self) -> list[RoadmapResponse]:
        return await self._run_db(self._result_store.list)

    async def list_catalog(
        self,
        page: int = 1,
        page_size: int = 20,
        language: str | None = None,
        tag: str | None = None,
        difficulty: str | None = None,
        min_rating: float | None = None,
        min_views: int | None = None,
        min_syncs: int | None = None,
        sort: str = "newest",
    ) -> tuple[list[RoadmapResponse], int]:
        """List catalog with filters and pagination."""
        return await self._run_db(
            self._result_store.list_catalog,
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

    async def record_roadmap_view(
        self, repo_full_name: str, user_id: str | None
    ) -> None:
        """
        Record a roadmap view and increment the view counter if eligible.

        Uses anti-spam logic via RoadmapViewTrackerService to ensure
        each user can only increment the view count once per 24-hour window.

        Args:
            repo_full_name: Full repository name (owner/repo)
            user_id: User identifier (optional for anonymous users)
        """
        view_tracker = self._view_tracker
        if not view_tracker:
            # View tracking disabled
            return

        should_count = await self._run_db(
            view_tracker.increment_view_if_eligible,
            repo_full_name,
            user_id,
        )
        if should_count:
            await self._run_db(self._result_store.increment_view_count, repo_full_name)

    async def list_user_pins(self, user_id: str) -> list[RoadmapResponse]:
        return await self._run_db(self._pin_store.list, user_id)

    async def list_user_repos(self, user_id: str) -> list[UserRepoStateResponse]:
        return await self._run_db(self._pin_store.list_states, user_id)

    async def sync_repo(
        self, owner: str, repo: str, user_id: str
    ) -> UserRepoStateResponse:
        full_name = f"{owner}/{repo}"

        roadmap = await self._run_db(self._result_store.get, full_name)

        if roadmap is None:
            await self.generate(
                repo_url=f"https://github.com/{full_name}",
                force_refresh=False,
                actor_id=user_id,
            )
            roadmap = await self._run_db(self._result_store.get, full_name)

        if roadmap is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roadmap could not be generated for this repository.",
            )

        def check_and_upsert() -> tuple[bool, RoadmapResponse | None]:
            states = self._pin_store.list_states(user_id)
            was_synced = any(state.repo_full_name == full_name for state in states)

            self._pin_store.upsert_state(
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

            return was_synced, record_after

        was_synced, record_after = await self._run_db(check_and_upsert)

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

        def desync():
            states = self._pin_store.list_states(user_id)
            had_state = any(state.repo_full_name == full_name for state in states)
            self._pin_store.unpin(user_id, full_name)
            if had_state:
                self._result_store.decrement_sync_count(full_name)

        await self._run_db(desync)

    async def unpin_repo(self, user_id: str, repo_full_name: str) -> None:
        await self._run_db(self._pin_store.unpin, user_id, repo_full_name)

    async def archive_repo(
        self, owner: str, repo: str, user_id: str
    ) -> UserRepoStateResponse:
        """Archive a repository for a user."""
        full_name = f"{owner}/{repo}"

        def archive():
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
                (
                    state
                    for state in updated_states
                    if state.repo_full_name == full_name
                ),
                None,
            )
            if not updated_state:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to archive repository.",
                )
            return updated_state

        return await self._run_db(archive)

    async def unarchive_repo(
        self, owner: str, repo: str, user_id: str
    ) -> UserRepoStateResponse:
        """Unarchive a repository for a user."""
        full_name = f"{owner}/{repo}"

        def unarchive():
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
                (
                    state
                    for state in updated_states
                    if state.repo_full_name == full_name
                ),
                None,
            )
            if not updated_state:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to unarchive repository.",
                )
            return updated_state

        return await self._run_db(unarchive)

    async def list_archived_repos(self, user_id: str) -> list[UserRepoStateResponse]:
        """List archived repositories for a user."""
        return await self._run_db(self._pin_store.list_archived, user_id)

    async def set_rating(
        self, user_id: str, owner: str, repo: str, rating: int
    ) -> RatingResponse:
        """Set or update a user's rating for a repository."""
        if not self._rating_store:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rating service is not available",
            )
        full_name = f"{owner}/{repo}"
        rating_store = self._rating_store

        def upsert():
            assert rating_store is not None
            record = rating_store.upsert_rating(user_id, full_name, rating)
            return RatingResponse(
                rating=record.rating,
                repo_full_name=record.repo_full_name,
                user_id=record.user_id,
                created_at=record.created_at,
                updated_at=record.updated_at,
            )

        return await self._run_db(upsert)

    async def get_user_rating(
        self, user_id: str, owner: str, repo: str
    ) -> RatingResponse | None:
        """Get a user's rating for a repository."""
        if not self._rating_store:
            return None
        full_name = f"{owner}/{repo}"
        rating_store = self._rating_store

        def get_rating():
            assert rating_store is not None
            record = rating_store.get_user_rating(user_id, full_name)
            if not record:
                return None
            return RatingResponse(
                rating=record.rating,
                repo_full_name=record.repo_full_name,
                user_id=record.user_id,
                created_at=record.created_at,
                updated_at=record.updated_at,
            )

        return await self._run_db(get_rating)

    async def _run_db(self, func: BlockingCallable, *args, **kwargs):
        """Execute a blocking database operation in a worker thread."""

        return await asyncio.to_thread(func, *args, **kwargs)

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
            html_url=cast(Any, repo.html_url),
            owner_avatar_url=cast(Any, repo.owner_avatar_url),
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

    def _build_setup_stage(self, repo: RepositoryMetadata) -> TimelineStage:
        tasks = [
            StageTask(
                label="Clone Repository",
                steps=[
                    f"git clone https://github.com/{repo.full_name}.git",
                    f"cd {repo.full_name.split('/')[-1]}",
                ],
                commands=[f"git clone https://github.com/{repo.full_name}.git"],
            )
        ]

        # Heuristic for setup based on language
        lang = (repo.language or "").lower()
        if lang in ["python"]:
            tasks.append(
                StageTask(
                    label="Install Dependencies",
                    steps=["Create a virtual environment", "Install requirements"],
                    commands=[
                        "python -m venv venv",
                        "source venv/bin/activate",
                        "pip install -r requirements.txt",
                    ],
                )
            )
        elif lang in ["javascript", "typescript"]:
            tasks.append(
                StageTask(
                    label="Install Dependencies",
                    steps=["Install NPM packages"],
                    commands=["npm install"],
                )
            )
        elif lang in ["go"]:
            tasks.append(
                StageTask(
                    label="Install Dependencies",
                    steps=["Download Go modules"],
                    commands=["go mod download"],
                )
            )
        elif lang in ["rust"]:
            tasks.append(
                StageTask(
                    label="Build Project",
                    steps=["Build with Cargo"],
                    commands=["cargo build"],
                )
            )

        return TimelineStage(
            id="stage-setup",
            index=0,
            title="Project Setup & Tour",
            summary=(
                f"Get {repo.full_name} running locally and explore the "
                "project structure."
            ),
            status="not-started",
            eta="15m",
            category="setup",
            difficulty="intro",
            goals=["Clone the repository", "Install dependencies", "Verify the build"],
            tasks=tasks,
            resources=[
                TimelineResource(label="Repository", href=str(repo.html_url)),
            ],
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
    rating_store = RoadmapRatingStore(session, result_store)
    view_tracker = RoadmapViewTrackerService(session)
    return RoadmapService(
        chunk_store=CommitChunkStore(session),
        generator=generator,
        token_store=GitHubTokenStore(session),
        cache=cache,
        result_store=result_store,
        pin_store=pin_store,
        rating_store=rating_store,
        view_tracker=view_tracker,
    )
