from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion, ChangeType
from app.models.component import Component
from app.schemas.version import (
    VersionResponse,
    VersionListResponse,
    VersionCompareResponse,
    ComponentDiff,
    VersionSummary,
    DiffSummary,
)

router = APIRouter(prefix="/api/agents", tags=["versions"])


@router.get("/{agent_id}/versions", response_model=VersionListResponse)
async def list_versions(
    agent_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all versions for an agent with pagination.

    Returns versions ordered by version_number descending (newest first).
    """
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    query = db.query(AgentVersion).filter(AgentVersion.agent_id == agent_id)
    total = query.count()
    versions = query.order_by(AgentVersion.version_number.desc()).offset(skip).limit(limit).all()

    return VersionListResponse(data=versions, total=total)


@router.get("/{agent_id}/versions/compare", response_model=VersionCompareResponse)
async def compare_versions(
    agent_id: UUID,
    version_a: UUID = Query(..., description="First version ID"),
    version_b: UUID = Query(..., description="Second version ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare two versions of an agent, showing component differences."""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Fetch both versions
    ver_a = db.query(AgentVersion).filter(
        AgentVersion.id == version_a, AgentVersion.agent_id == agent_id
    ).first()
    ver_b = db.query(AgentVersion).filter(
        AgentVersion.id == version_b, AgentVersion.agent_id == agent_id
    ).first()

    if not ver_a or not ver_b:
        raise HTTPException(status_code=404, detail="Version not found")

    # Fetch components for both versions
    comps_a = db.query(Component).filter(Component.version_id == version_a).all()
    comps_b = db.query(Component).filter(Component.version_id == version_b).all()

    # Index by name for comparison
    by_name_a = {c.name: c for c in comps_a}
    by_name_b = {c.name: c for c in comps_b}

    # Compute diffs by type
    def compute_diffs(comp_type: str) -> tuple[list[ComponentDiff], DiffSummary]:
        diffs = []
        summary = DiffSummary()

        type_a = {k: v for k, v in by_name_a.items() if v.type.value == comp_type}
        type_b = {k: v for k, v in by_name_b.items() if v.type.value == comp_type}

        all_names = set(type_a.keys()) | set(type_b.keys())

        for name in sorted(all_names):
            in_a = name in type_a
            in_b = name in type_b

            if in_b and not in_a:
                diffs.append(ComponentDiff(
                    name=name,
                    type=comp_type,
                    change_type="added",
                    content_b=type_b[name].content
                ))
                summary.added += 1
            elif in_a and not in_b:
                diffs.append(ComponentDiff(
                    name=name,
                    type=comp_type,
                    change_type="removed",
                    content_a=type_a[name].content
                ))
                summary.removed += 1
            elif type_a[name].content != type_b[name].content:
                diffs.append(ComponentDiff(
                    name=name,
                    type=comp_type,
                    change_type="modified",
                    content_a=type_a[name].content,
                    content_b=type_b[name].content
                ))
                summary.modified += 1

        return diffs, summary

    skills, skills_summary = compute_diffs("skill")
    mcp_tools, tools_summary = compute_diffs("mcp_tool")
    memory, memory_summary = compute_diffs("memory")
    agents, agents_summary = compute_diffs("agent")

    return VersionCompareResponse(
        version_a=VersionSummary(
            id=ver_a.id,
            version_number=ver_a.version_number,
            change_type=ver_a.change_type.value,
            created_at=ver_a.created_at
        ),
        version_b=VersionSummary(
            id=ver_b.id,
            version_number=ver_b.version_number,
            change_type=ver_b.change_type.value,
            created_at=ver_b.created_at
        ),
        skills=skills,
        mcp_tools=mcp_tools,
        memory=memory,
        agents=agents,
        summary={
            "skills": skills_summary,
            "mcp_tools": tools_summary,
            "memory": memory_summary,
            "agents": agents_summary,
        },
    )


@router.get("/{agent_id}/versions/{version_id}", response_model=VersionResponse)
async def get_version(
    agent_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific version by ID."""
    version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("/{agent_id}/rollback/{version_id}", response_model=VersionResponse, status_code=201)
async def rollback_to_version(
    agent_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rollback to a previous version.

    This creates a new version that copies the configuration and components
    from the specified source version.
    """
    # Get source version
    source_version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not source_version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Get agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()

    # Get next version number
    max_version = db.query(AgentVersion).filter(AgentVersion.agent_id == agent_id).count()

    # Create new version from rollback
    new_version = AgentVersion(
        agent_id=agent_id,
        version_number=max_version + 1,
        parent_version_id=source_version.id,
        change_type=ChangeType.ROLLBACK,
        change_summary=f"Rollback to version {source_version.version_number}",
        raw_config=source_version.raw_config,
        parsed_config=source_version.parsed_config,
        created_by=current_user.id,
    )
    db.add(new_version)
    db.flush()

    # Copy components from source version
    for comp in source_version.components:
        new_comp = Component(
            version_id=new_version.id,
            type=comp.type,
            name=comp.name,
            description=comp.description,
            content=comp.content,
            config=comp.config,
            source_path=comp.source_path,
        )
        db.add(new_comp)

    agent.current_version_id = new_version.id
    db.commit()
    db.refresh(new_version)

    return new_version
