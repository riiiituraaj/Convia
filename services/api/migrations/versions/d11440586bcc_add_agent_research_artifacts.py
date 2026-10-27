"""add_agent_research_artifacts

Revision ID: d11440586bcc
Revises: 8af1430c9d57
Create Date: 2026-10-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd11440586bcc'
down_revision: Union[str, None] = '8af1430c9d57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Research sessions table
    op.create_table(
        'research_sessions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('original_query', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default="COMPLETED"),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('synthesis', sa.Text(), nullable=True),
        sa.Column('claims_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_sessions_user_id'), 'research_sessions', ['user_id'], unique=False)

    # 2. Research sources table
    op.create_table(
        'research_sources',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('session_id', sa.String(length=36), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=False, server_default="web"),
        sa.Column('domain', sa.String(length=100), nullable=True),
        sa.Column('snippet', sa.Text(), nullable=False, server_default=""),
        sa.Column('raw_content', sa.Text(), nullable=True),
        sa.Column('relevance', sa.Float(), nullable=True),
        sa.Column('retrieval_status', sa.String(length=30), nullable=False, server_default="retrieved"),
        sa.Column('published_at', sa.String(length=100), nullable=True),
        sa.Column('retrieved_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['research_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_sources_session_id'), 'research_sources', ['session_id'], unique=False)

    # 3. Artifacts table
    op.create_table(
        'artifacts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('mission_id', sa.String(length=36), nullable=True),
        sa.Column('agent_run_id', sa.String(length=36), nullable=True),
        sa.Column('conversation_id', sa.String(length=36), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('artifact_type', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('sources_json', sa.JSON(), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default="1"),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['agent_run_id'], ['agent_runs.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['mission_id'], ['missions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_artifacts_user_id'), 'artifacts', ['user_id'], unique=False)

    # 4. Agent steps table
    op.create_table(
        'agent_steps',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('run_id', sa.String(length=36), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('tool_name', sa.String(length=100), nullable=False),
        sa.Column('input_payload', sa.JSON(), nullable=False),
        sa.Column('output_payload', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('requires_approval', sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column('action_passport_id', sa.String(length=36), nullable=True),
        sa.Column('idempotency_key', sa.String(length=128), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_agent_steps_run_id'), 'agent_steps', ['run_id'], unique=False)

    # 5. Add columns to existing tables
    with op.batch_alter_table('agent_runs') as batch_op:
        batch_op.add_column(sa.Column('plan_json', sa.JSON(), nullable=False, server_default='[]'))

    with op.batch_alter_table('conversations') as batch_op:
        batch_op.add_column(sa.Column('summary_text', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('conversations') as batch_op:
        batch_op.drop_column('summary_text')

    with op.batch_alter_table('agent_runs') as batch_op:
        batch_op.drop_column('plan_json')

    op.drop_index(op.f('ix_agent_steps_run_id'), table_name='agent_steps')
    op.drop_table('agent_steps')

    op.drop_index(op.f('ix_artifacts_user_id'), table_name='artifacts')
    op.drop_table('artifacts')

    op.drop_index(op.f('ix_research_sources_session_id'), table_name='research_sources')
    op.drop_table('research_sources')

    op.drop_index(op.f('ix_research_sessions_user_id'), table_name='research_sessions')
    op.drop_table('research_sessions')
