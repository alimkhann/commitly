"""Placeholder for legacy revision 9d1e2f3a

Revision ID: 9d1e2f3a
Revises: 6b3b2a7f804c
Create Date: 2025-11-14 19:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa  # noqa: F401
from alembic import op  # noqa: F401

revision: str = "9d1e2f3a"
down_revision: Union[str, Sequence[str], None] = "6b3b2a7f804c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Legacy migration replaced by later revisions."""
    pass


def downgrade() -> None:
    pass
