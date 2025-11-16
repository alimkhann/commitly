import base64
from collections.abc import Generator
import os
import time
from typing import Any, Dict

# Ensure required env vars are set before importing the app/settings
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SUPABASE_URL", "http://localhost:8000")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault(
    "CLERK_JWKS_URL", "https://clerk.example.com/.well-known/jwks.json"
)
os.environ.setdefault("CLERK_ISSUER", "https://clerk.example.com/")
os.environ.setdefault("CLERK_AUDIENCE", "commitly-api")
os.environ["CLERK_AUTHORIZED_PARTIES"] = '["https://app.commitly.dev"]'
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.auth import jwks_cache  # noqa: E402
from app.core.config import Settings, settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.roadmap import GeneratedRoadmap, UserSyncedRepo  # noqa: E402
from app.models.waitlist import Waitlist  # noqa: E402

# Reset schema to reflect latest models (avoids stale columns in sqlite test DB)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


TEST_JWK_KID = "test-key"


def _b64url_uint(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


@pytest.fixture(scope="session")
def clerk_keypair() -> Dict[str, Any]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key().public_numbers()
    jwk_payload = {
        "kty": "RSA",
        "alg": "RS256",
        "use": "sig",
        "kid": TEST_JWK_KID,
        "n": _b64url_uint(public_key.n),
        "e": _b64url_uint(public_key.e),
    }
    private_pem = (
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        .decode("utf-8")
        .strip()
    )
    return {"private_key": private_pem, "jwk": jwk_payload}


@pytest.fixture(scope="session", autouse=True)
def prime_jwks(clerk_keypair: Dict[str, Any]) -> Generator[None, None, None]:
    jwks_cache.prime({"keys": [clerk_keypair["jwk"]]})
    yield


@pytest.fixture()
def make_clerk_token(clerk_keypair: Dict[str, Any]):
    def _make(**overrides: Any) -> str:
        now = int(time.time())
        audiences = Settings._coerce_list(settings.clerk_audience) or [
            settings.clerk_audience
        ]
        claims: Dict[str, Any] = {
            "iss": settings.clerk_issuer,
            "aud": audiences,
            "sub": overrides.pop("sub", "user_123"),
            "sid": overrides.pop("sid", "session_abc"),
            "exp": overrides.pop("exp", now + 3600),
            "nbf": overrides.pop("nbf", now - 60),
            "iat": overrides.pop("iat", now - 60),
        }
        if settings.clerk_authorized_parties:
            claims["azp"] = overrides.pop("azp", settings.clerk_authorized_parties[0])
        claims.update(overrides)
        if claims.get("aud") is None:
            claims.pop("aud", None)

        token = jwt.encode(
            claims,
            clerk_keypair["private_key"],
            algorithm="RS256",
            headers={"kid": clerk_keypair["jwk"]["kid"]},
        )
        return token

    return _make


@pytest.fixture()
def auth_headers(make_clerk_token):
    token = make_clerk_token()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _clean_db(db_session: Session) -> Generator[None, None, None]:
    # Clean tables that we use between tests to avoid cross-test leakage
    db_session.query(UserSyncedRepo).delete()
    db_session.query(GeneratedRoadmap).delete()
    db_session.query(Waitlist).delete()
    db_session.commit()
    yield
    db_session.query(UserSyncedRepo).delete()
    db_session.query(GeneratedRoadmap).delete()
    db_session.query(Waitlist).delete()
    db_session.commit()


@pytest.fixture()
def app_with_overrides(db_session: Session):
    def _override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    return app


@pytest.fixture()
def client(app_with_overrides) -> TestClient:
    return TestClient(app_with_overrides)


@pytest.fixture()
def roadmap_service(db_session: Session):
    """Provide a RoadmapService instance for testing."""
    from unittest.mock import Mock

    from app.services.roadmap_service import RoadmapService
    from app.services.roadmap_repository import RoadmapResultStore

    # Create a real result store for testing filters
    result_store = RoadmapResultStore(db_session)

    # Mock the other dependencies since we're only testing list_catalog
    chunk_store = Mock()
    pin_store = Mock()
    generator = Mock()
    token_store = Mock()

    return RoadmapService(
        chunk_store=chunk_store,
        result_store=result_store,
        pin_store=pin_store,
        generator=generator,
        token_store=token_store,
        cache=None,
    )
