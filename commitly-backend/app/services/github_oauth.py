from __future__ import annotations

import secrets
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx

from app.core.cache import redis_cache
from app.core.config import settings

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
USER_URL = "https://api.github.com/user"
STATE_PREFIX = "github_oauth_state:"
STATE_TTL_SECONDS = 600


class GitHubOAuthError(Exception):
    """Raised when the OAuth exchange fails."""


async def create_state(clerk_user_id: str, return_to: Optional[str] = None) -> str:
    state = secrets.token_urlsafe(32)
    await redis_cache.set(
        f"{STATE_PREFIX}{state}",
        {"user_id": clerk_user_id, "redirect": return_to},
        STATE_TTL_SECONDS,
    )
    return state


def build_authorize_url(state: str) -> str:
    if not settings.github_oauth_client_id:
        raise GitHubOAuthError("GitHub OAuth client ID is not configured")
    params = {
        "client_id": settings.github_oauth_client_id,
        "scope": settings.github_oauth_scope,
        "state": state,
    }
    if settings.github_oauth_redirect_uri:
        params["redirect_uri"] = str(settings.github_oauth_redirect_uri)
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def load_state(state: str) -> Optional[Dict[str, Any]]:
    return await redis_cache.get(f"{STATE_PREFIX}{state}")


async def exchange_code_for_token(code: str) -> Dict[str, Any]:
    if not settings.github_oauth_client_id or not settings.github_oauth_client_secret:
        raise GitHubOAuthError("GitHub OAuth credentials are not configured")
    data = {
        "client_id": settings.github_oauth_client_id,
        "client_secret": settings.github_oauth_client_secret,
        "code": code,
    }
    if settings.github_oauth_redirect_uri:
        data["redirect_uri"] = str(settings.github_oauth_redirect_uri)
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            TOKEN_URL, data=data, headers={"Accept": "application/json"}
        )
    response.raise_for_status()
    payload = response.json()
    if "access_token" not in payload:
        raise GitHubOAuthError("GitHub did not return an access token")
    return payload


async def fetch_user(access_token: str) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(USER_URL, headers=headers)
    response.raise_for_status()
    return response.json()
