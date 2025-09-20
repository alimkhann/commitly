from dataclasses import dataclass

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.support import Support, SupportCreate
from app.models.waitlist import Waitlist, WaitlistCreate


class ServiceError(Exception):
    """Base class for domain service errors."""


@dataclass
class DuplicateEntryError(ServiceError):
    field: str


class PersistenceError(ServiceError):
    """Raised when the database returns an unexpected error."""


class SupabaseService:
    """Encapsulates write/read operations against the Supabase Postgres database."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add_to_waitlist(self, payload: WaitlistCreate) -> Waitlist:
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
        return entry

    def waitlist_count(self) -> int:
        stmt = select(func.count(Waitlist.id))
        try:
            result = self.session.execute(stmt).scalar_one()
        except SQLAlchemyError as exc:
            raise PersistenceError(str(exc)) from exc
        return result

    def create_support_request(self, payload: SupportCreate) -> Support:
        ticket = Support(email=payload.email, message=payload.message)
        self.session.add(ticket)
        try:
            self.session.commit()
        except SQLAlchemyError as exc:
            self.session.rollback()
            raise PersistenceError(str(exc)) from exc

        self.session.refresh(ticket)
        return ticket
