"""attach user-selected context packs to conversations

Revision ID: b43e1ad0c6f2
Revises: a82ce1d94f21
Create Date: 2026-10-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b43e1ad0c6f2"
down_revision: Union[str, None] = "a82ce1d94f21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    with op.batch_alter_table("conversations") as batch_op:
        batch_op.add_column(sa.Column("context_pack_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key("fk_conversations_context_pack_id_context_packs", "context_packs", ["context_pack_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_conversations_context_pack_id", ["context_pack_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("conversations") as batch_op:
        batch_op.drop_index("ix_conversations_context_pack_id")
        batch_op.drop_constraint("fk_conversations_context_pack_id_context_packs", type_="foreignkey")
        batch_op.drop_column("context_pack_id")
