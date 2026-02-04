"""create initial tables

Revision ID: 8459c27c6d73
Revises:
Create Date: 2025-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8459c27c6d73'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create agent_versions table (must be created before agents due to FK)
    op.create_table(
        'agent_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('parent_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('change_type', sa.Enum('upload', 'edit', 'rollback', name='changetype'), nullable=False),
        sa.Column('change_summary', sa.Text(), nullable=True),
        sa.Column('raw_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('parsed_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_version_id'], ['agent_versions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create agents table
    op.create_table(
        'agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('current_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.Enum('draft', 'active', 'deprecated', name='agentstatus'), nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('department', sa.String(length=255), nullable=True),
        sa.Column('usage_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['current_version_id'], ['agent_versions.id'], use_alter=True, name='fk_agents_current_version_id'),
        sa.PrimaryKeyConstraint('id')
    )

    # Add foreign key from agent_versions to agents (now that agents table exists)
    op.create_foreign_key(
        'fk_agent_versions_agent_id',
        'agent_versions', 'agents',
        ['agent_id'], ['id']
    )

    # Create components table
    op.create_table(
        'components',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.Enum('skill', 'mcp_tool', 'memory', name='componenttype'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('source_path', sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(['version_id'], ['agent_versions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('components')

    # Drop the foreign key from agent_versions to agents before dropping agents
    op.drop_constraint('fk_agent_versions_agent_id', 'agent_versions', type_='foreignkey')

    op.drop_table('agents')
    op.drop_table('agent_versions')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS componenttype')
    op.execute('DROP TYPE IF EXISTS changetype')
    op.execute('DROP TYPE IF EXISTS agentstatus')
