"""Add missing columns to component_registry table.

Revision ID: add_component_registry_cols
Revises: add_component_snapshots
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_component_registry_cols'
down_revision: Union[str, Sequence[str], None] = 'add_component_snapshots'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing columns to component_registry."""
    op.add_column('component_registry', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('component_registry', sa.Column('content', sa.Text(), nullable=True))
    op.add_column('component_registry', sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    """Remove added columns."""
    op.drop_column('component_registry', 'tags')
    op.drop_column('component_registry', 'content')
    op.drop_column('component_registry', 'description')
