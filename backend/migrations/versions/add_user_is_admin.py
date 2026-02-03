"""Add is_admin to users table.

Revision ID: add_user_is_admin
Revises: add_user_org_id
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_user_is_admin'
down_revision = ('add_agent_registry_refs', 'add_user_org_id')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_admin column to users table with default False
    op.add_column(
        'users',
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    # Drop column
    op.drop_column('users', 'is_admin')
