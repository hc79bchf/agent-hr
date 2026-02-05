"""Add component versions table and version field.

Revision ID: add_component_versions
Revises: add_entitlement_type
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_component_versions'
down_revision: Union[str, Sequence[str], None] = 'add_entitlement_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create component_versions table
    op.create_table(
        'component_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('component_id', sa.UUID(), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('changelog', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('parameters_schema_snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('mcp_config_snapshot', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['component_id'], ['component_registry.id'], name='fk_version_component', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_version_creator'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('component_id', 'version', name='uq_component_version'),
    )
    op.create_index('ix_component_versions_component_id', 'component_versions', ['component_id'])

    # Add version and parameters_schema to component_registry
    op.add_column('component_registry', sa.Column('version', sa.String(50), server_default='1.0.0'))
    op.add_column('component_registry', sa.Column('parameters_schema', postgresql.JSONB(), nullable=True))

    # Backfill existing components to version 1.0.0
    op.execute("UPDATE component_registry SET version = '1.0.0' WHERE version IS NULL")


def downgrade() -> None:
    op.drop_column('component_registry', 'parameters_schema')
    op.drop_column('component_registry', 'version')
    op.drop_index('ix_component_versions_component_id', 'component_versions')
    op.drop_table('component_versions')
