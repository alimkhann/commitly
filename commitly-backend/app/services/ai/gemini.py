# flake8: noqa: E501
from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any, Awaitable, Callable, Optional, Sequence

import httpx

from app.models.roadmap import StageTask, TimelineResource, TimelineStage
from app.services.github import RepositoryMetadata
from app.services.rag import CommitChunk

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 12000
MAX_CHUNK_SNIPPET_CHARS = 400
MIN_CHUNK_SNIPPET_CHARS = 150
# Allow enough headroom for model "thoughts" plus the JSON timeline.
MAX_OUTPUT_TOKENS = 8192
MIN_RETRY_CHUNKS = 5
MAX_GEMINI_ATTEMPTS = 5

NOISE_PATTERNS = [
    r"^Merge (branch|pull request)",
    r"^Bump version",
    r"^Update (README|CHANGELOG|LICENSE)",
    r"^Fix typo",
    r"^chore",
    r"^docs",
    r"^style",
    r"^test",
]

PROMPT_TEMPLATE = """
You are Commitly, an engineering mentor that reads GitHub commit history and designs
learning roadmaps for developers who want to REBUILD the project themselves.

Repository: {name}
Description: {description}
Stars: {stars}
Language: {language}
Default branch: {branch}

You are given a compressed commit history below.

Your job:
- Compress the ENTIRE evolution of this repository (from the first commit to the most recent)
  into {stage_budget} ordered learning stages.
- Each stage should feel like a self-contained "episode" a learner can complete in 30–90 minutes.
- The roadmap must help a developer gradually re-implement the project, not just read diffs.

Follow these rules:

1. Coverage
   - Stages must cover the whole project history, not just early commits.
   - Group related commits into feature-oriented stages (setup, major features, refactors, ops).
   - Prefer stages that are pedagogically useful over mechanically covering every tiny change.

2. Stage semantics
   - Use exactly one "setup" stage near the beginning for repository onboarding.
   - For the remaining stages, choose a mix of:
     - "feature" (new capability or user-facing behavior)
     - "refactor" (structural or quality-of-life changes)
     - "testing" (tests, QA tools)
     - "ops" (deployment, logging, monitoring)
     - "other" only if nothing else fits.
   - Assign difficulty as: "intro", "easy", "medium", or "hard" based on the work required.

3. Teaching focus
   Every stage MUST:
   - State 1–3 concrete learning GOALS (what the learner will understand after finishing).
   - Include 1–3 TASKS. For each task:
     - Give a short label.
     - Provide 2–5 specific STEPS that a learner can follow ("Open file X", "Create function Y", "Run command Z").
     - List 1–4 FILES that are central to the task.
     - Include relevant COMMANDS when setup, running, or building is required.
   - Optionally include up to 2 CODE EXAMPLES:
     - Keep each snippet short (3–15 lines).
     - Show clean final code, not raw diffs or patch markers.
     - Explain what the snippet demonstrates.

4. Stage 0 (setup & tour)
   - If the repository has any non-trivial setup, create a first stage that:
     - Helps the learner install dependencies (for them to start rebuilding the project from scratch).
     - Runs the development server or main command.
     - Gives a quick tour of top-level folders and core technologies.
   - Mark this stage as category "setup" and difficulty "intro".

5. Output format
   - Return ONLY JSON, no markdown.
   - The JSON must conform exactly to this schema (field names and allowed values):
{{
  "timeline": [
    {{
      "id": "stage-1",
      "index": 1,
      "title": "…",
      "summary": "…",
      "status": "not-started",
      "eta": "45m",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "tasks": [
        {{
          "label": "Task name",
          "steps": ["...", "..."],
          "files": ["path/to/file.tsx"],
          "commands": ["pnpm dev"]
        }}
      ],
      "code_examples": [
        {{
          "file": "app/api/chat/route.ts",
          "language": "ts",
          "description": "Short explanation",
          "snippet": "const x = 1;"
        }}
      ],
      "resources": [{{ "label": "Docs", "href": "https://..." }}],
      "commit_window": ["sha1", "sha2"]
    }}
  ]
}}


   Where:
   - status must always be "not-started".
   - index is 0-based for the setup stage (if present) and increases by 1 for each stage after.
   - commit_window is a list of commit SHAs that influenced this stage.

Commit history context (oldest to newest):
{context}

"""

