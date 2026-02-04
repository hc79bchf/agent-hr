from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion, ChangeType
from app.models.component import Component
from app.schemas.version import ComponentResponse, ComponentUpdate, ComponentEditResponse, VersionResponse

router = APIRouter(prefix="/api/versions", tags=["components"])


@router.get("/{version_id}/components", response_model=list[ComponentResponse])
async def list_components(
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    version = db.query(AgentVersion).filter(AgentVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version.components


@router.get("/{version_id}/components/{component_id}", response_model=ComponentResponse)
async def get_component(
    version_id: UUID,
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    component = db.query(Component).filter(
        Component.id == component_id,
        Component.version_id == version_id
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.patch("/{version_id}/components/{component_id}", response_model=ComponentEditResponse, status_code=201)
async def edit_component(
    version_id: UUID,
    component_id: UUID,
    update_data: ComponentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get source version and component
    source_version = db.query(AgentVersion).filter(AgentVersion.id == version_id).first()
    if not source_version:
        raise HTTPException(status_code=404, detail="Version not found")

    source_component = db.query(Component).filter(
        Component.id == component_id,
        Component.version_id == version_id
    ).first()
    if not source_component:
        raise HTTPException(status_code=404, detail="Component not found")

    agent = db.query(Agent).filter(Agent.id == source_version.agent_id).first()

    # Get next version number
    max_version = db.query(AgentVersion).filter(
        AgentVersion.agent_id == source_version.agent_id
    ).count()

    # Create new version
    new_version = AgentVersion(
        agent_id=source_version.agent_id,
        version_number=max_version + 1,
        parent_version_id=source_version.id,
        change_type=ChangeType.EDIT,
        change_summary=f"Edited component: {source_component.name}",
        raw_config=source_version.raw_config,
        parsed_config=source_version.parsed_config,
        created_by=current_user.id,
    )
    db.add(new_version)
    db.flush()

    # Copy all components, applying update to the edited one
    edited_component = None
    for comp in source_version.components:
        new_comp = Component(
            version_id=new_version.id,
            type=comp.type,
            name=update_data.name if comp.id == component_id and update_data.name else comp.name,
            description=update_data.description if comp.id == component_id and update_data.description else comp.description,
            content=update_data.content if comp.id == component_id and update_data.content else comp.content,
            config=comp.config,
            source_path=comp.source_path,
        )
        db.add(new_comp)
        if comp.id == component_id:
            edited_component = new_comp

    agent.current_version_id = new_version.id
    db.commit()
    db.refresh(new_version)
    db.refresh(edited_component)

    return ComponentEditResponse(
        component=edited_component,
        new_version=new_version
    )
