"""add roadmap view tracker table

Revision ID: add_view_tracker
Revises: 20241116_add_roadmap_ratings_table
Create Date: 2024-11-16 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_view_tracker"
down_revision: Union[str, None] = "20241116_add_roadmap_ratings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create roadmap_view_tracker table for anti-spam view counting."""
    op.create_table(
        "roadmap_view_tracker",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "repo_full_name", "user_id", name="uq_roadmap_view_tracker_repo_user"
        ),
    )
    op.create_index(
        "idx_roadmap_view_tracker_viewed_at",
        "roadmap_view_tracker",
        ["viewed_at"],
    )


def downgrade() -> None:
    """Drop roadmap_view_tracker table."""
    op.drop_index(
        "idx_roadmap_view_tracker_viewed_at", table_name="roadmap_view_tracker"
    )
    op.drop_table("roadmap_view_tracker")
