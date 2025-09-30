from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass
from typing import List, Optional

try:
    from openai import OpenAI  # type: ignore
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CommitInfo:
    sha: str
    message: str
    author: Optional[str]
    committed_at: Optional[str]
    files_changed: int
    additions: int
    deletions: int


@dataclass
class TimelineNodePayload:
    commit_sha: str
    title: str
    summary: str
    author: Optional[str]
    committed_at: Optional[str]
    files_changed: int
    additions: int
    deletions: int
    related_shas: List[str]


DEFAULT_MAX_NODES = 30
DEFAULT_PER_ROW = 6
DEFAULT_STRATEGY = "ai_v1"


def build_timeline_nodes(
    commits: List[CommitInfo],
    max_nodes: int = DEFAULT_MAX_NODES,
    strategy: str = DEFAULT_STRATEGY,
) -> List[TimelineNodePayload]:
    """Create timeline nodes, preferring AI condensation when configured."""
    if not commits:
        return []

    ai_nodes: Optional[List[TimelineNodePayload]] = None
    if settings.openai_api_key and OpenAI is not None and strategy.startswith("ai"):
        try:
            ai_nodes = _build_with_openai(commits, max_nodes, strategy)
        except Exception as exc:  # pragma: no cover - fallback path
            logger.warning("AI timeline generation failed: %s", exc, exc_info=settings.debug)
    else:
        if not settings.openai_api_key:
            logger.info("OPENAI_API_KEY not configured; using heuristic timeline generation")

    if ai_nodes:
        return ai_nodes

    return _build_with_heuristics(commits, max_nodes)


def _build_with_openai(
    commits: List[CommitInfo],
    max_nodes: int,
    strategy: str,
) -> Optional[List[TimelineNodePayload]]:
    client = OpenAI(api_key=settings.openai_api_key)
    sample_limit = min(len(commits), 80)
    commit_snapshot = commits[:sample_limit]

    commit_lines = [
        f"{idx+1}. {c.sha[:7]} | {c.committed_at or ''} | {c.author or 'unknown'} | {c.message.split('\n')[0][:140]}"
        for idx, c in enumerate(commit_snapshot)
    ]
    prompt = (
        "You are an engineering planner. Summarize commit history into high-level milestones.\n"
        "Return JSON with a 'nodes' array. Each node should have: 'title', 'summary', 'representative_sha',"
        " and 'commit_shas' (list). Use at most "
        f"{max_nodes} nodes. Focus on grouping related commits to tell a cohesive story."
    )

    response = client.chat.completions.create(
        model=settings.openai_model or "gpt-4o-mini",
        temperature=0.3,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You produce concise JSON without commentary."},
            {"role": "user", "content": prompt},
            {"role": "user", "content": "Commit snapshot:\n" + "\n".join(commit_lines)},
        ],
        timeout=30,
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        return None

    try:
        parsed = json.loads(content)
        nodes_json = parsed.get("nodes", [])
    except json.JSONDecodeError:
        logger.warning("OpenAI response not JSON: %s", content[:200])
        return None

    if not isinstance(nodes_json, list):
        return None

    sha_lookup = {c.sha: c for c in commits}

    results: List[TimelineNodePayload] = []
    for idx, node in enumerate(nodes_json):
        if not isinstance(node, dict):
            continue
        title = node.get("title") or f"Milestone {idx + 1}"
        summary = node.get("summary") or title
        commit_shas = node.get("commit_shas") or []
        if not isinstance(commit_shas, list):
            commit_shas = []
        commit_shas = [str(s) for s in commit_shas if isinstance(s, str)]

        rep_sha = node.get("representative_sha")
        if not isinstance(rep_sha, str):
            rep_sha = commit_shas[0] if commit_shas else commits[min(idx, len(commits) - 1)].sha

        rep_commit = sha_lookup.get(rep_sha) or sha_lookup.get(rep_sha[:7])
        if not rep_commit:
            # fallback to first matching commit by prefix
            rep_commit = next(
                (c for c in commits if c.sha.startswith(rep_sha[:7])),
                commits[min(idx, len(commits) - 1)],
            )
            rep_sha = rep_commit.sha

        related = commit_shas or [rep_commit.sha]
        additions = sum(sha_lookup.get(s, rep_commit).additions for s in related)
        deletions = sum(sha_lookup.get(s, rep_commit).deletions for s in related)
        files_changed = sum(sha_lookup.get(s, rep_commit).files_changed for s in related)

        results.append(
            TimelineNodePayload(
                commit_sha=rep_sha,
                title=title[:160],
                summary=summary[:800],
                author=rep_commit.author,
                committed_at=rep_commit.committed_at,
                files_changed=files_changed,
                additions=additions,
                deletions=deletions,
                related_shas=related,
            )
        )

    return results or None


def _build_with_heuristics(commits: List[CommitInfo], max_nodes: int) -> List[TimelineNodePayload]:
    chunk_size = max(1, math.ceil(len(commits) / max_nodes))
    results: List[TimelineNodePayload] = []
    for idx in range(0, len(commits), chunk_size):
        chunk = commits[idx: idx + chunk_size]
        representative = chunk[0]
        title = representative.message.split('\n')[0][:160] or f"Milestone {len(results) + 1}"
        combined_summary = "\n".join(c.message.split('\n')[0] for c in chunk)[:800]
        additions = sum(c.additions for c in chunk)
        deletions = sum(c.deletions for c in chunk)
        files_changed = sum(c.files_changed for c in chunk)

        results.append(
            TimelineNodePayload(
                commit_sha=representative.sha,
                title=title,
                summary=combined_summary,
                author=representative.author,
                committed_at=representative.committed_at,
                files_changed=files_changed,
                additions=additions,
                deletions=deletions,
                related_shas=[c.sha for c in chunk],
            )
        )

    return results


def compute_snake_coordinates(total_nodes: int, spacing_x: int = 160, spacing_y: int = 140) -> List[tuple[int, int]]:
    per_row = max(3, min(DEFAULT_PER_ROW, total_nodes)) if total_nodes <= DEFAULT_PER_ROW else DEFAULT_PER_ROW
    coords: List[tuple[int, int]] = []
    for idx in range(total_nodes):
        row = idx // per_row
        col = idx % per_row
        if row % 2 == 1:
            col = per_row - 1 - col
        x = col * spacing_x
        y = row * spacing_y
        coords.append((x, y))
    return coords
