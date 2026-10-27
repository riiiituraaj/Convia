"""add conversation message idempotency

Revision ID: c31f0bd72a14
Revises: d11440586bcc
Create Date: 2026-10-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c31f0bd72a14"
down_revision: Union[str, None] = "d11440586bcc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("messages") as batch_op:
        batch_op.add_column(sa.Column("client_message_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("reply_to_message_id", sa.String(length=36), nullable=True))
        batch_op.create_index("ix_messages_reply_to_message_id", ["reply_to_message_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_messages_reply_to_message_id_messages",
            "messages",
            ["reply_to_message_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_unique_constraint(
            "uq_messages_conversation_client_id", ["conversation_id", "client_message_id"]
        )
        batch_op.create_unique_constraint("uq_messages_reply_to_message", ["reply_to_message_id"])


def downgrade() -> None:
    with op.batch_alter_table("messages") as batch_op:
        batch_op.drop_constraint("uq_messages_reply_to_message", type_="unique")
        batch_op.drop_constraint("uq_messages_conversation_client_id", type_="unique")
        batch_op.drop_constraint("fk_messages_reply_to_message_id_messages", type_="foreignkey")
        batch_op.drop_index("ix_messages_reply_to_message_id")
        batch_op.drop_column("reply_to_message_id")
        batch_op.drop_column("client_message_id")
