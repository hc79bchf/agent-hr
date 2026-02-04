"""create component library tables

Revision ID: create_component_library
Revises: add_agent_component_type
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'create_component_library'
down_revision: Union[str, None] = 'add_agent_component_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create component_library table
    op.create_table(
        'component_library',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default={}),
        sa.Column('source_path', sa.String(length=512), nullable=True),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True, default=[]),
        sa.Column('usage_count', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("type IN ('skill', 'mcp_tool', 'memory')", name='ck_component_library_type')
    )

    # Create indexes for component_library
    op.create_index('idx_component_library_type', 'component_library', ['type'])
    op.create_index('idx_component_library_author', 'component_library', ['author_id'])

    # Create agent_library_refs table
    op.create_table(
        'agent_library_refs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('library_component_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.Column('added_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['library_component_id'], ['component_library.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['added_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agent_id', 'library_component_id', name='uq_agent_library_ref')
    )

    # Create indexes for agent_library_refs
    op.create_index('idx_agent_library_refs_agent', 'agent_library_refs', ['agent_id'])
    op.create_index('idx_agent_library_refs_component', 'agent_library_refs', ['library_component_id'])


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('idx_agent_library_refs_component', table_name='agent_library_refs')
    op.drop_index('idx_agent_library_refs_agent', table_name='agent_library_refs')

    # Drop agent_library_refs table
    op.drop_table('agent_library_refs')

    # Drop indexes for component_library
    op.drop_index('idx_component_library_author', table_name='component_library')
    op.drop_index('idx_component_library_type', table_name='component_library')

    # Drop component_library table
    op.drop_table('component_library')
