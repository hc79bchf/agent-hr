"""add agent component type

Revision ID: add_agent_component_type
Revises: 8459c27c6d73
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'add_agent_component_type'
down_revision: Union[str, None] = '8459c27c6d73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'agent' to the componenttype enum
    op.execute("ALTER TYPE componenttype ADD VALUE IF NOT EXISTS 'agent'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # Would need to recreate the enum type and update all references
    pass
