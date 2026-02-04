"""Add organization_id to users table.

Revision ID: add_user_org_id
Revises: None
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'add_user_org_id'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add organization_id column to users table
    op.add_column(
        'users',
        sa.Column('organization_id', UUID(as_uuid=True), nullable=True)
    )

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_users_organization_id',
        'users',
        'organizations',
        ['organization_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create index for faster queries
    op.create_index(
        'ix_users_organization_id',
        'users',
        ['organization_id']
    )


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_users_organization_id', table_name='users')

    # Drop foreign key constraint
    op.drop_constraint('fk_users_organization_id', 'users', type_='foreignkey')

    # Drop column
    op.drop_column('users', 'organization_id')
