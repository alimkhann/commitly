"""fix_missing_user_repo_columns

Revision ID: aae1346a34e5
Revises: add_view_tracker
Create Date: 2025-11-20 22:13:47.814603

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aae1346a34e5'
down_revision = 'add_view_tracker'
branch_labels = None
depends_on = None


def upgrade() -> None:
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
    op.drop_column("user_synced_repos", "updated_at")
    op.drop_column("user_synced_repos", "created_at")
    op.drop_column("user_synced_repos", "progress_percent")
    op.drop_column("user_synced_repos", "is_archived")
    op.drop_column("user_synced_repos", "status")
