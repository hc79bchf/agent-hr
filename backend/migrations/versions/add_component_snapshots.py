"""Add component_snapshots table for version history.

Revision ID: add_component_snapshots
Revises: add_user_is_admin
Create Date: 2024-02-01 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_component_snapshots'
down_revision = 'add_user_is_admin'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create component_snapshots table
    op.create_table(
        'component_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('component_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_label', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), server_default='{}'),
        sa.Column('component_metadata', postgresql.JSONB(), server_default='{}'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['component_id'], ['component_registry.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes for common queries
    op.create_index('ix_component_snapshots_component_id', 'component_snapshots', ['component_id'])
    op.create_index('ix_component_snapshots_created_by', 'component_snapshots', ['created_by'])
    op.create_index('ix_component_snapshots_created_at', 'component_snapshots', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_component_snapshots_created_at', table_name='component_snapshots')
    op.drop_index('ix_component_snapshots_created_by', table_name='component_snapshots')
    op.drop_index('ix_component_snapshots_component_id', table_name='component_snapshots')
    op.drop_table('component_snapshots')
