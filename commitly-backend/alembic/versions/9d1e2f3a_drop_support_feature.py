"""Drop support feature (table, policies, indexes)

Revision ID: 9d1e2f3a
Revises: 6b3b2a7f804c
Create Date: 2025-09-22

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d1e2f3a"
down_revision: Union[str, Sequence[str], None] = "6b3b2a7f804c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop policies if they exist
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support' AND policyname = 'Allow public insert on support'
            ) THEN
                DROP POLICY "Allow public insert on support" ON public.support;
            END IF;
            IF EXISTS (
                SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support' AND policyname = 'Allow public select on support'
            ) THEN
                DROP POLICY "Allow public select on support" ON public.support;
            END IF;
        END
        $$;
        """
    )

    # Drop indexes if they exist
    op.execute("DROP INDEX IF EXISTS ix_support_email;")
    op.execute("DROP INDEX IF EXISTS ix_support_status;")

    # Drop table if exists
    op.execute("DROP TABLE IF EXISTS public.support;")


def downgrade() -> None:
    # Re-create table
    op.create_table(
        "support",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="new"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index("ix_support_email", "support", ["email"], unique=False)
    op.create_index("ix_support_status", "support", ["status"], unique=False)

    # Enable RLS and restore policies
    op.execute("ALTER TABLE support ENABLE ROW LEVEL SECURITY;")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support' AND policyname = 'Allow public insert on support'
            ) THEN
                CREATE POLICY "Allow public insert on support"
                ON support FOR INSERT
                WITH CHECK (true);
            END IF;
        END
        $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support' AND policyname = 'Allow public select on support'
            ) THEN
                CREATE POLICY "Allow public select on support"
                ON support FOR SELECT
                USING (true);
            END IF;
        END
        $$;
        """
    )