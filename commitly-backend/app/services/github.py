from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
import re
from typing import List, Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings


class GitHubServiceError(Exception):
    """Base class for GitHub integration errors."""


class GitHubNotFound(GitHubServiceError):
    """Raised when a repository cannot be located."""


class GitHubRateLimitExceeded(GitHubServiceError):
    """Raised when the REST API rate limit has been exhausted."""


class GitHubAuthenticationError(GitHubServiceError):
    """Raised when GitHub rejects our credentials."""


@dataclass(slots=True)
class RepositoryIdentity:
    owner: str
    name: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.name}"


@dataclass(slots=True)
class RepositoryMetadata:
    id: int
    name: str
    full_name: str
    description: Optional[str]
    default_branch: str
    stars: int
    language: Optional[str]
    html_url: Optional[str]
    owner_avatar_url: Optional[str]
    languages: Optional[dict[str, int]] = None  # language -> bytes mapping
    topics: Optional[List[str]] = None
    fork_count: int = 0
    last_pushed_at: Optional[datetime] = None
    license: Optional[str] = None
    contributor_count: int = 0


@dataclass(slots=True)
class CommitFileDiff:
    filename: str
    status: str
    patch: Optional[str]


@dataclass(slots=True)
class CommitSnapshot:
    sha: str
    message: str
    html_url: str
    authored_date: Optional[datetime]
    files: List[CommitFileDiff]


