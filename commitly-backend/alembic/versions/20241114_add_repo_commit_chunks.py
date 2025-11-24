"""Add repo_commit_chunks table

Revision ID: 20241114_add_repo_chunks
Revises: 6b3b2a7f804c
Create Date: 2025-11-14 15:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20241114_add_repo_chunks"
down_revision: Union[str, Sequence[str], None] = "9d1e2f3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "repo_commit_chunks" in inspector.get_table_names():
        return
    op.create_table(
        "repo_commit_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column("commit_sha", sa.String(length=40), nullable=False),
        sa.Column("chunk_type", sa.String(length=32), nullable=False),
        sa.Column("chunk_hash", sa.String(length=64), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("authored_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("chunk_hash", name="uq_repo_commit_chunk_hash"),
    )
    op.create_index(
        "ix_repo_commit_chunks_repo",
        "repo_commit_chunks",
        ["repo_full_name"],
        unique=False,
    )
    op.create_index(
        "ix_repo_commit_chunks_sha",
        "repo_commit_chunks",
        ["commit_sha"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_repo_commit_chunks_sha", table_name="repo_commit_chunks")
    op.drop_index("ix_repo_commit_chunks_repo", table_name="repo_commit_chunks")
    op.drop_table("repo_commit_chunks")
