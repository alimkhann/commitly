from __future__ import annotations

import base64
import json
import logging
import math
from typing import Any, Optional, Sequence

import httpx

from app.models.roadmap import TimelineStage
from app.services.github import RepositoryMetadata
from app.services.rag import CommitChunk

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 8000
MAX_CHUNK_SNIPPET_CHARS = 400
MIN_CHUNK_SNIPPET_CHARS = 150
# Allow enough headroom for model \"thoughts\" plus the JSON timeline.
MAX_OUTPUT_TOKENS = 6144
MIN_RETRY_CHUNKS = 5
MAX_GEMINI_ATTEMPTS = 5

PROMPT_TEMPLATE = """
You are Commitly, an engineering mentor that reads GitHub commit history and drafts
actionable learning roadmaps.

Repository: {name}
Description: {description}
Stars: {stars}
Language: {language}
Default branch: {branch}

You will read the commit timeline below. Use it to propose ONLY {stage_budget}
sequential roadmap stages (roughly the first quarter of the full project) that
help a new contributor understand how the project evolved.

Each stage should:
- Reference concrete commits or files when possible.
- Contain 3-4 short bullet tasks.
- Include one helpful resource link (GitHub file, docs, or issue).
Use repo links when no better source exists.
- Always set status to "not-started" and ETA to a short estimate like "45m" or "2h".

Return JSON that matches this schema exactly:
{{
  "timeline": [
    {{
      "id": "stage-1",
      "title": "...",
      "summary": "...",
      "status": "not-started",
      "eta": "30m",
      "tasks": ["task"],
      "resources": [{{"label": "Docs", "href": "https://..."}}]
    }}
  ]
}}

Commit context:
{context}
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
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "status": {"type": "string"},
                    "eta": {"type": "string"},
                    "tasks": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
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
                        "minItems": 1,
                    },
                },
                "required": [
                    "id",
                    "title",
                    "summary",
                    "status",
                    "eta",
                    "tasks",
                    "resources",
                ],
            },
            "minItems": 1,
        }
    },
    "required": ["timeline"],
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
    ) -> list[TimelineStage]:
        chunk_list = list(chunks)
        if not chunk_list:
            raise GeminiGenerationError("Repository does not have enough commits")
        attempt_chunks = chunk_list
        attempt = 0
        while attempt < MAX_GEMINI_ATTEMPTS:
            attempt += 1
            context = self._render_context(attempt_chunks)
            body = await self._invoke_gemini(
                repo=repo,
                stage_budget=stage_budget,
                context=context,
                attempt=attempt,
                chunk_count=len(attempt_chunks),
                total_chunks=len(chunk_list),
                mode="default",
            )
            try:
                timeline = self._parse_timeline(body)
                return [TimelineStage(**stage) for stage in timeline]
            except GeminiGenerationError:
                finish_reasons = self._extract_finish_reasons(body)
                if (
                    "MAX_TOKENS" in finish_reasons
                    and len(attempt_chunks) > MIN_RETRY_CHUNKS
                ):
                    new_length = max(MIN_RETRY_CHUNKS, len(attempt_chunks) // 2)
                    if (
                        new_length == len(attempt_chunks)
                        and len(attempt_chunks) > MIN_RETRY_CHUNKS
                    ):
                        new_length = max(MIN_RETRY_CHUNKS, len(attempt_chunks) - 1)
                    if new_length < len(attempt_chunks):
                        attempt_chunks = attempt_chunks[:new_length]
                        logger.info(
                            "Retrying Gemini with %d/%d chunks due to MAX_TOKENS "
                            "(attempt %d)",
                            new_length,
                            len(chunk_list),
                            attempt + 1,
                        )
                        continue
                raise

        # Final fallback with compressed context (commit headers only)
        minimal_context = self._render_minimal_context(chunk_list[:MIN_RETRY_CHUNKS])
        try:
            body = await self._invoke_gemini(
                repo=repo,
                stage_budget=stage_budget,
                context=minimal_context,
                attempt=attempt + 1,
                chunk_count=min(len(chunk_list), MIN_RETRY_CHUNKS),
                total_chunks=len(chunk_list),
                mode="minimal",
            )
            timeline = self._parse_timeline(body)
            return [TimelineStage(**stage) for stage in timeline]
        except GeminiGenerationError:
            logger.warning(
                "Gemini exhausted attempts; falling back to heuristic roadmap",
                extra={
                    "repo": repo.full_name,
                    "total_chunks": len(chunk_list),
                    "stage_budget": stage_budget,
                },
            )
            return self._fallback_timeline(repo, chunk_list, stage_budget)

    def _render_context(self, chunks: Sequence[CommitChunk]) -> str:
        pieces = []
        remaining = MAX_CONTEXT_CHARS
        per_chunk = MAX_CONTEXT_CHARS // max(1, len(chunks))
        per_chunk = min(MAX_CHUNK_SNIPPET_CHARS, per_chunk)
        per_chunk = max(MIN_CHUNK_SNIPPET_CHARS, per_chunk)
        for chunk in chunks:
            snippet = (chunk.content or "")[:per_chunk]
            text = f"[{chunk.commit_sha[:7]} | {chunk.chunk_type}]\n{snippet}"
            pieces.append(text)
            remaining -= len(text)
            if remaining <= 0:
                break
        return "\n\n".join(pieces)

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
        if not text:
            logger.error(
                "Gemini response missing text | payload=%s",
                _safe_dump(payload),
                extra={
                    "parts": logged_parts,
                    "payload": payload,
                    "finish_reasons": [
                        cand.get("finishReason") or cand.get("finish_reason")
                        for cand in candidates
                    ],
                    "prompt_feedback": payload.get("promptFeedback")
                    or payload.get("prompt_feedback"),
                },
            )
            raise GeminiGenerationError("Gemini response was empty")
        parsed: dict[str, Any] = {}
        if text:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                logger.error(
                    "Failed to parse Gemini payload",
                    exc_info=exc,
                    extra={"raw_text": text[:2000]},
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
                "response_mime_type": "application/json",
                "response_json_schema": TIMELINE_SCHEMA,
                "temperature": 0.2,
                "top_p": 0.8,
                "max_output_tokens": MAX_OUTPUT_TOKENS,
            },
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
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                self._endpoint,
                params={"key": self._api_key},
                json=payload,
            )
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
        logger.debug("Gemini call success", extra=extra)
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
        context = self._render_context(list(chunks)[:10])

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

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": difficulty_prompt}],
                }
            ],
            "generation_config": {
                "temperature": 0.3,
                "top_p": 0.8,
                "max_output_tokens": 10,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
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
            for candidate in result.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    if "text" in part:
                        text += part["text"]

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

    def _fallback_timeline(
        self,
        repo: RepositoryMetadata,
        chunks: Sequence[CommitChunk],
        stage_budget: int,
    ) -> list[TimelineStage]:
        if not chunks:
            raise GeminiGenerationError(
                "Gemini failed to generate and no commits available for fallback"
            )
        stage_count = max(1, min(stage_budget, len(chunks)))
        group_size = math.ceil(len(chunks) / stage_count)
        timeline: list[TimelineStage] = []
        repo_url = (
            repo.html_url or f"https://github.com/{repo.full_name}"
            if getattr(repo, "full_name", None)
            else None
        )
        for idx in range(stage_count):
            start = idx * group_size
            end = min(len(chunks), start + group_size)
            stage_chunks = chunks[start:end]
            if not stage_chunks:
                continue
            title = self._fallback_title(stage_chunks, idx)
            summary = self._fallback_summary(stage_chunks)
            tasks = self._fallback_tasks(stage_chunks)
            resources = (
                [{"label": "Repository", "href": repo_url}]
                if repo_url
                else [{"label": "GitHub", "href": "https://github.com/"}]
            )
            timeline.append(
                TimelineStage(
                    id=f"stage-{idx + 1}",
                    title=title,
                    summary=summary,
                    status="not-started",
                    eta="45m",
                    tasks=tasks,
                    resources=resources,
                )
            )
        if not timeline:
            raise GeminiGenerationError("Fallback timeline generation failed")
        return timeline

    def _fallback_title(self, stage_chunks: Sequence[CommitChunk], idx: int) -> str:
        first = stage_chunks[0].commit_sha[:7]
        last = stage_chunks[-1].commit_sha[:7]
        if first == last:
            window = first
        else:
            window = f"{first}…{last}"
        return f"Stage {idx + 1}: Review commits {window}"

    def _fallback_summary(self, stage_chunks: Sequence[CommitChunk]) -> str:
        lines = []
        for chunk in stage_chunks[:3]:
            first_line = (chunk.content or "").splitlines()
            text = first_line[0].strip() if first_line else ""
            if text:
                lines.append(text[:180])
        if not lines:
            lines = [
                f"{len(stage_chunks)} commits touching {stage_chunks[0].chunk_type}"
            ]
        return " / ".join(lines)

    def _fallback_tasks(self, stage_chunks: Sequence[CommitChunk]) -> list[str]:
        tasks: list[str] = []
        for chunk in stage_chunks[:3]:
            lines = [line.strip() for line in (chunk.content or "").splitlines()]
            for line in lines:
                if line and not line.startswith("---"):
                    tasks.append(line[:140])
                    break
        if not tasks:
            window = (
                f"{stage_chunks[0].commit_sha[:7]}–{stage_chunks[-1].commit_sha[:7]}"
            )
            tasks = [f"Read commits {window}"]
        return tasks
