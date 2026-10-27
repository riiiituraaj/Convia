"""store encrypted Google Workspace credentials on integrations

Revision ID: c6d4e8a219af
Revises: b43e1ad0c6f2
Create Date: 2026-10-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c6d4e8a219af"
down_revision: Union[str, None] = "b43e1ad0c6f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("integrations", sa.Column("credentials_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("integrations", "credentials_encrypted")
