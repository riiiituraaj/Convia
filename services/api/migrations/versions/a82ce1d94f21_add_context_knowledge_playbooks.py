"""add user context packs, knowledge entries, and playbooks

Revision ID: a82ce1d94f21
Revises: c31f0bd72a14
Create Date: 2026-10-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a82ce1d94f21"
down_revision: Union[str, None] = "c31f0bd72a14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_workspace_table(name: str, columns: list[sa.Column]) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        *columns,
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(f"ix_{name}_user_id", name, ["user_id"], unique=False)


def upgrade() -> None:
    _create_workspace_table("context_packs", [
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("facts_json", sa.JSON(), nullable=False),
        sa.Column("constraints_json", sa.JSON(), nullable=False),
        sa.Column("questions_json", sa.JSON(), nullable=False),
        sa.Column("links_json", sa.JSON(), nullable=False),
        sa.Column("resource_refs_json", sa.JSON(), nullable=False),
        sa.Column("tags_json", sa.JSON(), nullable=False),
    ])
    _create_workspace_table("knowledge_entries", [
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("entry_type", sa.String(length=40), nullable=False),
        sa.Column("collection", sa.String(length=120), nullable=False),
        sa.Column("tags_json", sa.JSON(), nullable=False),
        sa.Column("provenance_json", sa.JSON(), nullable=False),
    ])
    _create_workspace_table("playbooks", [
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("inputs_json", sa.JSON(), nullable=False),
        sa.Column("steps_json", sa.JSON(), nullable=False),
    ])


def downgrade() -> None:
    for name in ("playbooks", "knowledge_entries", "context_packs"):
        op.drop_index(f"ix_{name}_user_id", table_name=name)
        op.drop_table(name)