REVIEW_PROMPT = """
You are a senior engineering lead reviewing a learning roadmap designed for a junior developer.

Repository: {name}
Roadmap to Review:
{timeline_json}

Your Goal: Critique and refine this roadmap.
1. Check for logical flow. Are prerequisites clear?
2. Ensure tasks are actionable and specific.
3. Remove any hallucinations or generic fluff.
4. Verify that the "setup" stage is first and "ops" or advanced topics are later.

Return the IMPROVED roadmap JSON. It must strictly follow the same schema.
"""

PLANNING_PROMPT = """
You are an expert engineering mentor designing a learning roadmap for a developer who wants to REBUILD this project: {name}.
The learner has the code but needs to understand how to build it from scratch.

Your goal: Plan a curriculum of {stage_budget} distinct learning stages.

Repository Context:
{context}

Instructions:
1. Analyze the commit clusters above.
2. Group them into logical "Stages" that represent meaningful milestones (e.g. "Initial Setup", "Authentication System", "Core API").
3. Ensure the stages cover the ENTIRE project lifecycle.
4. Return a JSON list of stages.

Output Schema:
{{
  "stages": [
    {{
      "id": "stage-1",
      "index": 1,
      "title": "Stage Title",
      "summary": "High-level summary of what is built here.",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "commit_window": ["start_sha", "end_sha"]
    }}
  ]
}}
"""

EXPANSION_PROMPT = """
You are an expert engineering mentor. You are writing the detailed content for ONE stage of a learning roadmap.

Repository: {name}
Stage: {stage_title}
Summary: {stage_summary}

Relevant Commits:
{context}

Your Task:
Create a detailed, actionable guide for this stage. The learner should be able to REPLICATE the features in these commits.
Do NOT ask them to clone the repo. Assume they are building it file-by-file from scratch.
Focus on: "Install dependencies", "Create file X", "Add function Y".

Requirements:
1. **Prerequisites**: What must be done/known before this stage?
2. **Goals**: 1-3 clear learning objectives.
3. **Tasks**: Step-by-step instructions.
   - Use "step_by_step" style: "1. Run X", "2. Edit Y".
   - Reference specific FILES and COMMANDS.
4. **Checkpoints**: How does the user know they are done? (e.g. "Server starts on port 3000").
5. **Code Examples**: Key snippets (clean, final code).

Output JSON Schema:
{{
  "goals": ["..."],
  "prerequisites": ["..."],
  "checkpoints": ["..."],
  "tasks": [
    {{
      "label": "Task Name",
      "steps": ["1. ...", "2. ..."],
      "files": ["path/to/file"],
      "commands": ["npm run dev"]
    }}
  ],
  "code_examples": [
    {{
      "file": "path/to/file",
      "language": "ts",
      "description": "...",
      "snippet": "..."
    }}
  ],
  "resources": [{{ "label": "...", "href": "..." }}]
}}
"""

TIMELINE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "timeline": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "index": {"type": "integer"},
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "status": {"type": "string"},
                    "eta": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": [
                            "setup",
                            "feature",
                            "refactor",
                            "testing",
                            "ops",
                            "perf",
                            "docs",
                            "style",
                            "chore",
                            "other",
                        ],
                    },
                    "difficulty": {
                        "type": "string",
                        "enum": ["intro", "easy", "medium", "hard"],
                    },
                    "goals": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "prerequisites": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "checkpoints": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "steps": {"type": "array", "items": {"type": "string"}},
                                "files": {"type": "array", "items": {"type": "string"}},
                                "commands": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["label", "steps"],
                        },
                    },
                    "code_examples": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "file": {"type": "string"},
                                "language": {"type": "string"},
                                "description": {"type": "string"},
                                "snippet": {"type": "string"},
                            },
                            "required": ["file", "language", "description", "snippet"],
                        },
                    },
                    "resources": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "href": {"type": "string"},
                            },
                            "required": ["label", "href"],
                        },
                    },
                    "commit_window": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "id",
                    "index",
                    "title",
                    "summary",
                    "status",
                    "eta",
                    "category",
                    "difficulty",
                    "goals",
                    "prerequisites",
                    "checkpoints",
                    "tasks",
                    "resources",
                    "commit_window",
                ],
            },
        }
    },
    "required": ["timeline"],
}

