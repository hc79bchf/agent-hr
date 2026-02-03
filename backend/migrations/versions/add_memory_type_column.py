"""Add memory_type column to components table.

Revision ID: add_memory_type
Revises: create_agent_deployments
Create Date: 2026-01-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_memory_type'
down_revision = 'create_agent_deployments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'components',
        sa.Column('memory_type', sa.String(20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('components', 'memory_type')
