"""Organizations CRUD router for managing organizations.

All endpoints require admin access.
"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Create a new organization.

    Requires admin access.

    Args:
        data: Organization creation data.
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        The created organization.
    """
    org = Organization(
        name=data.name,
        parent_id=data.parent_id,
        org_metadata=data.metadata,  # Map schema field to model field
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.get("", response_model=List[OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all organizations.

    Requires admin access.

    Args:
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        List of organizations.
    """
    return db.query(Organization).filter(Organization.deleted_at.is_(None)).all()


@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Get a specific organization by ID.

    Requires admin access.

    Args:
        org_id: The organization's UUID.
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        The organization.

    Raises:
        HTTPException: If the organization is not found.
    """
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: UUID,
    data: OrganizationUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Update an organization.

    Requires admin access.

    Args:
        org_id: The organization's UUID.
        data: The fields to update.
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        The updated organization.

    Raises:
        HTTPException: If the organization is not found.
    """
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = data.model_dump(exclude_unset=True)
    # Handle metadata field mapping
    if "metadata" in update_data:
        update_data["org_metadata"] = update_data.pop("metadata")
    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    org_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Soft delete an organization.

    Requires admin access.

    Args:
        org_id: The organization's UUID.
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Raises:
        HTTPException: If the organization is not found.
    """
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.deleted_at = datetime.utcnow()
    db.commit()
