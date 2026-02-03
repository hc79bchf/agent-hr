"""Component access requests router for managing access request workflow."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.component_registry import ComponentRegistry
from app.models.component_access_request import ComponentAccessRequest, RequestStatus
from app.models.component_grant import ComponentGrant
from app.models.agent import Agent
from app.models.user import User
from app.schemas.grants import (
    ComponentAccessRequestCreate,
    ComponentAccessRequestResolve,
    ComponentAccessRequestResponse,
    ComponentAccessRequestListResponse,
)

# Router for agent-centric requests (what requests has my agent made?)
agent_router = APIRouter(prefix="/api/agents/{agent_id}/access-requests", tags=["access-requests"])

# Router for component-centric requests (what requests are pending for my component?)
component_router = APIRouter(prefix="/api/components/{component_id}/access-requests", tags=["access-requests"])

# Router for specific request operations
request_router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])


def get_component_or_404(component_id: UUID, db: Session) -> ComponentRegistry:
    """Get a component by ID or raise 404 if not found."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@agent_router.post("", response_model=ComponentAccessRequestResponse, status_code=status.HTTP_201_CREATED)
def create_access_request(
    agent_id: UUID,
    data: ComponentAccessRequestCreate,
    db: Session = Depends(get_db),
):
    """Create an access request for a component.

    Args:
        agent_id: The agent's UUID requesting access.
        data: Request data (component_id, requested_level).
        db: Database session.

    Returns:
        The created access request.

    Raises:
        HTTPException: If component not found or pending request exists.
    """
    component = get_component_or_404(data.component_id, db)

    # Check if there's already a pending request
    existing = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.component_id == data.component_id,
        ComponentAccessRequest.agent_id == agent_id,
        ComponentAccessRequest.status == RequestStatus.PENDING,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending access request already exists for this component"
        )

    request = ComponentAccessRequest(
        component_id=data.component_id,
        agent_id=agent_id,
        requested_level=data.requested_level,
        requested_by=component.owner_id,  # In real app, this would be the current user
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@agent_router.get("", response_model=ComponentAccessRequestListResponse)
def list_agent_requests(agent_id: UUID, db: Session = Depends(get_db)):
    """List all access requests made by an agent.

    Args:
        agent_id: The agent's UUID.
        db: Database session.

    Returns:
        List of access requests made by the agent.
    """
    requests = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.agent_id == agent_id
    ).all()
    return ComponentAccessRequestListResponse(data=requests, total=len(requests))


def enrich_request_with_names(request: ComponentAccessRequest, db: Session) -> dict:
    """Add agent_name and requester_name to request data."""
    data = {
        "id": request.id,
        "component_id": request.component_id,
        "agent_id": request.agent_id,
        "requested_level": request.requested_level,
        "requested_by": request.requested_by,
        "requested_at": request.requested_at,
        "status": request.status,
        "resolved_by": request.resolved_by,
        "resolved_at": request.resolved_at,
        "denial_reason": request.denial_reason,
        "is_pending": request.is_pending,
    }

    # Fetch agent name
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    data["agent_name"] = agent.name if agent else None

    # Fetch requester name
    requester = db.query(User).filter(User.id == request.requested_by).first()
    data["requester_name"] = requester.name if requester else None

    return data


@component_router.get("", response_model=ComponentAccessRequestListResponse)
def list_component_requests(
    component_id: UUID,
    pending_only: bool = False,
    status: str = None,
    db: Session = Depends(get_db),
):
    """List all access requests for a component.

    Args:
        component_id: The component's UUID.
        pending_only: If True, only return pending requests.
        status: Filter by status (pending, approved, denied).
        db: Database session.

    Returns:
        List of access requests for the component.

    Raises:
        HTTPException: If component not found.
    """
    get_component_or_404(component_id, db)

    query = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.component_id == component_id
    )
    if pending_only or status == "pending":
        query = query.filter(ComponentAccessRequest.status == RequestStatus.PENDING)
    elif status == "approved":
        query = query.filter(ComponentAccessRequest.status == RequestStatus.APPROVED)
    elif status == "denied":
        query = query.filter(ComponentAccessRequest.status == RequestStatus.DENIED)

    requests = query.all()

    # Enrich each request with agent and requester names
    enriched_requests = [enrich_request_with_names(req, db) for req in requests]

    return ComponentAccessRequestListResponse(data=enriched_requests, total=len(enriched_requests))


@request_router.get("/{request_id}", response_model=ComponentAccessRequestResponse)
def get_request(request_id: UUID, db: Session = Depends(get_db)):
    """Get a specific access request.

    Args:
        request_id: The request's UUID.
        db: Database session.

    Returns:
        The access request.

    Raises:
        HTTPException: If request not found.
    """
    request = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Access request not found")
    return request


@request_router.post("/{request_id}/resolve", response_model=ComponentAccessRequestResponse)
def resolve_request(
    request_id: UUID,
    data: ComponentAccessRequestResolve,
    db: Session = Depends(get_db),
):
    """Approve or deny an access request.

    When approved, automatically creates a ComponentGrant with the requested level.

    Args:
        request_id: The request's UUID.
        data: Resolution data (approve, denial_reason).
        db: Database session.

    Returns:
        The updated access request.

    Raises:
        HTTPException: If request not found or already resolved.
    """
    request = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Access request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request has already been resolved")

    component = get_component_or_404(request.component_id, db)
    now = datetime.utcnow()

    if data.approve:
        request.status = RequestStatus.APPROVED
        request.resolved_by = component.owner_id  # In real app, this would be current user
        request.resolved_at = now

        # Check if a grant already exists for this component/agent pair
        existing_grant = db.query(ComponentGrant).filter(
            ComponentGrant.component_id == request.component_id,
            ComponentGrant.agent_id == request.agent_id,
        ).first()

        if existing_grant:
            # Update existing grant to the requested level
            existing_grant.access_level = request.requested_level
            existing_grant.granted_by = component.owner_id
            existing_grant.granted_at = now
            existing_grant.revoked_at = None  # Reactivate if previously revoked
        else:
            # Create new grant
            grant = ComponentGrant(
                component_id=request.component_id,
                agent_id=request.agent_id,
                access_level=request.requested_level,
                granted_by=component.owner_id,
            )
            db.add(grant)
    else:
        request.status = RequestStatus.DENIED
        request.resolved_by = component.owner_id
        request.resolved_at = now
        request.denial_reason = data.denial_reason

    db.commit()
    db.refresh(request)
    return request
