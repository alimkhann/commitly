"""add roadmap ratings table

Revision ID: 20241116_add_roadmap_ratings
Revises: 20241116_upgrade_roadmaps_and_user_repo_state
Create Date: 2025-11-16 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20241116_add_roadmap_ratings"
down_revision: Union[str, None] = "20241116_upgrade_roadmaps_and_user_repo_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "roadmap_ratings" in inspector.get_table_names():
        return

    op.create_table(
        "roadmap_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id", "repo_full_name", name="uq_roadmap_rating_user_repo"
        ),
    )
    op.create_index(
        "ix_roadmap_ratings_user_id",
        "roadmap_ratings",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_roadmap_ratings_repo_full_name",
        "roadmap_ratings",
        ["repo_full_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_roadmap_ratings_repo_full_name", table_name="roadmap_ratings")
    op.drop_index("ix_roadmap_ratings_user_id", table_name="roadmap_ratings")
    op.drop_table("roadmap_ratings")
