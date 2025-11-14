from __future__ import annotations

import base64
import json
import logging
from typing import Any, Optional, Sequence

import httpx

from app.models.roadmap import TimelineStage
from app.services.github import RepositoryMetadata
from app.services.rag import CommitChunk

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 15000

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
        if not chunks:
            raise GeminiGenerationError("Repository does not have enough commits")
        context = self._render_context(chunks)
        prompt = PROMPT_TEMPLATE.format(
            name=repo.full_name,
            description=repo.description or "",
            stars=repo.stars,
            language=repo.language or "unknown",
            branch=repo.default_branch,
            stage_budget=stage_budget,
            context=context,
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
                "response_mime_type": "application/json",
                "response_json_schema": TIMELINE_SCHEMA,
                "temperature": 0.2,
                "top_p": 0.8,
                "max_output_tokens": 1024,
            },
        }
        extra = {
            "model": self._endpoint,
            "stage_budget": stage_budget,
            "repo": repo.full_name,
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
        body = response.json()
        timeline = self._parse_timeline(body)
        return [TimelineStage(**stage) for stage in timeline]

    def _render_context(self, chunks: Sequence[CommitChunk]) -> str:
        pieces = []
        remaining = MAX_CONTEXT_CHARS
        per_chunk = max(600, MAX_CONTEXT_CHARS // max(1, len(chunks)))
        for chunk in chunks:
            snippet = (chunk.content or "")[:per_chunk]
            text = f"[{chunk.commit_sha[:7]} | {chunk.chunk_type}]\n{snippet}"
            pieces.append(text)
            remaining -= len(text)
            if remaining <= 0:
                break
        return "\n\n".join(pieces)

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
