from collections.abc import Generator
import os

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine, get_db
from app.main import app
from app.models.waitlist import Waitlist

# Ensure required env vars are set before importing the app/settings
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SUPABASE_URL", "http://localhost:8000")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")

# Create tables once for the test database
Base.metadata.create_all(bind=engine)


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
    db_session.query(Waitlist).delete()
    db_session.commit()
    yield
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
