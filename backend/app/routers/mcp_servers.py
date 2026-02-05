"""MCP Server registry router for managing MCP server connections."""

import time
from datetime import datetime
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.mcp_server import MCPServer, MCPServerStatus
from app.schemas.mcp_server import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPServerResponse,
    MCPServerListResponse,
    MCPServerHealthResponse,
    MCPServerConnectionResponse,
)

router = APIRouter(prefix="/api/mcp-servers", tags=["mcp-servers"])


def to_response(server: MCPServer) -> dict:
    """Convert MCPServer to response dict with auth_config redacted."""
    data = {c.name: getattr(server, c.name) for c in server.__table__.columns}
    data["auth_configured"] = server.auth_config is not None and len(server.auth_config) > 0
    del data["auth_config"]  # Never expose
    return data


async def check_server_health(server: MCPServer, db: Session) -> dict:
    """Hit health_check_url, update server status, return result."""
    if not server.health_check_url:
        return {"id": server.id, "name": server.name, "healthy": None, "error": "no_health_check_url"}

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(server.health_check_url)
            elapsed_ms = int((time.time() - start) * 1000)
            healthy = 200 <= response.status_code < 300

            server.last_health_check_at = datetime.utcnow()
            server.last_health_status = "healthy" if healthy else f"unhealthy ({response.status_code})"
            server.status = MCPServerStatus.ACTIVE if healthy else MCPServerStatus.UNHEALTHY
            db.commit()

            return {
                "id": server.id, "name": server.name,
                "healthy": healthy, "status_code": response.status_code,
                "response_time_ms": elapsed_ms, "last_health_status": server.last_health_status,
            }
    except httpx.TimeoutException:
        server.last_health_check_at = datetime.utcnow()
        server.last_health_status = "timeout"
        server.status = MCPServerStatus.UNHEALTHY
        db.commit()
        return {"id": server.id, "name": server.name, "healthy": False, "error": "timeout"}
    except Exception as e:
        server.last_health_check_at = datetime.utcnow()
        server.last_health_status = f"error: {str(e)[:100]}"
        server.status = MCPServerStatus.UNHEALTHY
        db.commit()
        return {"id": server.id, "name": server.name, "healthy": False, "error": str(e)[:100]}


@router.post("", response_model=MCPServerResponse, status_code=status.HTTP_201_CREATED)
async def register_server(
    data: MCPServerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new MCP server."""
    server = MCPServer(
        name=data.name,
        description=data.description,
        server_url=data.server_url,
        protocol_version=data.protocol_version,
        capabilities=data.capabilities or [],
        auth_type=data.auth_type,
        auth_config=data.auth_config,
        health_check_url=data.health_check_url,
        health_check_interval_seconds=data.health_check_interval_seconds,
        component_id=data.component_id,
        owner_id=current_user.id,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return to_response(server)


@router.get("", response_model=MCPServerListResponse)
async def list_servers(
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|inactive|unhealthy)$"),
    owner_id: Optional[UUID] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List MCP servers with optional filtering."""
    query = db.query(MCPServer)

    if status_filter:
        query = query.filter(MCPServer.status == status_filter)
    if owner_id:
        query = query.filter(MCPServer.owner_id == owner_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (MCPServer.name.ilike(pattern)) | (MCPServer.description.ilike(pattern))
        )

    total = query.count()
    servers = query.order_by(MCPServer.created_at.desc()).offset(skip).limit(limit).all()
    return MCPServerListResponse(data=[to_response(s) for s in servers], total=total)


@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific MCP server."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return to_response(server)


@router.patch("/{server_id}", response_model=MCPServerResponse)
async def update_server(
    server_id: UUID,
    data: MCPServerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an MCP server (owner only)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can update this server")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)

    db.commit()
    db.refresh(server)
    return to_response(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an MCP server (owner only)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete this server")

    db.delete(server)
    db.commit()


@router.get("/{server_id}/health", response_model=MCPServerHealthResponse)
async def health_check(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a live health check on an MCP server."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return await check_server_health(server, db)


@router.post("/{server_id}/deactivate", response_model=MCPServerResponse)
async def deactivate_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate an MCP server (owner only)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can deactivate this server")

    server.status = MCPServerStatus.INACTIVE
    db.commit()
    db.refresh(server)
    return to_response(server)


@router.get("/{server_id}/connection", response_model=MCPServerConnectionResponse)
async def get_connection_config(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get connection config for an MCP server (for agents to connect)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return MCPServerConnectionResponse(
        id=server.id, name=server.name, server_url=server.server_url,
        protocol_version=server.protocol_version,
        capabilities=server.capabilities or [], auth_type=server.auth_type,
    )


@router.post("/health-check-all")
async def health_check_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run health checks on all active MCP servers (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    servers = db.query(MCPServer).filter(MCPServer.status == MCPServerStatus.ACTIVE).all()
    results = {"checked": 0, "healthy": 0, "unhealthy": 0, "details": []}

    for server in servers:
        result = await check_server_health(server, db)
        results["checked"] += 1
        if result.get("healthy"):
            results["healthy"] += 1
        elif result.get("healthy") is False:
            results["unhealthy"] += 1
        results["details"].append(result)

    return results
