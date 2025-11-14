from __future__ import annotations

from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from app.core.auth import ClerkClaims, require_clerk_auth
from app.core.config import settings
from app.core.database import get_db
from app.services.github_oauth import (
    GitHubOAuthError,
    build_authorize_url,
    create_state,
    exchange_code_for_token,
    fetch_user,
    load_state,
)
from app.services.github_tokens import GitHubTokenStore

router = APIRouter(prefix="/github", tags=["github"])


class OAuthStartResponse(BaseModel):
    authorize_url: HttpUrl


class OAuthStatusResponse(BaseModel):
    connected: bool
    github_login: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None


@router.post("/oauth/start", response_model=OAuthStartResponse)
async def start_oauth_flow(
    body: dict | None = None,
    current_user: ClerkClaims = Depends(require_clerk_auth),
):
    return_to: Optional[str] = None
    if body and isinstance(body, dict):
        return_to = body.get("return_to")
    state = await create_state(current_user["sub"], return_to)
    try:
        authorize_url = build_authorize_url(state)
    except GitHubOAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        )
    return OAuthStartResponse(authorize_url=authorize_url)


@router.get("/oauth/status", response_model=OAuthStatusResponse)
async def github_status(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    session: Session = Depends(get_db),
):
    store = GitHubTokenStore(session)
    record = store.get_token(current_user["sub"])
    if record is None:
        return OAuthStatusResponse(connected=False)
    return OAuthStatusResponse(
        connected=True,
        github_login=record.github_login,
        avatar_url=record.github_avatar_url,
    )


@router.delete("/oauth/token", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_github(
    current_user: ClerkClaims = Depends(require_clerk_auth),
    session: Session = Depends(get_db),
):
    store = GitHubTokenStore(session)
    store.delete(current_user["sub"])
    return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)


@router.get("/oauth/callback")
async def oauth_callback(state: str, code: str, session: Session = Depends(get_db)):
    state_payload = await load_state(state)
    if not state_payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    try:
        token_payload = await exchange_code_for_token(code)
    except (GitHubOAuthError, HTTPException) as exc:  # type: ignore[arg-type]
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    access_token = token_payload.get("access_token")
    token_type = token_payload.get("token_type", "bearer")
    scope = token_payload.get("scope", settings.github_oauth_scope)
    user_payload = await fetch_user(access_token)
    store = GitHubTokenStore(session)
    store.upsert(
        clerk_user_id=state_payload["user_id"],
        access_token=access_token,
        token_type=token_type,
        scope=scope,
        github_user_id=user_payload.get("id", 0),
        github_login=user_payload.get("login", "unknown"),
        github_avatar_url=user_payload.get("avatar_url"),
        github_name=user_payload.get("name"),
    )
    redirect_target = state_payload.get("redirect") or (
        str(settings.github_oauth_success_redirect)
        if settings.github_oauth_success_redirect
        else "/"
    )
    separator = "&" if "?" in redirect_target else "?"
    final_url = f"{redirect_target}{separator}{urlencode({'status': 'success'})}"
    return RedirectResponse(url=final_url)
