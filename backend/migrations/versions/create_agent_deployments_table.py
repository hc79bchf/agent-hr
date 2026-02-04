"""create agent_deployments table

Revision ID: create_agent_deployments
Revises: create_component_library
Create Date: 2026-01-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'create_agent_deployments'
down_revision: Union[str, None] = 'create_component_library'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create agent_deployments table
    op.create_table(
        'agent_deployments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('container_id', sa.String(length=64), nullable=True),
        sa.Column('image_id', sa.String(length=128), nullable=True),
        sa.Column('port', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('stopped_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['version_id'], ['agent_versions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "status IN ('pending', 'building', 'starting', 'running', 'stopping', 'stopped', 'failed')",
            name='ck_agent_deployments_status'
        )
    )

    # Create indexes
    op.create_index('idx_agent_deployments_agent', 'agent_deployments', ['agent_id'])
    op.create_index('idx_agent_deployments_status', 'agent_deployments', ['status'])
    op.create_index('idx_agent_deployments_version', 'agent_deployments', ['version_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_agent_deployments_version', table_name='agent_deployments')
    op.drop_index('idx_agent_deployments_status', table_name='agent_deployments')
    op.drop_index('idx_agent_deployments_agent', table_name='agent_deployments')

    # Drop table
    op.drop_table('agent_deployments')
