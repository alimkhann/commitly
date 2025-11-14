from __future__ import annotations

import json
import logging
from typing import Sequence

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
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
                "topP": 0.8,
                "maxOutputTokens": 1024,
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
            raise GeminiGenerationError("Gemini response did not contain candidates")
        content = candidates[0].get("content") or {}
        parts = content.get("parts") or []
        text = "".join(part.get("text", "") for part in parts)
        if not text:
            raise GeminiGenerationError("Gemini response was empty")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse Gemini payload", exc_info=exc)
            raise GeminiGenerationError("Gemini returned non-JSON output") from exc
        timeline = parsed.get("timeline")
        if not isinstance(timeline, list) or not timeline:
            raise GeminiGenerationError("Gemini response missing timeline array")
        return timeline
