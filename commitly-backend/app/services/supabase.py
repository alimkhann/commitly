import logging
from dataclasses import dataclass

from app.models.waitlist import Waitlist, WaitlistCreate
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session


class ServiceError(Exception):
    """Base class for domain service errors."""


@dataclass
class DuplicateEntryError(ServiceError):
    field: str


class PersistenceError(ServiceError):
    """Raised when the database returns an unexpected error."""


logger = logging.getLogger(__name__)


class SupabaseService:
    """Encapsulates write/read operations against the Supabase Postgres database."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add_to_waitlist(
        self, payload: WaitlistCreate, requested_by: str | None = None
    ) -> Waitlist:
        entry = Waitlist(email=payload.email, source=payload.source)
        self.session.add(entry)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise DuplicateEntryError(field="email") from exc
        except SQLAlchemyError as exc:
            self.session.rollback()
            raise PersistenceError(str(exc)) from exc

        self.session.refresh(entry)
        if requested_by:
            logger.info(
                "Waitlist entry created",
                extra={"email": entry.email, "requested_by": requested_by},
            )
        return entry

    def waitlist_count(self) -> int:
        stmt = select(func.count(Waitlist.id))
        try:
            result = self.session.execute(stmt).scalar_one()
        except SQLAlchemyError as exc:
            raise PersistenceError(str(exc)) from exc
        return result
