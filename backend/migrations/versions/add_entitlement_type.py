"""Add entitlement type and cancelled request status.

Revision ID: add_entitlement_type
Revises: add_mcp_servers
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_entitlement_type'
down_revision: Union[str, Sequence[str], None] = 'add_mcp_servers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create EntitlementType enum
    op.execute(
        "DO $$ BEGIN CREATE TYPE entitlementtype AS ENUM "
        "('open', 'request_required', 'restricted'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Add entitlement_type column
    entitlementtype = postgresql.ENUM(
        'open', 'request_required', 'restricted',
        name='entitlementtype', create_type=False
    )
    op.add_column('component_registry', sa.Column(
        'entitlement_type', entitlementtype, nullable=False, server_default='open'
    ))

    # Add 'cancelled' to requeststatus enum
    op.execute("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'cancelled'")

    # Backfill based on visibility:
    # public -> open, private -> restricted, organization -> request_required
    op.execute(
        "UPDATE component_registry SET entitlement_type = 'open' "
        "WHERE visibility = 'public'"
    )
    op.execute(
        "UPDATE component_registry SET entitlement_type = 'restricted' "
        "WHERE visibility = 'private'"
    )
    op.execute(
        "UPDATE component_registry SET entitlement_type = 'request_required' "
        "WHERE visibility = 'organization'"
    )


def downgrade() -> None:
    op.drop_column('component_registry', 'entitlement_type')
    sa.Enum(name='entitlementtype').drop(op.get_bind(), checkfirst=True)
    # Note: cannot remove enum value from requeststatus in PostgreSQL