PLANNING_SCHEMA = {
    "type": "object",
    "properties": {
        "stages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "index": {"type": "integer"},
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "category": {"type": "string"},
                    "difficulty": {"type": "string"},
                    "commit_window": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "id",
                    "index",
                    "title",
                    "summary",
                    "category",
                    "difficulty",
                    "commit_window",
                ],
            },
        }
    },
    "required": ["stages"],
}

EXPANSION_SCHEMA = {
    "type": "object",
    "properties": {
        "goals": {"type": "array", "items": {"type": "string"}},
        "prerequisites": {"type": "array", "items": {"type": "string"}},
        "checkpoints": {"type": "array", "items": {"type": "string"}},
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "steps": {"type": "array", "items": {"type": "string"}},
                    "files": {"type": "array", "items": {"type": "string"}},
                    "commands": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["label", "steps"],
            },
        },
        "code_examples": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "file": {"type": "string"},
                    "language": {"type": "string"},
                    "description": {"type": "string"},
                    "snippet": {"type": "string"},
                },
                "required": ["file", "language", "description", "snippet"],
            },
        },
        "resources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "href": {"type": "string"},
                },
                "required": ["label", "href"],
            },
        },
    },
    "required": ["goals", "prerequisites", "checkpoints", "tasks"],
}


def _safe_dump(obj: Any, limit: int = 4000) -> str:
    try:
        serialized = json.dumps(obj)
    except TypeError:
        serialized = str(obj)
    if len(serialized) > limit:
        return f"{serialized[:limit]}...<truncated>"
    return serialized


class GeminiConfigurationError(Exception):
    pass


class GeminiGenerationError(Exception):
    pass


