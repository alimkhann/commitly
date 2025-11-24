"""Add GitHub credentials table

Revision ID: 20241114_add_github_creds
Revises: 20241114_add_repo_chunks
Create Date: 2025-11-14 18:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20241114_add_github_creds"
down_revision: Union[str, Sequence[str], None] = "20241114_add_repo_chunks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "github_credentials" in inspector.get_table_names():
        return
    op.create_table(
        "github_credentials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clerk_user_id", sa.String(length=255), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("token_type", sa.String(length=50), nullable=False),
        sa.Column("scope", sa.String(length=255), nullable=False),
        sa.Column("github_user_id", sa.Integer(), nullable=False),
        sa.Column("github_login", sa.String(length=255), nullable=False),
        sa.Column("github_avatar_url", sa.String(length=500), nullable=True),
        sa.Column("github_name", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("clerk_user_id", name="uq_github_credentials_clerk_user"),
    )
    op.create_index(
        "ix_github_credentials_clerk_user_id",
        "github_credentials",
        ["clerk_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_github_credentials_clerk_user_id", table_name="github_credentials"
    )
    op.drop_table("github_credentials")
