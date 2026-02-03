"""Create component_folders table and add folder_id to components.

Revision ID: create_component_folders
Revises: add_memory_type
Create Date: 2026-01-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'create_component_folders'
down_revision = 'add_memory_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create component_folders table
    op.create_table(
        'component_folders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('version_id', UUID(as_uuid=True), sa.ForeignKey('agent_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),  # 'skill', 'mcp_tool', 'memory', 'agent'
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('source_path', sa.String(500), nullable=True),
        sa.Column('file_count', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('version_id', 'type', 'name', name='uq_component_folders_version_type_name')
    )

    # Create index on version_id for faster lookups
    op.create_index('ix_component_folders_version_id', 'component_folders', ['version_id'])

    # Add folder_id column to components table (nullable for backward compatibility)
    op.add_column(
        'components',
        sa.Column('folder_id', UUID(as_uuid=True), sa.ForeignKey('component_folders.id', ondelete='SET NULL'), nullable=True)
    )

    # Create index on folder_id for faster lookups
    op.create_index('ix_components_folder_id', 'components', ['folder_id'])


def downgrade() -> None:
    # Remove folder_id index and column from components
    op.drop_index('ix_components_folder_id', table_name='components')
    op.drop_column('components', 'folder_id')

    # Remove component_folders table
    op.drop_index('ix_component_folders_version_id', table_name='component_folders')
    op.drop_table('component_folders')
