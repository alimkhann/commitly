"""add user synced repos

Revision ID: 20241115_add_user_synced_repos
Revises: 20241115_add_generated_roadmaps
Create Date: 2025-11-15 10:10:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "20241115_add_user_synced_repos"
down_revision = "20241115_add_generated_roadmaps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_synced_repos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column(
            "pinned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.UniqueConstraint("user_id", "repo_full_name", name="uq_user_synced_repo"),
    )
    op.create_index(
        "ix_user_synced_repos_user_id",
        "user_synced_repos",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_synced_repos_user_id", table_name="user_synced_repos")
    op.drop_table("user_synced_repos")
