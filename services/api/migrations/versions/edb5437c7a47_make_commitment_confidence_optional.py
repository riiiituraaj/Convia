"""make commitment confidence optional

Revision ID: edb5437c7a47
Revises: 4eab407e4ae7
Create Date: 2026-10-26 16:30:06.923557
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'edb5437c7a47'
down_revision: Union[str, None] = '4eab407e4ae7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("commitments") as batch_op:
        batch_op.alter_column("confidence", existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    raise RuntimeError(
        "Commitment confidence can now be unknown. Downgrading to a required value would "
        "either lose that state or require inventing a score; write a reviewed forward migration."
    )
