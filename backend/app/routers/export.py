"""Export router for downloading agent configurations."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.exporter import ExportService


router = APIRouter(prefix="/api/agents", tags=["export"])


class ExportRequest(BaseModel):
    """Request body for agent export."""
    excluded_component_ids: list[UUID] = []


@router.post("/{agent_id}/export")
async def export_agent(
    agent_id: UUID,
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export an agent's configuration as a zip file.

    Args:
        agent_id: The agent's UUID.
        export_request: Export options including excluded component IDs.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        StreamingResponse with the zip file.

    Raises:
        HTTPException: If the agent is not found or has no current version.
    """
    service = ExportService(db)

    try:
        zip_buffer, filename = service.export_agent(
            agent_id=agent_id,
            excluded_component_ids=export_request.excluded_component_ids,
        )
    except ValueError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        elif "no current version" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
