"""upgrade repository system with metadata, user state, ratings

Revision ID: 20241115_upgrade_repository_system
Revises: 20241115_add_user_synced_repos
Create Date: 2025-11-15 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20241115_upgrade_repository_system"
down_revision = "20241115_add_user_synced_repos"
branch_labels = None
depends_on = None


GENERATED_ROADMAP_COLUMNS = (
    sa.Column("primary_language", sa.String(length=128), nullable=True),
    sa.Column("languages", sa.JSON(), nullable=True),
    sa.Column("topics", sa.JSON(), nullable=True),
    sa.Column("difficulty", sa.String(length=32), nullable=True),
    sa.Column("star_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("fork_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("contributor_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("last_pushed_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("license", sa.String(length=128), nullable=True),
    sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("sync_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("rating_sum", sa.Integer(), nullable=False, server_default="0"),
)


USER_STATE_NEW_COLUMNS = (
    sa.Column(
        "status",
        sa.String(length=16),
        nullable=False,
        server_default="unsynced",
    ),
    sa.Column(
        "progress_percent",
        sa.Integer(),
        nullable=False,
        server_default="0",
    ),
    sa.Column(
        "is_archived",
        sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    ),
    sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
)


def upgrade() -> None:
    for column in GENERATED_ROADMAP_COLUMNS:
        op.add_column("generated_roadmaps", column)

    op.rename_table("user_synced_repos", "user_repo_states")
    op.alter_column(
        "user_repo_states",
        "pinned_at",
        new_column_name="created_at",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )

    for column in USER_STATE_NEW_COLUMNS:
        op.add_column("user_repo_states", column)

    op.drop_constraint(
        "uq_user_synced_repo", "user_repo_states", type_="unique"
    )
    op.create_unique_constraint(
        "uq_user_repo_state",
        "user_repo_states",
        ["user_id", "repo_full_name"],
    )

    op.rename_index(
        "ix_user_synced_repos_user_id", "ix_user_repo_states_user_id"
    )
    op.create_index(
        "ix_user_repo_states_is_archived",
        "user_repo_states",
        ["is_archived"],
    )

    op.create_table(
        "roadmap_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id", "repo_full_name", name="uq_roadmap_rating_user_repo"
        ),
    )
    op.create_index(
        "ix_roadmap_ratings_user_id", "roadmap_ratings", ["user_id"]
    )
    op.create_index(
        "ix_roadmap_ratings_repo_full_name",
        "roadmap_ratings",
        ["repo_full_name"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_roadmap_ratings_repo_full_name", table_name="roadmap_ratings"
    )
    op.drop_index("ix_roadmap_ratings_user_id", table_name="roadmap_ratings")
    op.drop_table("roadmap_ratings")

    op.drop_index("ix_user_repo_states_is_archived", table_name="user_repo_states")
    op.drop_constraint(
        "uq_user_repo_state", "user_repo_states", type_="unique"
    )
    op.create_unique_constraint(
        "uq_user_synced_repo",
        "user_repo_states",
        ["user_id", "repo_full_name"],
    )

    for column_name in (
        "updated_at",
        "last_viewed_at",
        "synced_at",
        "is_archived",
        "progress_percent",
        "status",
    ):
        op.drop_column("user_repo_states", column_name)

    op.alter_column(
        "user_repo_states",
        "created_at",
        new_column_name="pinned_at",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
    op.rename_index(
        "ix_user_repo_states_user_id", "ix_user_synced_repos_user_id"
    )
    op.rename_table("user_repo_states", "user_synced_repos")

    for column_name in (
        "rating_sum",
        "rating_count",
        "sync_count",
        "view_count",
        "license",
        "last_pushed_at",
        "contributor_count",
        "fork_count",
        "star_count",
        "difficulty",
        "topics",
        "languages",
        "primary_language",
    ):
        op.drop_column("generated_roadmaps", column_name)
