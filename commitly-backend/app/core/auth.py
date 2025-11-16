from __future__ import annotations

from threading import RLock
import time
from typing import Any, Dict, List, Optional, TypedDict, cast
from urllib.parse import urlparse

from fastapi import HTTPException, Request, status
import httpx
from jose import jwk, jwt
from jose.exceptions import JWTError
from jose.utils import base64url_decode
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.config import Settings, settings


def _normalize_party(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme:
        netloc = parsed.netloc.rstrip("/")
        path = parsed.path.rstrip("/")
        return f"{netloc}{path}" if path else netloc
    return value.rstrip("/")


class ClerkClaims(TypedDict, total=False):
    sub: str
    sid: str
    iss: str
    aud: str | List[str]
    azp: str
    email: str
    exp: int
    nbf: int
    iat: int


class InvalidClerkToken(Exception):
    """Raised when Clerk token verification fails."""


class MissingBearerToken(InvalidClerkToken):
    """Raised when the Authorization header is absent."""


class JWKSCache:
    """Thread-safe JWKS cache with a simple TTL."""

    def __init__(self, jwks_url: str, ttl_seconds: int) -> None:
        self.jwks_url = jwks_url
        self.ttl_seconds = ttl_seconds
        self._jwks: Optional[Dict[str, Any]] = None
        self._expires_at: float = 0.0
        self._lock = RLock()

    async def _fetch_async(self) -> Dict[str, Any]:
        """Fetch JWKS using async HTTP client."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(str(self.jwks_url))
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:  # pragma: no cover - network failure
            raise InvalidClerkToken("Failed to download Clerk JWKS") from exc

        if not isinstance(payload, dict) or "keys" not in payload:
            raise InvalidClerkToken("JWKS payload is missing keys")
        return payload

    def _fetch(self) -> Dict[str, Any]:
        """Sync fetch for backwards compatibility."""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(str(self.jwks_url))
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:  # pragma: no cover - network failure
            raise InvalidClerkToken("Failed to download Clerk JWKS") from exc

        if not isinstance(payload, dict) or "keys" not in payload:
            raise InvalidClerkToken("JWKS payload is missing keys")
        return payload

    async def _current_jwks_async(self) -> Dict[str, Any]:
        """Async version that fetches JWKS if needed."""
        with self._lock:
            now = time.monotonic()
            if self._jwks and now < self._expires_at:
                return self._jwks
        
        # Fetch outside the lock to avoid blocking
        fresh_jwks = await self._fetch_async()
        
        with self._lock:
            self._jwks = fresh_jwks
            self._expires_at = time.monotonic() + max(self.ttl_seconds, 60)
            return self._jwks

    def _current_jwks(self) -> Dict[str, Any]:
        with self._lock:
            now = time.monotonic()
            if self._jwks and now < self._expires_at:
                return self._jwks
            self._jwks = self._fetch()
            self._expires_at = now + max(self.ttl_seconds, 60)
            return self._jwks

    async def get_key_async(self, kid: str) -> Dict[str, Any]:
        """Async version of get_key."""
        jwks = await self._current_jwks_async()
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return cast(Dict[str, Any], key)
        raise InvalidClerkToken("No matching JWK for supplied token")

    def get_key(self, kid: str) -> Dict[str, Any]:
        jwks = self._current_jwks()
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return cast(Dict[str, Any], key)
        raise InvalidClerkToken("No matching JWK for supplied token")

    def prime(self, jwks: Dict[str, Any]) -> None:
        """Seed the cache (useful for tests)."""

        with self._lock:
            self._jwks = jwks
            self._expires_at = time.monotonic() + max(self.ttl_seconds, 60)


jwks_cache = JWKSCache(settings.clerk_jwks_url, settings.clerk_jwks_cache_seconds)


def _get_bearer_token(request: Request) -> str:
    header_value = request.headers.get("authorization")
    if not header_value:
        raise MissingBearerToken("Missing Authorization header")

    scheme, _, token = header_value.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise InvalidClerkToken("Authorization header must be a Bearer token")

    return token.strip()


def _select_audience(aud_claim: Any) -> List[str]:
    if aud_claim is None:
        return []
    if isinstance(aud_claim, str):
        return [aud_claim]
    if isinstance(aud_claim, list):
        return [value for value in aud_claim if isinstance(value, str)]
    return []


def verify_clerk_token(token: str) -> ClerkClaims:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise InvalidClerkToken("Malformed token header") from exc

    kid = header.get("kid")
    if not isinstance(kid, str):
        raise InvalidClerkToken("Missing key identifier")

    jwk_data = jwks_cache.get_key(kid)
    public_key = jwk.construct(jwk_data)

    try:
        message, encoded_signature = token.rsplit(".", 1)
    except ValueError as exc:
        raise InvalidClerkToken("Token structure is invalid") from exc

    decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))
    if not public_key.verify(message.encode("utf-8"), decoded_signature):
        raise InvalidClerkToken("Signature verification failed")

    claims = jwt.get_unverified_claims(token)
    now = int(time.time())

    exp = claims.get("exp")
    if exp is not None and int(exp) <= now:
        raise InvalidClerkToken("Token has expired")

    nbf = claims.get("nbf")
    if nbf is not None and now < int(nbf):
        raise InvalidClerkToken("Token is not yet valid")

    issuer = claims.get("iss")
    if issuer != settings.clerk_issuer:
        raise InvalidClerkToken("Invalid issuer")

    audience_values = _select_audience(claims.get("aud"))
    allowed_audiences = Settings._coerce_list(settings.clerk_audience) or [
        settings.clerk_audience
    ]
    if audience_values:
        if not any(audience in audience_values for audience in allowed_audiences):
            raise InvalidClerkToken("Invalid audience")

    if settings.clerk_authorized_parties:
        azp = claims.get("azp")
        if isinstance(azp, str):
            normalized_azp = _normalize_party(azp)
            allowed = {
                _normalize_party(party) for party in settings.clerk_authorized_parties
            }
            if "*" not in allowed and normalized_azp not in allowed:
                raise InvalidClerkToken("Token not issued for this application")
        else:
            raise InvalidClerkToken("Token missing authorized party")

    if "sub" not in claims:
        raise InvalidClerkToken("Token is missing subject claim")

    return cast(ClerkClaims, claims)


async def verify_clerk_token_async(token: str) -> ClerkClaims:
    """Async version of verify_clerk_token that doesn't block the event loop."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise InvalidClerkToken("Malformed token header") from exc

    kid = header.get("kid")
    if not isinstance(kid, str):
        raise InvalidClerkToken("Missing key identifier")

    # Use async version to avoid blocking
    jwk_data = await jwks_cache.get_key_async(kid)
    public_key = jwk.construct(jwk_data)

    try:
        message, encoded_signature = token.rsplit(".", 1)
    except ValueError as exc:
        raise InvalidClerkToken("Token structure is invalid") from exc

    decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))
    if not public_key.verify(message.encode("utf-8"), decoded_signature):
        raise InvalidClerkToken("Signature verification failed")

    claims = jwt.get_unverified_claims(token)
    now = int(time.time())

    exp = claims.get("exp")
    if exp is not None and int(exp) <= now:
        raise InvalidClerkToken("Token has expired")

    nbf = claims.get("nbf")
    if nbf is not None and now < int(nbf):
        raise InvalidClerkToken("Token is not yet valid")

    issuer = claims.get("iss")
    if issuer != settings.clerk_issuer:
        raise InvalidClerkToken("Invalid issuer")

    audience_values = _select_audience(claims.get("aud"))
    allowed_audiences = Settings._coerce_list(settings.clerk_audience) or [
        settings.clerk_audience
    ]
    if audience_values:
        if not any(audience in audience_values for audience in allowed_audiences):
            raise InvalidClerkToken("Invalid audience")

    if settings.clerk_authorized_parties:
        azp = claims.get("azp")
        if isinstance(azp, str):
            normalized_azp = _normalize_party(azp)
            allowed = {
                _normalize_party(party) for party in settings.clerk_authorized_parties
            }
            if "*" not in allowed and normalized_azp not in allowed:
                raise InvalidClerkToken("Token not issued for this application")
        else:
            raise InvalidClerkToken("Token missing authorized party")

    if "sub" not in claims:
        raise InvalidClerkToken("Token is missing subject claim")

    return cast(ClerkClaims, claims)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_clerk_auth(request: Request) -> ClerkClaims:
    cached: Optional[ClerkClaims] = getattr(request.state, "clerk_claims", None)
    if cached:
        return cached

    existing_error: Optional[InvalidClerkToken] = getattr(
        request.state, "clerk_auth_error", None
    )
    if existing_error is not None:
        raise _unauthorized("Invalid authentication token") from existing_error

    try:
        token = _get_bearer_token(request)
        claims = verify_clerk_token(token)
    except MissingBearerToken as exc:
        raise _unauthorized("Missing authentication token") from exc
    except InvalidClerkToken as exc:
        raise _unauthorized("Invalid authentication token") from exc

    request.state.clerk_claims = claims
    return claims


