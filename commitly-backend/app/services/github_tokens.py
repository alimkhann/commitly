from __future__ import annotations

from typing import Optional

from app.models.github_token import GitHubCredential
from sqlalchemy.orm import Session


class GitHubTokenStore:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(
        self,
        *,
        clerk_user_id: str,
        access_token: str,
        token_type: str,
        scope: str,
        github_user_id: int,
        github_login: str,
        github_avatar_url: str | None = None,
        github_name: str | None = None,
    ) -> GitHubCredential:
        record = (
            self.session.query(GitHubCredential)
            .filter_by(clerk_user_id=clerk_user_id)
            .one_or_none()
        )
        if record is None:
            record = GitHubCredential(
                clerk_user_id=clerk_user_id,
                access_token=access_token,
                token_type=token_type,
                scope=scope,
                github_user_id=github_user_id,
                github_login=github_login,
                github_avatar_url=github_avatar_url,
                github_name=github_name,
            )
            self.session.add(record)
        else:
            record.access_token = access_token
            record.token_type = token_type
            record.scope = scope
            record.github_user_id = github_user_id
            record.github_login = github_login
            record.github_avatar_url = github_avatar_url
            record.github_name = github_name
        self.session.commit()
        self.session.refresh(record)
        return record

    def get_token(self, clerk_user_id: str) -> Optional[GitHubCredential]:
        return (
            self.session.query(GitHubCredential)
            .filter_by(clerk_user_id=clerk_user_id)
            .one_or_none()
        )

    def delete(self, clerk_user_id: str) -> bool:
        record = (
            self.session.query(GitHubCredential)
            .filter_by(clerk_user_id=clerk_user_id)
            .one_or_none()
        )
        if record is None:
            return False
        self.session.delete(record)
        self.session.commit()
        return True
