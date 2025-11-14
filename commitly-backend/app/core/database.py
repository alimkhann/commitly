from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


connect_args: dict[str, object] = {}
if settings.database_url.startswith("postgresql+psycopg"):
    # Psycopg's prepared statements can leak when reusing connections across
    # threads (Render reuses pooled connections). Disable prepared statements
    # entirely to avoid "DuplicatePreparedStatement" errors from the server.
    connect_args["prepare_threshold"] = 0

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """Provide a transactional scope around a series of operations."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
