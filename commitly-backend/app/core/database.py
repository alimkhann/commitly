from collections.abc import Generator
import logging

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


logger = logging.getLogger(__name__)

db_url = make_url(settings.database_url)
connect_args: dict[str, object] = {}
if "psycopg" in db_url.drivername:
    # Disable psycopg3 auto-prepared statements to avoid duplicate statement
    # errors when pooled connections are reused across threads.
    connect_args["prepare_threshold"] = None
    logger.info("psycopg driver detected: disabling prepared statements")

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """Provide a transactional scope around a series of operations."""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error in get_db: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()