class GitHubService:
    def __init__(
        self,
        token: Optional[str] = None,
        base_url: str = str(settings.github_api_base),
        timeout: float = 10.0,
    ) -> None:
        self._token = token
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            self._headers["Authorization"] = f"Bearer {token}"

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.request(
                method, url, headers=self._headers, **kwargs
            )
        if response.status_code == 404:
            raise GitHubNotFound("Repository not found")
        if (
            response.status_code == 403
            and response.headers.get("X-RateLimit-Remaining") == "0"
        ):
            raise GitHubRateLimitExceeded("GitHub rate limit exceeded")
        if response.status_code == 401:
            raise GitHubAuthenticationError(
                "GitHub rejected the access token. "
                "Please reconnect your GitHub account."
            )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise GitHubServiceError(
                f"GitHub API request failed ({response.status_code})"
            ) from exc
        return response

    async def fetch_repository(
        self, identity: RepositoryIdentity
    ) -> RepositoryMetadata:
        response = await self._request("GET", f"/repos/{identity.full_name}")
        payload = response.json()
        owner = payload.get("owner") or {}

        # Parse last_pushed_at
        last_pushed_at = None
        if payload.get("pushed_at"):
            try:
                last_pushed_at = datetime.fromisoformat(
                    payload["pushed_at"].replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                pass

        # Parse license
        license_name = None
        if payload.get("license") and isinstance(payload["license"], dict):
            license_name = payload["license"].get("name")

        # Fetch additional metadata in parallel
        languages_task = self._fetch_languages(identity)
        topics_task = self._fetch_topics(identity)
        contributor_count_task = self._fetch_contributor_count(identity)

        languages, topics, contributor_count = await asyncio.gather(
            languages_task, topics_task, contributor_count_task, return_exceptions=True
        )

        # Handle exceptions gracefully
        if isinstance(languages, Exception):
            languages = None
        if isinstance(topics, Exception):
            topics = None
        if isinstance(contributor_count, Exception):
            contributor_count = 0

        return RepositoryMetadata(
            id=payload["id"],
            name=payload["name"],
            full_name=payload["full_name"],
            description=payload.get("description"),
            default_branch=payload.get("default_branch", "main"),
            stars=payload.get("stargazers_count", 0),
            language=payload.get("language"),
            html_url=payload.get("html_url"),
            owner_avatar_url=owner.get("avatar_url"),
            languages=languages,
            topics=topics,
            fork_count=payload.get("forks_count", 0),
            last_pushed_at=last_pushed_at,
            license=license_name,
            contributor_count=contributor_count or 0,
        )

    async def _fetch_languages(
        self, identity: RepositoryIdentity
    ) -> Optional[dict[str, int]]:
        """Fetch repository languages from GitHub API."""
        try:
            response = await self._request(
                "GET", f"/repos/{identity.full_name}/languages"
            )
            return response.json()
        except GitHubServiceError:
            return None

    async def _fetch_topics(self, identity: RepositoryIdentity) -> Optional[List[str]]:
        """Fetch repository topics from GitHub API."""
        try:
            # Use the topics endpoint which requires special Accept header
            headers = {
                **self._headers,
                "Accept": "application/vnd.github.mercy-preview+json",
            }
            url = f"{self._base_url}/repos/{identity.full_name}/topics"
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.request("GET", url, headers=headers)
            if response.status_code == 200:
                payload = response.json()
                return payload.get("names", [])
            return None
        except Exception:
            return None

    async def _fetch_contributor_count(self, identity: RepositoryIdentity) -> int:
        """Fetch contributor count from GitHub API."""
        try:
            # Use pagination to count contributors efficiently
            # GitHub API returns contributors with pagination
            count = 0
            page = 1
            per_page = 100

            while True:
                response = await self._request(
                    "GET",
                    f"/repos/{identity.full_name}/contributors",
                    params={"page": page, "per_page": per_page, "anon": "true"},
                )
                contributors = response.json()
                if not contributors:
                    break
                count += len(contributors)
                # Check if there are more pages
                link_header = response.headers.get("Link", "")
                if 'rel="next"' not in link_header:
                    break
                page += 1
                # Limit to reasonable number to avoid excessive API calls
                if page > 10:  # Max 1000 contributors
                    break
            return count
        except GitHubServiceError:
            return 0

    async def fetch_commits(
        self,
        identity: RepositoryIdentity,
        branch: str,
        limit: int,
    ) -> List[CommitSnapshot]:
        response = await self._request(
            "GET",
            f"/repos/{identity.full_name}/commits",
            params={"sha": branch, "per_page": max(1, min(100, limit))},
        )
        commits = response.json()
        snapshots: List[CommitSnapshot] = []
        for entry in commits:
            sha = entry["sha"]
            detail = await self._request(
                "GET", f"/repos/{identity.full_name}/commits/{sha}"
            )
            detail_payload = detail.json()
            files_payload = detail_payload.get("files") or []
            files = [
                CommitFileDiff(
                    filename=item.get("filename", "unknown"),
                    status=item.get("status", "modified"),
                    patch=item.get("patch"),
                )
                for item in files_payload
            ]
            commit = detail_payload.get("commit", {})
            authored = commit.get("author") or {}
            authored_date = authored.get("date")
            snapshots.append(
                CommitSnapshot(
                    sha=sha,
                    message=commit.get("message", ""),
                    html_url=detail_payload.get("html_url", ""),
                    authored_date=(
                        datetime.fromisoformat(authored_date.replace("Z", "+00:00"))
                        if authored_date
                        else None
                    ),
                    files=files,
                )
            )
        return snapshots


def parse_github_url(url: str) -> RepositoryIdentity:
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"} and parsed.netloc.endswith("github.com"):
        path = parsed.path.strip("/")
        if not path:
            raise GitHubServiceError("Repository path is missing")
        parts = path.split("/")
        if len(parts) < 2:
            raise GitHubServiceError("Repository URL must include owner and name")
        name = parts[1].removesuffix(".git")
        return RepositoryIdentity(owner=parts[0], name=name)

    ssh_match = re.match(
        r"git@github\.com:(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+)(\.git)?", url
    )
    if ssh_match:
        return RepositoryIdentity(
            owner=ssh_match.group("owner"),
            name=ssh_match.group("repo").removesuffix(".git"),
        )

    raise GitHubServiceError("Only GitHub repositories are supported")
