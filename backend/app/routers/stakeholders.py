"""Stakeholders management router for agent stakeholder relationships."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.agent import Agent
from app.models.agent_stakeholder import AgentStakeholder
from app.schemas.stakeholder import StakeholderCreate, StakeholderResponse, StakeholderUpdate

router = APIRouter(prefix="/api/agents/{agent_id}/stakeholders", tags=["stakeholders"])


def get_agent_or_404(agent_id: UUID, db: Session) -> Agent:
    """Get an agent by ID or raise 404 if not found.

    Args:
        agent_id: The agent's UUID.
        db: Database session.

    Returns:
        The agent if found.

    Raises:
        HTTPException: If the agent is not found or is deleted.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("", response_model=StakeholderResponse, status_code=status.HTTP_201_CREATED)
def add_stakeholder(
    agent_id: UUID,
    data: StakeholderCreate,
    db: Session = Depends(get_db),
):
    """Add a stakeholder to an agent.

    Args:
        agent_id: The agent's UUID.
        data: Stakeholder creation data (user_id, role).
        db: Database session.

    Returns:
        The created stakeholder relationship.

    Raises:
        HTTPException: If agent not found or stakeholder already exists.
    """
    agent = get_agent_or_404(agent_id, db)

    # Check if stakeholder already exists
    existing = db.query(AgentStakeholder).filter(
        AgentStakeholder.agent_id == agent_id,
        AgentStakeholder.user_id == data.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Stakeholder already exists")

    stakeholder = AgentStakeholder(
        agent_id=agent_id,
        user_id=data.user_id,
        role=data.role,
        granted_by=agent.author_id,  # For now, use agent author as granter
    )
    db.add(stakeholder)
    db.commit()
    db.refresh(stakeholder)
    # Eagerly load user for response
    return db.query(AgentStakeholder).options(
        joinedload(AgentStakeholder.user)
    ).filter(AgentStakeholder.id == stakeholder.id).first()


@router.get("", response_model=List[StakeholderResponse])
def list_stakeholders(agent_id: UUID, db: Session = Depends(get_db)):
    """List all stakeholders for an agent.

    Args:
        agent_id: The agent's UUID.
        db: Database session.

    Returns:
        List of stakeholder relationships for the agent.

    Raises:
        HTTPException: If the agent is not found.
    """
    get_agent_or_404(agent_id, db)
    return db.query(AgentStakeholder).options(
        joinedload(AgentStakeholder.user)
    ).filter(
        AgentStakeholder.agent_id == agent_id
    ).all()


@router.put("/{user_id}", response_model=StakeholderResponse)
def update_stakeholder(
    agent_id: UUID,
    user_id: UUID,
    data: StakeholderUpdate,
    db: Session = Depends(get_db),
):
    """Update a stakeholder's role.

    Args:
        agent_id: The agent's UUID.
        user_id: The user's UUID.
        data: The update data (role).
        db: Database session.

    Returns:
        The updated stakeholder.

    Raises:
        HTTPException: If agent or stakeholder not found.
    """
    get_agent_or_404(agent_id, db)

    stakeholder = db.query(AgentStakeholder).filter(
        AgentStakeholder.agent_id == agent_id,
        AgentStakeholder.user_id == user_id,
    ).first()
    if not stakeholder:
        raise HTTPException(status_code=404, detail="Stakeholder not found")

    stakeholder.role = data.role
    db.commit()
    db.refresh(stakeholder)

    # Eagerly load user for response
    return db.query(AgentStakeholder).options(
        joinedload(AgentStakeholder.user)
    ).filter(AgentStakeholder.id == stakeholder.id).first()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_stakeholder(agent_id: UUID, user_id: UUID, db: Session = Depends(get_db)):
    """Remove a stakeholder from an agent.

    Args:
        agent_id: The agent's UUID.
        user_id: The user's UUID to remove as stakeholder.
        db: Database session.

    Raises:
        HTTPException: If agent or stakeholder not found.
    """
    get_agent_or_404(agent_id, db)

    stakeholder = db.query(AgentStakeholder).filter(
        AgentStakeholder.agent_id == agent_id,
        AgentStakeholder.user_id == user_id,
    ).first()
    if not stakeholder:
        raise HTTPException(status_code=404, detail="Stakeholder not found")

    db.delete(stakeholder)
    db.commit()
