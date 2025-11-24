"""Redis cache helpers for roadmap generation."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.core.config import settings
from redis import asyncio as redis_async
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class RedisJSONCache:
    """Thin wrapper around Redis for JSON payloads."""

    def __init__(self, url: Optional[str]) -> None:
        self._url = url
        self._client: Optional[redis_async.Redis] = None

    async def _get_client(self) -> Optional[redis_async.Redis]:
        if not self._url:
            return None
        if self._client is None:
            self._client = redis_async.from_url(
                self._url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._client

    async def get(self, key: str) -> Optional[dict[str, Any]]:
        client = await self._get_client()
        if client is None:
            return None
        try:
            raw = await client.get(key)
        except RedisError as exc:  # pragma: no cover - network failure
            logger.warning("Redis GET failed", exc_info=exc, extra={"key": key})
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Redis cache entry is not valid JSON", extra={"key": key})
            return None

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        client = await self._get_client()
        if client is None:
            return
        try:
            payload = json.dumps(value)
            await client.set(key, payload, ex=max(1, ttl_seconds))
        except (TypeError, ValueError) as exc:
            logger.warning("Failed to serialize cache payload", exc_info=exc)
        except RedisError as exc:  # pragma: no cover - network failure
            logger.warning("Redis SET failed", exc_info=exc, extra={"key": key})

    async def invalidate(self, key: str) -> None:
        client = await self._get_client()
        if client is None:
            return
        try:
            await client.delete(key)
        except RedisError as exc:  # pragma: no cover - network failure
            logger.warning("Redis DEL failed", exc_info=exc, extra={"key": key})

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


def get_cache_backend() -> RedisJSONCache:
    return RedisJSONCache(settings.redis_url)


# Singleton cache for application use
redis_cache = RedisJSONCache(settings.redis_url)
