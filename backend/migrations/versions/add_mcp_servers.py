"""Add MCP servers table.

Revision ID: add_mcp_servers
Revises: add_component_status
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_mcp_servers'
down_revision: Union[str, Sequence[str], None] = 'add_component_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    op.execute(
        "DO $$ BEGIN CREATE TYPE mcpauthtype AS ENUM "
        "('none', 'api_key', 'oauth', 'bearer'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE mcpserverstatus AS ENUM "
        "('active', 'inactive', 'unhealthy'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    mcpauthtype = postgresql.ENUM('none', 'api_key', 'oauth', 'bearer', name='mcpauthtype', create_type=False)
    mcpserverstatus = postgresql.ENUM('active', 'inactive', 'unhealthy', name='mcpserverstatus', create_type=False)

    op.create_table(
        'mcp_servers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('server_url', sa.String(2048), nullable=False),
        sa.Column('protocol_version', sa.String(50), server_default='1.0'),
        sa.Column('capabilities', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('auth_type', mcpauthtype, nullable=False, server_default='none'),
        sa.Column('auth_config', postgresql.JSONB(), nullable=True),
        sa.Column('health_check_url', sa.String(2048), nullable=True),
        sa.Column('health_check_interval_seconds', sa.Integer(), server_default='300'),
        sa.Column('status', mcpserverstatus, nullable=False, server_default='active'),
        sa.Column('last_health_check_at', sa.DateTime(), nullable=True),
        sa.Column('last_health_status', sa.String(255), nullable=True),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('component_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name='fk_mcp_server_owner'),
        sa.ForeignKeyConstraint(['component_id'], ['component_registry.id'], name='fk_mcp_server_component'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mcp_servers_owner_id', 'mcp_servers', ['owner_id'])
    op.create_index('ix_mcp_servers_status', 'mcp_servers', ['status'])
    op.create_index('ix_mcp_servers_component_id', 'mcp_servers', ['component_id'])


def downgrade() -> None:
    op.drop_index('ix_mcp_servers_component_id', 'mcp_servers')
    op.drop_index('ix_mcp_servers_status', 'mcp_servers')
    op.drop_index('ix_mcp_servers_owner_id', 'mcp_servers')
    op.drop_table('mcp_servers')
    sa.Enum(name='mcpserverstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='mcpauthtype').drop(op.get_bind(), checkfirst=True)
