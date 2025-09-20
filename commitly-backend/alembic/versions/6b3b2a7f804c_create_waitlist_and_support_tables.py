"""Create waitlist and support tables

Revision ID: 6b3b2a7f804c
Revises:
Create Date: 2025-09-20 20:12:29.705976

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6b3b2a7f804c"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False, server_default="landing"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("email", name="uq_waitlist_email"),
    )
    op.create_index("ix_waitlist_email", "waitlist", ["email"], unique=False)

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

    # Enable RLS
    op.execute("ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE support ENABLE ROW LEVEL SECURITY;")

    # Policies for anon role
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist' AND policyname = 'Allow public insert on waitlist'
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
                SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist' AND policyname = 'Allow public select count on waitlist'
            ) THEN
                CREATE POLICY "Allow public select count on waitlist"
                ON waitlist FOR SELECT
                USING (true);
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
    op.execute("DROP FUNCTION IF EXISTS public.waitlist_count();")

    op.execute("DROP POLICY IF EXISTS \"Allow public insert on support\" ON support;")
    op.execute("DROP POLICY IF EXISTS \"Allow public select on support\" ON support;")
    op.execute("DROP POLICY IF EXISTS \"Allow public insert on waitlist\" ON waitlist;")
    op.execute("DROP POLICY IF EXISTS \"Allow public select count on waitlist\" ON waitlist;")

    op.drop_index("ix_support_status", table_name="support")
    op.drop_index("ix_support_email", table_name="support")
    op.drop_table("support")

    op.drop_index("ix_waitlist_email", table_name="waitlist")
    op.drop_table("waitlist")
