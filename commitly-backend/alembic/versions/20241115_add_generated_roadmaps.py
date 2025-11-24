"""add generated roadmaps table

Revision ID: 20241115_add_generated_roadmaps
Revises: 20241114_add_github_creds
Create Date: 2025-11-15 07:40:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241115_add_generated_roadmaps"
down_revision = "20241114_add_github_creds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "generated_roadmaps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repo_full_name", sa.String(length=255), nullable=False),
        sa.Column("repo_summary", sa.JSON(), nullable=False),
        sa.Column("timeline", sa.JSON(), nullable=False),
        sa.Column(
            "cached", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.UniqueConstraint("repo_full_name", name="uq_generated_roadmap_full_name"),
    )


def downgrade() -> None:
    op.drop_table("generated_roadmaps")
