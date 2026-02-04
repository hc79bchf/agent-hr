"""Add agent_registry_refs table.

Revision ID: add_agent_registry_refs
Revises: add_component_access_control
Create Date: 2024-01-29 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_agent_registry_refs'
down_revision = 'add_component_access_control'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create agent_registry_refs table
    op.create_table(
        'agent_registry_refs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('registry_component_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('added_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['registry_component_id'], ['component_registry.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['added_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agent_id', 'registry_component_id', name='uq_agent_registry_ref'),
    )

    # Create indexes
    op.create_index('ix_agent_registry_refs_agent_id', 'agent_registry_refs', ['agent_id'])
    op.create_index('ix_agent_registry_refs_registry_component_id', 'agent_registry_refs', ['registry_component_id'])


def downgrade() -> None:
    op.drop_index('ix_agent_registry_refs_registry_component_id', table_name='agent_registry_refs')
    op.drop_index('ix_agent_registry_refs_agent_id', table_name='agent_registry_refs')
    op.drop_table('agent_registry_refs')