class GeminiRoadmapGenerator:
    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise GeminiConfigurationError("GEMINI_API_KEY is not configured")
        self._api_key = api_key
        self._endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )

    async def generate(
        self,
        repo: RepositoryMetadata,
        chunks: Sequence[CommitChunk],
        stage_budget: int,
        progress_callback: Callable[[str], Awaitable[None]] | None = None,
    ) -> list[TimelineStage]:
        logger.info(
            f"Starting Gemini generation for {repo.full_name} with budget {stage_budget}"
        )
        chunk_list = list(chunks)
        if not chunk_list:
            raise GeminiGenerationError("Repository does not have enough commits")

        if progress_callback:
            await progress_callback("Grouping commits and filtering noise...")

        # 1. Group commits (with noise filtering)
        episodes = self._group_commits_into_episodes(chunk_list)
        logger.info(
            f"Grouped {len(chunk_list)} commits into {len(episodes)} episodes for {repo.full_name}"
        )

        if progress_callback:
            await progress_callback(
                f"Identified {len(episodes)} logical episodes. Planning stages..."
            )

        # 2. Plan Stages
        try:
            stages_plan = await self._plan_stages(repo, episodes, stage_budget)
            logger.info(f"Planned {len(stages_plan)} stages for {repo.full_name}")
        except Exception as e:
            logger.error(f"Planning failed for {repo.full_name}: {e}")
            # Fallback to old method or heuristic
            return self._fallback_timeline(repo, chunk_list, stage_budget)

        if progress_callback:
            await progress_callback(
                f"Planned {len(stages_plan)} stages. Expanding details..."
            )

        # 3. Expand Stages
        full_timeline = []
        for i, stage_def in enumerate(stages_plan):
            if progress_callback:
                await progress_callback(
                    f"Drafting content for stage {i+1}/{len(stages_plan)}: {stage_def.get('title')}..."
                )

            # Find commits for this stage
            stage_commits = self._find_commits_for_stage(
                chunk_list, stage_def.get("commit_window", [])
            )
            logger.debug(
                f"Expanding stage {i+1}: {stage_def.get('title')} with {len(stage_commits)} commits"
            )

            try:
                expanded_stage = await self._expand_stage(
                    repo, stage_def, stage_commits
                )
                full_timeline.append(expanded_stage)
            except Exception as e:
                logger.error(
                    f"Expansion failed for stage {stage_def.get('id')} in {repo.full_name}: {e}"
                )
                # Add minimal stage
                full_timeline.append(
                    TimelineStage(
                        id=stage_def.get("id", "unknown-stage"),
                        index=stage_def.get("index", 0),
                        title=stage_def.get("title", "Untitled Stage"),
                        summary=stage_def.get("summary", "No summary available."),
                        status="not-started",
                        eta="45m",
                        category=stage_def.get("category", "feature"),
                        difficulty=stage_def.get("difficulty", "medium"),
                        goals=["Review commits"],
                        tasks=[],
                        prerequisites=[],
                        checkpoints=[],
                        resources=[],
                        commit_window=stage_def.get("commit_window", []),
                    )
                )

        # 4. Reviewer Step
        if progress_callback:
            await progress_callback("Reviewing roadmap for quality and accuracy...")

        try:
            logger.info(f"Reviewing timeline for {repo.full_name}")
            reviewed_timeline = await self._review_timeline(repo, full_timeline)
            if progress_callback:
                await progress_callback("Roadmap generation complete!")
            logger.info(f"Completed generation for {repo.full_name}")
            return reviewed_timeline
        except Exception as e:
            logger.error(f"Review failed for {repo.full_name}: {e}")
            return full_timeline

    def _fallback_timeline(
        self, repo: RepositoryMetadata, chunks: list[CommitChunk], stage_budget: int
    ) -> list[TimelineStage]:
        return [
            TimelineStage(
                id="stage-1",
                index=1,
                title="Explore Repository",
                summary="Automated generation failed. Please explore the repository manually.",
                status="not-started",
                eta="1h",
                category="other",
                difficulty="medium",
                goals=["Review codebase"],
                prerequisites=[],
                checkpoints=[],
                tasks=[],
                code_examples=[],
                resources=[
                    TimelineResource(label="Repository", href=repo.html_url or "")
                ],
                commit_window=[],
            )
        ]

    def _group_commits_into_episodes(self, chunks: Sequence[CommitChunk]) -> list[dict]:
        """
        Group consecutive commits into 'episodes' based on time gaps and size.
        Filters out noisy commits.
        """
        if not chunks:
            return []

        episodes = []
        current_episode_commits = []

        # Sort chunks by authored_at if available, else preserve order
        # Assuming chunks might be mixed, but usually they come ordered from DB/Git.
        # We'll trust the input order but check timestamps for gaps.

        last_time = None

        for i, chunk in enumerate(chunks):
            # Noise Filtering
            first_line = (chunk.content or "").splitlines()[0] if chunk.content else ""
            if any(
                re.search(pattern, first_line, re.IGNORECASE)
                for pattern in NOISE_PATTERNS
            ):
                continue

            is_new_episode = False

            if last_time and chunk.authored_at:
                # If gap > 24 hours, new episode
                if (chunk.authored_at - last_time).total_seconds() > 86400:
                    is_new_episode = True

            # Or if current episode is too big (e.g. > 20 commits)
            if len(current_episode_commits) >= 20:
                is_new_episode = True

            if is_new_episode and current_episode_commits:
                self._finalize_episode(episodes, current_episode_commits)
                current_episode_commits = []

            current_episode_commits.append(chunk)
            if chunk.authored_at:
                last_time = chunk.authored_at

        if current_episode_commits:
            self._finalize_episode(episodes, current_episode_commits)

        return episodes

    def _finalize_episode(self, episodes: list, commits: list):
        first_commit = commits[0]
        last_commit = commits[-1]

        summary_lines = []
        for c in commits[:5]:  # Take first 5 for summary
            first_line = (
                (c.content or "").splitlines()[0]
                if (c.content or "").splitlines()
                else "No content"
            )
            summary_lines.append(first_line[:60])

        summary = "; ".join(summary_lines)

        episodes.append(
            {
                "index": len(episodes) + 1,
                "summary": summary,
                "shas": [c.commit_sha[:7] for c in commits],
                "details": "\n\n".join([c.content or "" for c in commits]),
                "commit_window": [first_commit.commit_sha, last_commit.commit_sha],
            }
        )

    def _render_episodes_context(self, chunks: Sequence[CommitChunk]) -> str:
        episodes = self._group_commits_into_episodes(chunks)
        pieces = []

        remaining = MAX_CONTEXT_CHARS

        for ep in episodes:
            text = (
                f"Episode {ep['index']}: {ep['summary']}\n"
                f"Commits: {', '.join(ep['shas'])}\n"
                f"{ep['details']}"
            )

            # Truncate if too long
            if len(text) > 2000:  # Cap per episode
                text = text[:2000] + "...<truncated>"

            pieces.append(text)
            remaining -= len(text)
            if remaining <= 0:
                break

        return "\n---\n".join(pieces)

    def _render_minimal_context(
        self, chunks: Sequence[CommitChunk], max_lines: int = 5
    ) -> str:
        lines = []
        for chunk in chunks[:max_lines]:
            first_line = (chunk.content or "").splitlines()
            summary = first_line[0] if first_line else ""
            summary = summary[:MIN_CHUNK_SNIPPET_CHARS]
            lines.append(f"{chunk.commit_sha[:7]} - {chunk.chunk_type}: {summary}")
        return "\n".join(lines)

    def _build_prompt(
        self,
        repo: RepositoryMetadata,
        stage_budget: int,
        context: str,
    ) -> str:
        return PROMPT_TEMPLATE.format(
            name=repo.full_name,
            description=repo.description or "",
            stars=repo.stars,
            language=repo.language or "unknown",
            branch=repo.default_branch,
            stage_budget=stage_budget,
            context=context,
        )

    def _parse_timeline(self, payload: dict) -> list[dict]:
        candidates = payload.get("candidates") or []
        if not candidates:
            logger.error(
                "Gemini response missing candidates", extra={"payload": payload}
            )
            raise GeminiGenerationError("Gemini response did not contain candidates")
        collected_segments: list[str] = []
        logged_parts: list[Any] = []

        def _append_segment(value: Any) -> None:
            if isinstance(value, str) and value.strip():
                collected_segments.append(value.strip())
            elif value not in (None, "", [], {}):
                try:
                    collected_segments.append(json.dumps(value))
                except TypeError:
                    pass

        def _ingest_function_call(raw: Any) -> None:
            if not isinstance(raw, dict):
                return
            for key in ("response", "result"):
                if key in raw:
                    _append_segment(raw[key])
            args = raw.get("args") or raw.get("arguments")
            if args is not None:
                _append_segment(args)

        function_call_keys = (
            "functionCall",
            "function_call",
            "functionCalls",
            "function_calls",
        )

        for candidate in candidates:
            content = candidate.get("content") or {}
            parts = content.get("parts") or []
            if not logged_parts:
                logged_parts = parts
            for part in parts:
                text_value = part.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    collected_segments.append(text_value)
                    continue
                function_call = part.get("functionCall") or part.get("function_call")
                if function_call:
                    _ingest_function_call(function_call)
                    continue
                inline_data = part.get("inlineData") or part.get("inline_data")
                if isinstance(inline_data, dict):
                    data = inline_data.get("data")
                    if isinstance(data, str) and data.strip():
                        try:
                            decoded = base64.b64decode(data).decode("utf-8")
                            collected_segments.append(decoded)
                            continue
                        except Exception:  # pragma: no cover - best effort decode
                            collected_segments.append(data)
                function_response = part.get("functionResponse") or part.get(
                    "function_response"
                )
                if isinstance(function_response, dict):
                    response_payload = function_response.get("response")
                    _append_segment(response_payload)
                    continue
            for source in (candidate, content):
                if not isinstance(source, dict):
                    continue
                for key in function_call_keys:
                    value = source.get(key)
                    if isinstance(value, list):
                        for item in value:
                            _ingest_function_call(item)
                    elif value:
                        _ingest_function_call(value)

        text = "\n".join(segment for segment in collected_segments if segment).strip()

        finish_reasons = [
            cand.get("finishReason") or cand.get("finish_reason") for cand in candidates
        ]
        is_truncated = "MAX_TOKENS" in finish_reasons

        if not text:
            level = logging.WARNING if is_truncated else logging.ERROR
            logger.log(
                level,
                "Gemini response missing text | payload=%s",
                _safe_dump(payload),
                extra={
                    "parts": logged_parts,
                    "payload": payload,
                    "finish_reasons": finish_reasons,
                    "prompt_feedback": payload.get("promptFeedback")
                    or payload.get("prompt_feedback"),
                },
            )
            raise GeminiGenerationError("Gemini response was empty")
        parsed: dict[str, Any] = {}
        if text:
            # Clean up markdown code blocks if present
            cleaned_text = text.strip()
            # Use regex to remove markdown code blocks (e.g. ```json ... ```)
            match = re.search(r"^```(?:\w+)?\s*(.*)\s*```$", cleaned_text, re.DOTALL)
            if match:
                cleaned_text = match.group(1)

            try:
                parsed = json.loads(cleaned_text)
            except json.JSONDecodeError as exc:
                level = logging.WARNING if is_truncated else logging.ERROR
                logger.log(
                    level,
                    "Failed to parse Gemini payload",
                    exc_info=exc,
                    extra={"raw_text": text[:2000], "is_truncated": is_truncated},
                )
        timeline = parsed.get("timeline") if isinstance(parsed, dict) else None
        if not isinstance(timeline, list) or not timeline:
            timeline = self._find_timeline(payload)
        if not isinstance(timeline, list) or not timeline:
            logger.error(
                "Gemini response missing timeline array",
                extra={"parsed": parsed, "payload": payload},
            )
            raise GeminiGenerationError("Gemini response missing timeline array")
        return timeline

    def _find_timeline(self, payload: Any) -> Optional[list]:
        if isinstance(payload, dict):
            timeline = payload.get("timeline")
            if isinstance(timeline, list) and timeline:
                return timeline
            for value in payload.values():
                found = self._find_timeline(value)
                if found:
                    return found
        elif isinstance(payload, list):
            for item in payload:
                found = self._find_timeline(item)
                if found:
                    return found
        return None

    @staticmethod
    def _extract_finish_reasons(payload: dict) -> list[str]:
        reasons: list[str] = []
        for candidate in payload.get("candidates") or []:
            reason = candidate.get("finishReason") or candidate.get("finish_reason")
            if isinstance(reason, str):
                reasons.append(reason)
        return reasons

    async def _invoke_gemini(
        self,
        *,
        repo: RepositoryMetadata,
        stage_budget: int,
        context: str,
        attempt: int,
        chunk_count: int,
        total_chunks: int,
        mode: str,
    ) -> dict:
        prompt = self._build_prompt(repo, stage_budget, context)
        logger.debug(
            "Invoking Gemini generation",
            extra={
                "repo": repo.full_name,
                "prompt_length": len(prompt),
                "prompt_snippet": prompt[:200] + "...",
                "attempt": attempt,
            },
        )
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ],
                }
            ],
            "generation_config": {
                "responseMimeType": "application/json",
                "responseSchema": TIMELINE_SCHEMA,
                "temperature": 0.2,
                "topP": 0.8,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE",
                },
            ],
        }
        extra = {
            "model": self._endpoint,
            "stage_budget": stage_budget,
            "repo": repo.full_name,
            "chunks": chunk_count,
            "total_chunks": total_chunks,
            "attempt": attempt,
            "mode": mode,
        }
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    self._endpoint,
                    params={"key": self._api_key},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            logger.error(
                "Gemini API network error",
                extra={**extra, "error": str(exc)},
            )
            raise GeminiGenerationError(f"Gemini API network error: {exc}")

        if response.status_code >= 400:
            logger.error(
                "Gemini API error",
                extra={
                    **extra,
                    "status": response.status_code,
                    "body": response.text,
                },
            )
            raise GeminiGenerationError(
                f"Gemini API call failed (status {response.status_code})"
            )

        logger.debug(
            "Gemini call success",
            extra={
                **extra,
                "response_length": len(response.text),
                "response_snippet": response.text[:200] + "...",
            },
        )
        return response.json()

    async def classify_difficulty(
        self,
        repo: RepositoryMetadata,
        chunks: Sequence[CommitChunk],
    ) -> str:
        """Classify repository difficulty as 'intro', 'easy', 'medium', or 'hard'."""
        languages_str = (
            ", ".join(repo.languages.keys()) if repo.languages else "Unknown"
        )
        topics_str = ", ".join(repo.topics) if repo.topics else "None"
        context = self._render_minimal_context(list(chunks)[:10])

        difficulty_prompt = f"""Analyze this GitHub repository and classify its difficulty level for new contributors.

Repository: {repo.full_name}
Description: {repo.description or 'No description'}
Primary Language: {repo.language or 'Unknown'}
Languages: {languages_str}
Topics: {topics_str}
Stars: {repo.stars}
Forks: {repo.fork_count}
Contributors: {repo.contributor_count}

Commit History Summary:
{context}

Based on the repository's complexity, codebase size, technologies used, and commit patterns, classify the difficulty as one of:
- "intro": Very simple, beginner-friendly projects (tutorials, simple scripts, basic examples)
- "easy": Straightforward projects with clear structure (simple web apps, basic tools)
- "medium": Moderate complexity requiring some experience (full-stack apps, libraries with multiple features)
- "hard": Complex projects requiring advanced knowledge (large frameworks, system software, complex algorithms)

Return ONLY the difficulty level as a single word: intro, easy, medium, or hard.
"""  # noqa: E501

        logger.debug(
            "Classifying difficulty",
            extra={
                "repo": repo.full_name,
                "prompt_snippet": difficulty_prompt[:200] + "...",
            },
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": difficulty_prompt}],
                }
            ],
            "generation_config": {
                "temperature": 0.3,
                "topP": 0.8,
                "maxOutputTokens": 50,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE",
                },
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self._endpoint,
                    params={"key": self._api_key},
                    json=payload,
                )
            if response.status_code >= 400:
                logger.warning(
                    "Difficulty classification failed, defaulting to 'medium'",
                    extra={"repo": repo.full_name, "status": response.status_code},
                )
                return "medium"

            result = response.json()
            text = ""
            candidates = result.get("candidates", [])
            for candidate in candidates:
                for part in candidate.get("content", {}).get("parts", []):
                    if "text" in part:
                        text += part["text"]

            if not text.strip():
                logger.warning(
                    "Difficulty classification returned empty text",
                    extra={
                        "repo": repo.full_name,
                        "full_response": result,
                        "finish_reasons": [c.get("finishReason") for c in candidates],
                    },
                )

            logger.debug(
                "Difficulty classification raw response",
                extra={"repo": repo.full_name, "raw_text": text},
            )

            difficulty = text.strip().lower()
            # Validate and normalize difficulty
            valid_difficulties = {"intro", "easy", "medium", "hard"}
            if difficulty in valid_difficulties:
                return difficulty
            # Try to extract from text if it contains the word
            for valid in valid_difficulties:
                if valid in difficulty:
                    return valid
            logger.warning(
                f"Invalid difficulty classification: {difficulty}, "
                f"defaulting to 'medium'",
                extra={"repo": repo.full_name},
            )
            return "medium"
        except Exception as exc:
            logger.warning(
                "Difficulty classification error, defaulting to 'medium'",
                extra={"repo": repo.full_name, "error": str(exc)},
            )
            return "medium"

    async def _call_gemini_generic(
        self, prompt: str, schema: dict, repo_name: str, temperature: float = 0.2
    ) -> dict:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generation_config": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": temperature,
                "topP": 0.8,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE",
                },
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    self._endpoint,
                    params={"key": self._api_key},
                    json=payload,
                )
                if response.status_code >= 400:
                    logger.error(f"Gemini API error: {response.text}")
                    raise GeminiGenerationError(
                        f"Gemini API error: {response.status_code}"
                    )

                return response.json()
        except Exception as e:
            logger.error(f"Gemini call failed: {e}")
            raise GeminiGenerationError(f"Gemini call failed: {e}")

    def _parse_json_from_text(self, text: str) -> Any:
        if not text:
            raise ValueError("Empty text")

        cleaned_text = text.strip()
        # Remove markdown code blocks
        match = re.search(r"^```(?:\w+)?\s*(.*)\s*```$", cleaned_text, re.DOTALL)
        if match:
            cleaned_text = match.group(1)

        return json.loads(cleaned_text)

    async def _plan_stages(
        self, repo: RepositoryMetadata, episodes: list[dict], stage_budget: int
    ) -> list[dict]:
        context = ""
        for ep in episodes:
            context += f"Episode {ep['index']}: {ep['summary']}\nWindow: {ep['commit_window']}\n\n"

        prompt = PLANNING_PROMPT.format(
            name=repo.full_name, stage_budget=stage_budget, context=context
        )

        response = await self._call_gemini_generic(
            prompt, PLANNING_SCHEMA, repo.full_name
        )

        candidates = response.get("candidates", [])
        if not candidates:
            raise GeminiGenerationError("No candidates")

        text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
        try:
            data = self._parse_json_from_text(text)
            return data.get("stages", [])
        except Exception as e:
            logger.error(f"Failed to parse planning response: {e}")
            return []

    async def _expand_stage(
        self, repo: RepositoryMetadata, stage_def: dict, commits: list[CommitChunk]
    ) -> TimelineStage:
        context = self._render_minimal_context(commits, max_lines=20)

        prompt = EXPANSION_PROMPT.format(
            name=repo.full_name,
            stage_title=stage_def.get("title"),
            stage_summary=stage_def.get("summary"),
            context=context,
        )

        response = await self._call_gemini_generic(
            prompt, EXPANSION_SCHEMA, repo.full_name
        )

        candidates = response.get("candidates", [])
        if not candidates:
            raise GeminiGenerationError("No candidates")

        text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
        data = self._parse_json_from_text(text)

        # Merge stage_def and data
        return TimelineStage(
            id=stage_def["id"],
            index=stage_def["index"],
            title=stage_def["title"],
            summary=stage_def["summary"],
            status="not-started",
            eta="45m",  # Could ask AI for this too
            category=stage_def.get("category", "feature"),
            difficulty=stage_def.get("difficulty", "medium"),
            goals=data.get("goals", []),
            prerequisites=data.get("prerequisites", []),
            checkpoints=data.get("checkpoints", []),
            tasks=[StageTask(**t) for t in data.get("tasks", [])],
            code_examples=[t for t in data.get("code_examples", [])],
            resources=[TimelineResource(**r) for r in data.get("resources", [])],
            commit_window=stage_def.get("commit_window", []),
        )

    async def _review_timeline(
        self, repo: RepositoryMetadata, timeline: list[TimelineStage]
    ) -> list[TimelineStage]:
        # Convert timeline to JSON for the prompt
        timeline_json = json.dumps([t.dict() for t in timeline], default=str)

        prompt = REVIEW_PROMPT.format(name=repo.full_name, timeline_json=timeline_json)

        response = await self._call_gemini_generic(
            prompt, TIMELINE_SCHEMA, repo.full_name, temperature=0.1
        )

        candidates = response.get("candidates", [])
        if not candidates:
            raise GeminiGenerationError("No candidates in review")

        text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")

        # Parse the reviewed timeline
        try:
            parsed = self._parse_json_from_text(text)
            reviewed_data = parsed.get("timeline", [])

            # Reconstruct TimelineStage objects
            reviewed_stages = []
            for item in reviewed_data:
                reviewed_stages.append(TimelineStage(**item))

            return reviewed_stages
        except Exception as e:
            logger.error(f"Failed to parse reviewed timeline: {e}")
            return timeline

    def _find_commits_for_stage(
        self, chunks: list[CommitChunk], window: list[str]
    ) -> list[CommitChunk]:
        if not window or len(window) != 2:
            return []

        start_sha, end_sha = window
        found = []
        in_window = False

        for chunk in chunks:
            if chunk.commit_sha.startswith(start_sha) or start_sha.startswith(
                chunk.commit_sha
            ):
                in_window = True

            if in_window:
                found.append(chunk)

            if chunk.commit_sha.startswith(end_sha) or end_sha.startswith(
                chunk.commit_sha
            ):
                in_window = False
                break

        return found
