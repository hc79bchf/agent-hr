"""Add component status lifecycle fields.

Revision ID: add_component_status
Revises: add_component_registry_cols
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_component_status'
down_revision: Union[str, Sequence[str], None] = 'add_component_registry_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ComponentStatus enum
    op.execute(
        "DO $$ BEGIN CREATE TYPE componentstatus AS ENUM "
        "('draft', 'published', 'deprecated', 'retired'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Add status column with default 'draft'
    componentstatus_type = postgresql.ENUM(
        'draft', 'published', 'deprecated', 'retired',
        name='componentstatus', create_type=False
    )
    op.add_column('component_registry', sa.Column(
        'status', componentstatus_type, nullable=False, server_default='draft'
    ))
    op.add_column('component_registry', sa.Column(
        'published_at', sa.DateTime(), nullable=True
    ))
    op.add_column('component_registry', sa.Column(
        'deprecation_reason', sa.String(500), nullable=True
    ))

    # Backfill: set all existing components to PUBLISHED
    op.execute(
        "UPDATE component_registry SET status = 'published', "
        "published_at = created_at WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column('component_registry', 'deprecation_reason')
    op.drop_column('component_registry', 'published_at')
    op.drop_column('component_registry', 'status')
    sa.Enum(name='componentstatus').drop(op.get_bind(), checkfirst=True)
