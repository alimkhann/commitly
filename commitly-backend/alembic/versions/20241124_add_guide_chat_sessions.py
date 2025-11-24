"""add guide chat sessions table

Revision ID: 20241124_add_guide_chat_sessions
Revises: aae1346a34e5
Create Date: 2025-11-24 19:20:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20241124_add_guide_chat_sessions"
down_revision = "aae1346a34e5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "guide_chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column("stage_id", sa.String(length=255), nullable=True),
        sa.Column("messages", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id",
            "repo_full_name",
            "stage_id",
            name="uq_guide_chat_user_repo_stage",
        ),
    )
    op.create_index("ix_guide_chat_sessions_user", "guide_chat_sessions", ["user_id"])
    op.create_index(
        "ix_guide_chat_sessions_repo", "guide_chat_sessions", ["repo_full_name"]
    )
    op.create_index("ix_guide_chat_sessions_stage", "guide_chat_sessions", ["stage_id"])


def downgrade():
    op.drop_index("ix_guide_chat_sessions_stage", table_name="guide_chat_sessions")
    op.drop_index("ix_guide_chat_sessions_repo", table_name="guide_chat_sessions")
    op.drop_index("ix_guide_chat_sessions_user", table_name="guide_chat_sessions")
    op.drop_table("guide_chat_sessions")
