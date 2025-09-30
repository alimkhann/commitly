from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple, Set

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, HttpUrl
import requests
from postgrest.exceptions import APIError

from app.core.config import settings
from app.services.supabase_client import get_supabase_admin_client, get_supabase_user_from_token
from app.services.timeline_builder import (
    CommitInfo,
    TimelineNodePayload,
    build_timeline_nodes,
    compute_snake_coordinates,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class ImportRepoRequest(BaseModel):
    url: HttpUrl
    github_token: Optional[str] = None
    persist: bool = True
    user_id: Optional[str] = None
    force_refresh: bool = False


class TimelineNode(BaseModel):
    id: str
    commit_sha: str
    title: Optional[str]
    summary: Optional[str]
    author: Optional[str]
    committed_at: Optional[str]
    position_index: int
    x: int
    y: int
    files_changed: Optional[int] = 0
    additions: Optional[int] = 0
    deletions: Optional[int] = 0


class TimelineResponse(BaseModel):
    nodes: List[TimelineNode]


class DiffResponse(BaseModel):
    commit_sha: str
    patch_summary: Optional[str] = None
    patch_full: Optional[str] = None


class ImportRepoResponse(BaseModel):
    repo_id: str
    timeline_id: str
    nodes: Optional[List[TimelineNode]] = None


# NOTE: Supabase service-role access is used server-side.


class RepoListItem(BaseModel):
    id: str
    owner: str
    name: str
    slug: str
    url: Optional[str] = None
    timeline_id: Optional[str] = None

def _github_headers(token: Optional[str]) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Commitly-App"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_repo_url(url: str) -> tuple[str, str]:
    try:
        parts = url.strip().rstrip('/').split('/')
        owner = parts[-2]
        name = parts[-1].removesuffix('.git')
        return owner, name
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL") from exc


def _resolve_repo(sb, repo_id_or_slug: str) -> Optional[str]:
    """Resolve repo UUID from uuid string or owner/name."""
    if not sb:
        return None
    if len(repo_id_or_slug) == 36 and repo_id_or_slug.count('-') == 4:
        return repo_id_or_slug
    try:
        owner, name = repo_id_or_slug.split('/')
    except ValueError:
        return None
    existing = sb.table("repos").select("id").eq("owner", owner).eq("name", name).limit(1).execute()
    if existing.data:
        return existing.data[0]["id"]
    return None


def _build_commit_infos(owner: str, name: str, commits: List[Dict[str, Any]], token: Optional[str]) -> List[CommitInfo]:
    results: List[CommitInfo] = []
    for commit in commits:
        sha = commit.get("sha")
        if not sha:
            continue
        commit_detail = requests.get(
            f"https://api.github.com/repos/{owner}/{name}/commits/{sha}",
            headers=_github_headers(token),
        )
        if commit_detail.status_code >= 400:
            logger.debug("Skip commit %s due to status %s", sha, commit_detail.status_code)
            continue
        detail_json = commit_detail.json()
        files = detail_json.get("files", [])
        files_changed = len(files)
        additions = sum(f.get("additions", 0) for f in files)
        deletions = sum(f.get("deletions", 0) for f in files)
        message = (detail_json.get("commit", {}).get("message") or "").strip()
        author = detail_json.get("commit", {}).get("author", {}).get("name")
        committed_at = detail_json.get("commit", {}).get("author", {}).get("date")

        results.append(
            CommitInfo(
                sha=sha,
                message=message,
                author=author,
                committed_at=committed_at,
                files_changed=files_changed,
                additions=additions,
                deletions=deletions,
            )
        )
    return results


def _persist_timeline(
    sb,
    owner: str,
    name: str,
    repo_url: str,
    default_branch: str,
    is_private: bool,
    nodes: List[TimelineNodePayload],
    user_id: Optional[str],
    strategy: str,
) -> Tuple[str, str]:
    created_by = user_id or str(settings.public_user_id)

    repo_ins = sb.table("repos").upsert({
        "owner": owner,
        "name": name,
        "url": repo_url,
        "default_branch": default_branch,
        "is_private": is_private,
        "created_by": created_by,
    }, on_conflict="owner,name").execute()
    repo_id = repo_ins.data[0]["id"]

    if user_id:
        try:
            sb.table("repo_access").upsert({
                "user_id": user_id,
                "repo_id": repo_id,
                "role": "owner",
            }).execute()
        except Exception as exc:  # pragma: no cover
            logger.debug("repo_access upsert failed: %s", exc)

    tl_ins = sb.table("timelines").insert({
        "repo_id": repo_id,
        "created_by": created_by,
        "strategy": strategy,
    }).execute()
    timeline_id = tl_ins.data[0]["id"]

    coords = compute_snake_coordinates(len(nodes))
    batch_rows: List[Dict[str, Any]] = []
    for idx, node in enumerate(nodes):
        x, y = coords[idx] if idx < len(coords) else (idx * 140, 0)
        batch_rows.append({
            "timeline_id": timeline_id,
            "commit_sha": node.commit_sha,
            "title": node.title,
            "summary": node.summary,
            "author": node.author,
            "committed_at": node.committed_at,
            "position_index": idx,
            "x": x,
            "y": y,
            "meta": {
                "related_shas": node.related_shas,
                "files_changed": node.files_changed,
                "additions": node.additions,
                "deletions": node.deletions,
            },
        })

    batch_size = 100
    for i in range(0, len(batch_rows), batch_size):
        sb.table("timeline_nodes").insert(batch_rows[i:i + batch_size]).execute()

    diff_rows = [{
        "commit_sha": node.commit_sha,
        "files_changed": node.files_changed,
        "additions": node.additions,
        "deletions": node.deletions,
        "patch_summary": node.summary,
    } for node in nodes]

    for i in range(0, len(diff_rows), batch_size):
        sb.table("commit_diffs").upsert(diff_rows[i:i + batch_size], on_conflict="commit_sha").execute()

    return str(repo_id), str(timeline_id)


@router.post("/import", response_model=ImportRepoResponse)
def import_repo(payload: ImportRepoRequest, request: Request) -> ImportRepoResponse:
    owner, name = _parse_repo_url(str(payload.url))
    sb = get_supabase_admin_client()
    strategy = "ai_v1"

    token = request.headers.get("authorization")
    if token and token.lower().startswith("bearer "):
        auth_user = get_supabase_user_from_token(token.split(" ", 1)[1])
        if auth_user:
            payload.user_id = payload.user_id or auth_user.id

    should_persist = bool(sb and settings.supabase_service_role_key)
    logger.info("import_repo start owner=%s name=%s should_persist=%s", owner, name, should_persist)

    # Cache check unless caller forces refresh
    if sb and not payload.force_refresh:
        repo_sel = sb.table("repos").select("id").eq("owner", owner).eq("name", name).limit(1).execute()
        if repo_sel.data:
            repo_id = repo_sel.data[0]["id"]
            tl_sel = sb.table("timelines").select("id").eq("repo_id", repo_id).eq("strategy", strategy).limit(1).execute()
            if tl_sel.data:
                logger.info("cache hit repo_id=%s timeline_id=%s", repo_id, tl_sel.data[0]["id"])
                timeline_id = tl_sel.data[0]["id"]
                return ImportRepoResponse(repo_id=str(repo_id), timeline_id=str(timeline_id))

    # Fetch repo info
    effective_token = payload.github_token or settings.github_default_token

    repo_resp = requests.get(
        f"https://api.github.com/repos/{owner}/{name}", headers=_github_headers(effective_token)
    )
    if repo_resp.status_code >= 400:
        detail = repo_resp.json() if repo_resp.headers.get('content-type', '').startswith('application/json') else repo_resp.text
        logger.warning("GitHub repo lookup failed status=%s detail=%s", repo_resp.status_code, detail)
        if repo_resp.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found or inaccessible")
        if repo_resp.status_code == 403:
            raise HTTPException(status_code=403, detail="GitHub denied access. Provide a personal access token or check repo visibility.")
        raise HTTPException(status_code=repo_resp.status_code, detail="GitHub API error while reading repository metadata")
    repo_json = repo_resp.json()
    default_branch = repo_json.get("default_branch", "main")
    is_private = bool(repo_json.get("private", False))

    # Collect commits (first 200 for MVP)
    commits_resp = requests.get(
        f"https://api.github.com/repos/{owner}/{name}/commits",
        params={"sha": default_branch, "per_page": 100},
        headers=_github_headers(effective_token),
    )
    if commits_resp.status_code >= 400:
        detail = commits_resp.json() if commits_resp.headers.get('content-type', '').startswith('application/json') else commits_resp.text
        logger.warning("GitHub commits fetch failed status=%s detail=%s", commits_resp.status_code, detail)
        if commits_resp.status_code == 403:
            raise HTTPException(status_code=403, detail="GitHub rate limited or denied access. Provide a token or wait before retrying.")
        raise HTTPException(status_code=commits_resp.status_code, detail="Failed to list commits")
    commits = commits_resp.json()

    commit_infos = _build_commit_infos(owner, name, commits, effective_token)
    nodes_payload = build_timeline_nodes(commit_infos)

    if not nodes_payload:
        logger.error("Timeline builder returned no nodes for owner=%s name=%s", owner, name)
        raise HTTPException(status_code=500, detail="Timeline generation failed")

    if not should_persist or not sb:
        synthetic_id = f"{owner}/{name}:{default_branch}:{strategy}"
        logger.info("returning synthetic timeline for owner=%s name=%s id=%s", owner, name, synthetic_id)
        coords = compute_snake_coordinates(len(nodes_payload))
        preview_nodes = [
            TimelineNode(
                id=node.commit_sha,
                commit_sha=node.commit_sha,
                title=node.title,
                summary=node.summary,
                author=node.author,
                committed_at=node.committed_at,
                position_index=idx,
                x=coords[idx][0],
                y=coords[idx][1],
                files_changed=node.files_changed,
                additions=node.additions,
                deletions=node.deletions,
            )
            for idx, node in enumerate(nodes_payload)
        ]
        return ImportRepoResponse(repo_id=f"{owner}/{name}", timeline_id=synthetic_id, nodes=preview_nodes)

    try:
        repo_id, timeline_id = _persist_timeline(
            sb=sb,
            owner=owner,
            name=name,
            repo_url=str(payload.url),
            default_branch=default_branch,
            is_private=is_private,
            nodes=nodes_payload,
            user_id=payload.user_id,
            strategy=strategy,
        )
        logger.info("persisted timeline repo_id=%s timeline_id=%s", repo_id, timeline_id)
        return ImportRepoResponse(repo_id=repo_id, timeline_id=timeline_id)
    except APIError as exc:
        logger.warning("Supabase persistence failed, returning synthetic timeline: %s", exc)
        synthetic_id = f"{owner}/{name}:{default_branch}:{strategy}"
        coords = compute_snake_coordinates(len(nodes_payload))
        preview_nodes = [
            TimelineNode(
                id=node.commit_sha,
                commit_sha=node.commit_sha,
                title=node.title,
                summary=node.summary,
                author=node.author,
                committed_at=node.committed_at,
                position_index=idx,
                x=coords[idx][0],
                y=coords[idx][1],
                files_changed=node.files_changed,
                additions=node.additions,
                deletions=node.deletions,
            )
            for idx, node in enumerate(nodes_payload)
        ]
        return ImportRepoResponse(repo_id=f"{owner}/{name}", timeline_id=synthetic_id, nodes=preview_nodes)


@router.get("", response_model=List[RepoListItem])
def list_repos(request: Request, scope: str = Query('mine'), limit: int = Query(20, ge=1, le=100)) -> List[RepoListItem]:
    sb = get_supabase_admin_client()
    if not sb:
        return []

    token = request.headers.get("authorization")
    user = None
    if token and token.lower().startswith("bearer "):
        user = get_supabase_user_from_token(token.split(" ", 1)[1])

    repos: List[Dict[str, Any]] = []
    repo_ids: Set[str] = set()

    if scope == 'mine' and user is None:
        return []

    if scope == 'mine':
        if user is None:
            return []
        try:
            owned = sb.table("repos").select("id, owner, name, url").eq("created_by", user.id).limit(limit).execute()
            for row in owned.data:
                repo_ids.add(row["id"])
                repos.append(row)

            access = sb.table("repo_access").select("repo_id").eq("user_id", user.id).execute()
            for row in access.data:
                rid = row["repo_id"]
                if rid in repo_ids:
                    continue
                repo_row = sb.table("repos").select("id, owner, name, url").eq("id", rid).limit(1).execute()
                if repo_row.data:
                    repo_ids.add(rid)
                    repos.append(repo_row.data[0])
        except APIError as exc:  # pragma: no cover - RLS fallback
            logger.warning("Failed to list personal repos: %s", exc)

    else:
        # For public or cached scopes we currently hide the list to avoid RLS recursion.
        return []

    items: List[RepoListItem] = []
    seen: Set[str] = set()
    for repo in repos:
        repo_id = repo["id"]
        if repo_id in seen:
            continue
        seen.add(repo_id)
        timeline = sb.table("timelines").select("id").eq("repo_id", repo_id).eq("strategy", "ai_v1").order("created_at", desc=True).limit(1).execute()
        tl_id = timeline.data[0]["id"] if timeline.data else None
        items.append(RepoListItem(
            id=repo_id,
            owner=repo["owner"],
            name=repo["name"],
            url=repo.get("url"),
            slug=f"{repo['owner']}/{repo['name']}",
            timeline_id=tl_id,
        ))

    return items


@router.get("/{repo_id}/timeline", response_model=TimelineResponse)
def get_timeline(
    repo_id: str,
    limit: int = Query(200, le=500),
    strategy: str = Query("ai_v1"),
) -> TimelineResponse:
    sb = get_supabase_admin_client()
    if not sb:
        return TimelineResponse(nodes=[])
    nodes: List[TimelineNode] = []
    tl_id = None
    repo_uuid = _resolve_repo(sb, repo_id)
    if repo_uuid:
        tl_sel = sb.table("timelines").select("id").eq("repo_id", repo_uuid).eq("strategy", strategy).limit(1).execute()
        if tl_sel.data:
            tl_id = tl_sel.data[0]["id"]

    if not tl_id:
        return TimelineResponse(nodes=[])

    rows = sb.table("timeline_nodes").select(
        "id, commit_sha, title, summary, author, committed_at, position_index, x, y, meta"
    ).eq("timeline_id", tl_id).order("position_index", asc=True).limit(limit).execute()

    sha_list = [r["commit_sha"] for r in rows.data]
    diff_lookup: Dict[str, Dict[str, Any]] = {}
    if sha_list:
        chunks = [sha_list[i:i + 100] for i in range(0, len(sha_list), 100)]
        for chunk in chunks:
            stats = sb.table("commit_diffs").select("commit_sha, files_changed, additions, deletions").in_("commit_sha", chunk).execute()
            for row in stats.data:
                diff_lookup[row["commit_sha"]] = row

    for r in rows.data:
        stats = diff_lookup.get(r["commit_sha"], {})
        meta = r.get("meta") or {}
        nodes.append(TimelineNode(
            id=r["id"],
            commit_sha=r["commit_sha"],
            title=r.get("title"),
            summary=r.get("summary"),
            author=r.get("author"),
            committed_at=r.get("committed_at"),
            position_index=r["position_index"],
            x=r["x"],
            y=r["y"],
            files_changed=stats.get("files_changed", meta.get("files_changed", 0)),
            additions=stats.get("additions", meta.get("additions", 0)),
            deletions=stats.get("deletions", meta.get("deletions", 0)),
        ))
    return TimelineResponse(nodes=nodes)


@router.get("/commits/{sha}/diff", response_model=DiffResponse)
def get_commit_diff(sha: str) -> DiffResponse:
    sb = get_supabase_admin_client()
    if not sb:
        return DiffResponse(commit_sha=sha)
    row = sb.table("commit_diffs").select("commit_sha, patch_summary, patch_full").eq("commit_sha", sha).limit(1).execute()
    if not row.data:
        return DiffResponse(commit_sha=sha)
    r = row.data[0]
    return DiffResponse(commit_sha=r["commit_sha"], patch_summary=r.get("patch_summary"), patch_full=r.get("patch_full"))
