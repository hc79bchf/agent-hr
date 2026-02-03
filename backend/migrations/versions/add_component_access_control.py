"""add_component_access_control

Revision ID: add_component_access_control
Revises: 5dbecfa52786
Create Date: 2026-01-29

Adds:
- ComponentAccessLevel enum and access_level column to component_grants
- organization_id and manager_id columns to component_registry
- component_access_requests table for access request workflow
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_component_access_control'
down_revision: Union[str, Sequence[str], None] = '5dbecfa52786'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create ComponentAccessLevel enum
    componentaccesslevel = sa.Enum('viewer', 'executor', 'contributor', name='componentaccesslevel')
    componentaccesslevel.create(op.get_bind(), checkfirst=True)

    # Create RequestStatus enum
    requeststatus = sa.Enum('pending', 'approved', 'denied', name='requeststatus')
    requeststatus.create(op.get_bind(), checkfirst=True)

    # Add access_level column to component_grants
    op.add_column('component_grants', sa.Column(
        'access_level',
        sa.Enum('viewer', 'executor', 'contributor', name='componentaccesslevel'),
        nullable=False,
        server_default='viewer'
    ))

    # Add organization_id and manager_id to component_registry
    op.add_column('component_registry', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('component_registry', sa.Column('manager_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_component_registry_organization',
        'component_registry', 'organizations',
        ['organization_id'], ['id']
    )
    op.create_foreign_key(
        'fk_component_registry_manager',
        'component_registry', 'users',
        ['manager_id'], ['id']
    )

    # Create component_access_requests table
    op.create_table(
        'component_access_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('component_id', sa.UUID(), nullable=False),
        sa.Column('agent_id', sa.UUID(), nullable=False),
        sa.Column('requested_level', sa.Enum('viewer', 'executor', 'contributor', name='componentaccesslevel'), nullable=False),
        sa.Column('requested_by', sa.UUID(), nullable=False),
        sa.Column('requested_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'approved', 'denied', name='requeststatus'), nullable=False, server_default='pending'),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('denial_reason', sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], name='fk_access_request_agent'),
        sa.ForeignKeyConstraint(['component_id'], ['component_registry.id'], name='fk_access_request_component'),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], name='fk_access_request_requester'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], name='fk_access_request_resolver'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('component_id', 'agent_id', 'status', name='uq_component_agent_pending_request')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop component_access_requests table
    op.drop_table('component_access_requests')

    # Drop foreign keys from component_registry
    op.drop_constraint('fk_component_registry_manager', 'component_registry', type_='foreignkey')
    op.drop_constraint('fk_component_registry_organization', 'component_registry', type_='foreignkey')

    # Drop columns from component_registry
    op.drop_column('component_registry', 'manager_id')
    op.drop_column('component_registry', 'organization_id')

    # Drop access_level column from component_grants
    op.drop_column('component_grants', 'access_level')

    # Drop enums
    sa.Enum(name='requeststatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='componentaccesslevel').drop(op.get_bind(), checkfirst=True)
