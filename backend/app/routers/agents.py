"""Agent CRUD router for managing agents."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database import get_db
from app.dependencies import get_current_user
from app.models.agent import Agent, AgentStatus, AgentVersion
from app.models.agent_stakeholder import AgentStakeholder, StakeholderRole
from app.models.deployment import AgentDeployment, DeploymentStatus
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentListResponse, AgentResponse, AgentUpdate, AuthorInfo

router = APIRouter(prefix="/api/agents", tags=["agents"])


def enrich_agent_response(agent: Agent, db: Session) -> dict:
    """Add author info, version count, and running status to agent response."""
    # Get author info
    author = db.query(User).filter(User.id == agent.author_id).first()
    author_info = None
    if author:
        author_info = AuthorInfo(id=author.id, name=author.name, email=author.email)

    # Get version count
    version_count = db.query(func.count(AgentVersion.id)).filter(
        AgentVersion.agent_id == agent.id
    ).scalar() or 0

    # Check if agent has a running deployment
    running_deployment = db.query(AgentDeployment).filter(
        AgentDeployment.agent_id == agent.id,
        AgentDeployment.status == DeploymentStatus.RUNNING.value,
    ).first()
    is_running = running_deployment is not None

    return {
        **{c.name: getattr(agent, c.name) for c in agent.__table__.columns},
        "author": author_info,
        "version_count": version_count,
        "is_running": is_running,
    }


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new agent.

    Args:
        agent_data: Agent creation data.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The created agent.
    """
    agent = Agent(
        name=agent_data.name,
        description=agent_data.description,
        author_id=current_user.id,
        tags=agent_data.tags,
        department=agent_data.department,
        usage_notes=agent_data.usage_notes,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return enrich_agent_response(agent, db)


@router.get("", response_model=AgentListResponse)
async def list_agents(
    status: Optional[AgentStatus] = None,
    search: Optional[str] = None,
    department: Optional[str] = None,
    tag: Optional[str] = None,
    author_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List agents with optional filtering.

    Args:
        status: Filter by agent status.
        search: Search by name, description, or tags (case-insensitive).
        department: Filter by department.
        tag: Filter by specific tag.
        author_id: Filter by author.
        skip: Number of records to skip (pagination).
        limit: Maximum number of records to return.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        List of agents with total count.
    """
    query = db.query(Agent).filter(Agent.deleted_at.is_(None))

    if status:
        query = query.filter(Agent.status == status)
    if department:
        query = query.filter(Agent.department.ilike(f"%{department}%"))
    if tag:
        query = query.filter(Agent.tags.any(tag))
    if author_id:
        query = query.filter(Agent.author_id == author_id)
    if search:
        search_filter = or_(
            Agent.name.ilike(f"%{search}%"),
            Agent.description.ilike(f"%{search}%"),
            Agent.tags.any(search)
        )
        query = query.filter(search_filter)

    total = query.count()
    agents = query.offset(skip).limit(limit).all()

    enriched_agents = [enrich_agent_response(agent, db) for agent in agents]
    return AgentListResponse(data=enriched_agents, total=total)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific agent by ID.

    Args:
        agent_id: The agent's UUID.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The agent.

    Raises:
        HTTPException: If the agent is not found.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return enrich_agent_response(agent, db)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an agent.

    Args:
        agent_id: The agent's UUID.
        agent_data: The fields to update.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The updated agent.

    Raises:
        HTTPException: If the agent is not found.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    update_data = agent_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent, field, value)

    # If manager_id is set, automatically add them as a stakeholder with "owner" role
    if agent_data.manager_id is not None:
        existing_stakeholder = db.query(AgentStakeholder).filter(
            AgentStakeholder.agent_id == agent_id,
            AgentStakeholder.user_id == agent_data.manager_id,
        ).first()
        if not existing_stakeholder:
            stakeholder = AgentStakeholder(
                agent_id=agent_id,
                user_id=agent_data.manager_id,
                role=StakeholderRole.OWNER,
                granted_by=current_user.id,
            )
            db.add(stakeholder)

    db.commit()
    db.refresh(agent)
    return enrich_agent_response(agent, db)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete an agent.

    Args:
        agent_id: The agent's UUID.
        db: Database session.
        current_user: The authenticated user.

    Raises:
        HTTPException: If the agent is not found.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.deleted_at = datetime.utcnow()
    db.commit()
