"""Create waitlist table and policies

Revision ID: 6b3b2a7f804c
Revises:
Create Date: 2025-09-20 20:12:29.705976

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "6b3b2a7f804c"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "source", sa.String(length=100), nullable=False, server_default="landing"
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("email", name="uq_waitlist_email"),
    )
    op.create_index("ix_waitlist_email", "waitlist", ["email"], unique=False)

    # Enable RLS on waitlist so policies take effect.
    op.execute("ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;")

    # Policies for anon role
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                AND tablename = 'waitlist'
                AND policyname = 'Allow public insert on waitlist'
            ) THEN
                CREATE POLICY "Allow public insert on waitlist"
                ON waitlist FOR INSERT
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
                SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                AND tablename = 'waitlist'
                AND policyname = 'Allow public select count on waitlist'
            ) THEN
                CREATE POLICY "Allow public select count on waitlist"
                ON waitlist FOR SELECT
                USING (true);
            END IF;
        END
        $$;
        """
    )

    # RPC helper for Supabase client (.rpc("waitlist_count"))
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.waitlist_count()
        RETURNS integer
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT COUNT(*)::integer FROM public.waitlist;
        $$;
        """
    )


def downgrade() -> None:
    """Downgrades are intentionally disabled to avoid losing waitlist entries."""

    raise RuntimeError("Downgrading this revision would drop waitlist data; aborting.")
