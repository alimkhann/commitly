from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import logging
from typing import Iterable

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.roadmap import RepoCommitChunk

logger = logging.getLogger(__name__)

MAX_CHUNK_SIZE = 20_000  # characters


class ChunkStorageError(Exception):
    pass


@dataclass(slots=True)
class CommitChunk:
    repo_full_name: str
    commit_sha: str
    chunk_type: str
    content: str
    authored_at: datetime | None


class CommitChunkStore:
    """Persists commit chunks so they can be embedded later."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def persist(self, chunks: Iterable[CommitChunk]) -> None:
        try:
            for chunk in chunks:
                chunk_hash = self._hash(chunk)
                exists = (
                    self._session.query(RepoCommitChunk.id)
                    .filter_by(chunk_hash=chunk_hash)
                    .first()
                )
                if exists:
                    continue
                self._session.add(
                    RepoCommitChunk(
                        repo_full_name=chunk.repo_full_name,
                        commit_sha=chunk.commit_sha,
                        chunk_type=chunk.chunk_type,
                        chunk_hash=chunk_hash,
                        content=chunk.content[:MAX_CHUNK_SIZE],
                        authored_at=chunk.authored_at,
                    )
                )
            self._session.commit()
        except SQLAlchemyError as exc:  # pragma: no cover - DB failure
            self._session.rollback()
            logger.exception("Failed to persist commit chunks")
            raise ChunkStorageError("Unable to persist commit chunks") from exc

    @staticmethod
    def _hash(chunk: CommitChunk) -> str:
        digest = hashlib.sha256()
        digest.update(chunk.repo_full_name.encode("utf-8"))
        digest.update(chunk.commit_sha.encode("utf-8"))
        digest.update(chunk.chunk_type.encode("utf-8"))
        return digest.hexdigest()
