"""upgrade roadmap metadata and user repo state

Revision ID: 20241116_upgrade_roadmaps_and_user_repo_state
Revises: 20241115_add_user_synced_repos
Create Date: 2025-11-16 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20241116_upgrade_roadmaps_and_user_repo_state"
down_revision = "20241115_add_user_synced_repos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Generated roadmap metadata extensions
    op.add_column(
        "generated_roadmaps",
        sa.Column("primary_language", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "generated_roadmaps", sa.Column("languages", sa.JSON(), nullable=True)
    )
    op.add_column("generated_roadmaps", sa.Column("topics", sa.JSON(), nullable=True))
    op.add_column(
        "generated_roadmaps",
        sa.Column("difficulty", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "star_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "fork_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column("last_pushed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column("license", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "contributor_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "view_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "sync_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "rating_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.add_column(
        "generated_roadmaps",
        sa.Column(
            "rating_sum", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )

    # User repo state enhancements
    op.add_column(
        "user_synced_repos",
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="synced"
        ),
    )
    op.add_column(
        "user_synced_repos",
        sa.Column(
            "is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "user_synced_repos",
        sa.Column(
            "progress_percent",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "user_synced_repos",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "user_synced_repos",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )


def downgrade() -> None:
    # User repo state
    op.drop_column("user_synced_repos", "updated_at")
    op.drop_column("user_synced_repos", "created_at")
    op.drop_column("user_synced_repos", "progress_percent")
    op.drop_column("user_synced_repos", "is_archived")
    op.drop_column("user_synced_repos", "status")

    # Generated roadmap metadata
    op.drop_column("generated_roadmaps", "rating_sum")
    op.drop_column("generated_roadmaps", "rating_count")
    op.drop_column("generated_roadmaps", "sync_count")
    op.drop_column("generated_roadmaps", "view_count")
    op.drop_column("generated_roadmaps", "contributor_count")
    op.drop_column("generated_roadmaps", "license")
    op.drop_column("generated_roadmaps", "last_pushed_at")
    op.drop_column("generated_roadmaps", "fork_count")
    op.drop_column("generated_roadmaps", "star_count")
    op.drop_column("generated_roadmaps", "difficulty")
    op.drop_column("generated_roadmaps", "topics")
    op.drop_column("generated_roadmaps", "languages")
    op.drop_column("generated_roadmaps", "primary_language")