def optional_clerk_auth(request: Request) -> Optional[ClerkClaims]:
    """
    Optional Clerk authentication dependency.

    Returns ClerkClaims if a valid token is present, otherwise None.
    Does not raise exceptions for missing or invalid tokens.

    This is useful for endpoints that should work for both authenticated
    and unauthenticated users.
    """
    cached: Optional[ClerkClaims] = getattr(request.state, "clerk_claims", None)
    if cached:
        return cached

    try:
        token = _get_bearer_token(request)
        claims = verify_clerk_token(token)
        request.state.clerk_claims = claims
        return claims
    except (MissingBearerToken, InvalidClerkToken):
        return None


class ClerkAuthMiddleware(BaseHTTPMiddleware):
    """Pre-decodes Clerk tokens so downstream dependencies can reuse them."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ):  # type: ignore[override]
        token: Optional[str]
        try:
            token = _get_bearer_token(request)
        except MissingBearerToken:
            token = None
        except InvalidClerkToken as exc:
            request.state.clerk_auth_error = exc
            token = None

        if token:
            try:
                # Use async version to avoid blocking the event loop
                request.state.clerk_claims = await verify_clerk_token_async(token)
            except InvalidClerkToken as exc:
                request.state.clerk_auth_error = exc

        response = await call_next(request)
        return response
