from __future__ import annotations

import json
import logging
from typing import Optional

import httpx
from app.models.roadmap import GeneratedRoadmap, RepoCommitChunk
from app.services.ai.gemini import GeminiGenerationError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 2048

SYSTEM_PROMPT_TEMPLATE = """
You are Commitly, an expert engineering mentor. You are guiding a developer who is
rebuilding the repository "{repo_name}".

Context:
{context}

User Query: {user_query}

Answer the user's question based on the provided context.
- Be helpful, encouraging, and technical.
- If the context contains code snippets, reference them.
- If the user asks about a specific task in the stage, guide them through it.
- If the answer is not in the context, use your general programming knowledge
  but mention that it's not explicitly in the provided commit history.
"""


class GeminiChatService:
    def __init__(self, session: Session, api_key: str, model: str) -> None:
        self._session = session
        self._api_key = api_key
        self._model = model
        self._endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )

    def _build_context(
        self, repo_full_name: str, stage_id: Optional[str] = None
    ) -> str | None:
        # 1. Fetch Roadmap
        roadmap = (
            self._session.query(GeneratedRoadmap)
            .filter_by(repo_full_name=repo_full_name)
            .first()
        )
        if not roadmap:
            return None

        context = ""

        if stage_id:
            # Stage-specific context
            stage = next((s for s in roadmap.timeline if s["id"] == stage_id), None)
            if stage:
                context += f"Current Stage: {stage['title']}\n"
                context += f"Summary: {stage['summary']}\n"
                context += f"Goals: {', '.join(stage.get('goals', []))}\n"

                # Fetch commits for this stage
                commit_window = stage.get("commit_window", [])
                if commit_window and len(commit_window) == 2:
                    commits = self._find_commits_for_window(
                        repo_full_name, commit_window
                    )
                    context += "\nRelevant Commits/Code:\n"
                    for commit in commits:
                        # Truncate content to avoid blowing up context
                        content_snippet = (commit.content or "")[:1000]
                        context += (
                            f"Commit {commit.commit_sha[:7]}: {content_snippet}\n\n"
                        )
            else:
                context += "Stage not found. Using general repository context.\n"

        if not context:
            # General context
            context += f"Repository: {roadmap.repo_full_name}\n"
            context += f"Description: {roadmap.repo_summary.get('description', '')}\n"
            context += f"Primary Language: {roadmap.primary_language}\n"
            context += "\nRoadmap Overview:\n"
            for stage in roadmap.timeline:
                context += f"- {stage['title']}: {stage['summary']}\n"

        return context

    async def chat(
        self,
        repo_full_name: str,
        message: str,
        stage_id: Optional[str] = None,
    ) -> str:
        context = self._build_context(repo_full_name, stage_id)
        if not context:
            return (
                "I don't have a roadmap for this repository yet."
                " Please generate one first."
            )

        # 2. Call Gemini
        prompt = SYSTEM_PROMPT_TEMPLATE.format(
            repo_name=repo_full_name, context=context, user_query=message
        )

        return await self._call_gemini(prompt)

    async def chat_stream(
        self,
        repo_full_name: str,
        messages: list[dict],
        stage_id: Optional[str] = None,
    ):
        context = self._build_context(repo_full_name, stage_id)
        if not context:
            yield self._format_protocol_text(
                "I don't have a roadmap for this repository yet."
                " Please generate one first."
            )
            return

        # Use the last message from the user
        user_query = messages[-1]["content"] if messages else ""
        prompt = SYSTEM_PROMPT_TEMPLATE.format(
            repo_name=repo_full_name, context=context, user_query=user_query
        )

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generation_config": {
                "temperature": 0.4,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
            },
        }

        stream_endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self._model}:streamGenerateContent"
        )

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                stream_endpoint,
                params={"key": self._api_key},
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    yield self._format_protocol_error(
                        f"Gemini API error: {response.status_code}"
                    )
                    return

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line == "[" or line == "]":
                        continue
                    if line.startswith(","):
                        line = line[1:].strip()

                    try:
                        chunk_data = json.loads(line)
                        candidates = chunk_data.get("candidates", [])
                        if candidates:
                            text_chunk = (
                                candidates[0]
                                .get("content", {})
                                .get("parts", [])[0]
                                .get("text", "")
                            )
                            if text_chunk:
                                yield self._format_protocol_text(text_chunk)
                    except json.JSONDecodeError:
                        continue

    def _format_protocol_text(self, text: str) -> str:
        """Format text chunk for Vercel AI SDK Data Stream Protocol (v1)."""
        # 0:{string_value}\n
        return f"0:{json.dumps(text)}\n"

    def _format_protocol_error(self, error: str) -> str:
        """Format error for Vercel AI SDK Data Stream Protocol (v1)."""
        # 3:{string_value}\n (Using 3 for error, or could use simple text)
        # Actually, let's just send it as text for now to be safe, or throw.
        # But to be proper:
        return f"0:{json.dumps('Error: ' + error)}\n"

    def _find_commits_for_window(
        self, repo_full_name: str, window: list[str]
    ) -> list[RepoCommitChunk]:
        # This is a simplified version. In reality, we might need to traverse the
        # graph or rely on authored_at.
        # For now, let's fetch all chunks for the repo and filter in python as in
        # gemini.py
        # Optimization: In a real app, we'd query by range if we had order, or
        # just fetch all (expensive).
        # Let's try to fetch by repo_full_name and filter.

        all_chunks = (
            self._session.query(RepoCommitChunk)
            .filter_by(repo_full_name=repo_full_name)
            .order_by(RepoCommitChunk.authored_at.asc())
            .all()
        )

        start_sha, end_sha = window
        found = []
        in_window = False

        for chunk in all_chunks:
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

    async def _call_gemini(self, prompt: str) -> str:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generation_config": {
                "temperature": 0.4,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
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

                data = response.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    return "I'm sorry, I couldn't generate a response."

                return (
                    candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
                )
        except Exception as e:
            logger.error(f"Gemini chat failed: {e}")
            return "I encountered an error while processing your request."
