"""Deployments router for managing agent container deployments."""

import uuid
from typing import Optional
from uuid import UUID

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Agent, AgentDeployment, DeploymentStatus, User
from app.services.deployment_service import DeploymentService
from app.schemas.deployment import (
    ChatRequest,
    ChatResponse,
    DeploymentListResponse,
    DeploymentResponse,
    DeploymentWithContainerResponse,
    DeployRequest,
    DeployResponse,
)

router = APIRouter(tags=["deployments"])


def get_deployment_service(db: Session = Depends(get_db)) -> DeploymentService:
    """Dependency to get deployment service instance."""
    return DeploymentService(db)


@router.post("/api/agents/{agent_id}/deploy", response_model=DeployResponse)
async def deploy_agent(
    agent_id: UUID,
    deploy_data: DeployRequest = DeployRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """Deploy an agent as a Docker container.

    Args:
        agent_id: The agent's UUID.
        deploy_data: Optional deployment configuration.
        db: Database session.
        current_user: The authenticated user.
        deployment_service: Deployment service instance.

    Returns:
        The created deployment and status message.

    Raises:
        HTTPException: If agent not found or deployment fails.
    """
    # Get agent and determine version
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    version_id = deploy_data.version_id or agent.current_version_id
    if not version_id:
        raise HTTPException(
            status_code=400,
            detail="Agent has no versions. Upload a configuration first."
        )

    try:
        deployment = await deployment_service.deploy(
            agent_id=agent_id,
            version_id=version_id,
            user_id=current_user.id,
        )
        return DeployResponse(
            deployment=DeploymentResponse.model_validate(deployment),
            message="Deployment started successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")


@router.get("/api/agents/{agent_id}/deployments", response_model=DeploymentListResponse)
async def list_agent_deployments(
    agent_id: UUID,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """List all deployments for an agent.

    Args:
        agent_id: The agent's UUID.
        status_filter: Optional status to filter by.
        db: Database session.
        current_user: The authenticated user.
        deployment_service: Deployment service instance.

    Returns:
        List of deployments.
    """
    deployments = deployment_service.list_deployments(
        agent_id=agent_id,
        status=status_filter,
    )
    return DeploymentListResponse(
        data=[DeploymentResponse.model_validate(d) for d in deployments],
        total=len(deployments),
    )


@router.get("/api/agents/{agent_id}/deployment/active", response_model=Optional[DeploymentWithContainerResponse])
async def get_active_deployment(
    agent_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """Get the active (running) deployment for an agent.

    Args:
        agent_id: The agent's UUID.
        db: Database session.
        current_user: The authenticated user.
        deployment_service: Deployment service instance.

    Returns:
        The active deployment, or null if none.
    """
    deployment = deployment_service.get_active_deployment(agent_id)
    if not deployment:
        return None

    status_info = deployment_service.get_status(deployment.id)
    return DeploymentWithContainerResponse(
        **DeploymentResponse.model_validate(deployment).model_dump(),
        container=status_info.get("container"),
    )


@router.get("/api/deployments/{deployment_id}", response_model=DeploymentWithContainerResponse)
async def get_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """Get deployment status including container health.

    Args:
        deployment_id: The deployment's UUID.
        db: Database session.
        current_user: The authenticated user.
        deployment_service: Deployment service instance.

    Returns:
        Deployment status with container info.

    Raises:
        HTTPException: If deployment not found.
    """
    try:
        status_info = deployment_service.get_status(deployment_id)

        deployment = db.query(AgentDeployment).filter(
            AgentDeployment.id == deployment_id
        ).first()

        return DeploymentWithContainerResponse(
            **DeploymentResponse.model_validate(deployment).model_dump(),
            container=status_info.get("container"),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/api/deployments/{deployment_id}/stop", response_model=DeploymentResponse)
async def stop_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """Stop a running deployment.

    Args:
        deployment_id: The deployment's UUID.
        db: Database session.
        current_user: The authenticated user.
        deployment_service: Deployment service instance.

    Returns:
        The updated deployment.

    Raises:
        HTTPException: If deployment not found or not running.
    """
    try:
        deployment = await deployment_service.stop(deployment_id)
        return DeploymentResponse.model_validate(deployment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/deployments/stop-all")
async def stop_all_deployments(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """Stop all running deployments. Admin only.

    Args:
        db: Database session.
        admin: The authenticated admin user.
        deployment_service: Deployment service instance.

    Returns:
        Summary of stopped deployments.
    """
    # Get all running deployments
    running_deployments = db.query(AgentDeployment).filter(
        AgentDeployment.status == DeploymentStatus.RUNNING.value
    ).all()

    stopped_count = 0
    failed_count = 0
    errors = []

    for deployment in running_deployments:
        try:
            await deployment_service.stop(deployment.id)
            stopped_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({
                "deployment_id": str(deployment.id),
                "agent_id": str(deployment.agent_id),
                "error": str(e),
            })

    return {
        "message": f"Stopped {stopped_count} deployment(s)",
        "stopped_count": stopped_count,
        "failed_count": failed_count,
        "errors": errors if errors else None,
    }


@router.post("/api/deployments/{deployment_id}/chat", response_model=ChatResponse)
async def chat_with_deployment(
    deployment_id: UUID,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message to a deployed agent.

    Args:
        deployment_id: The deployment's UUID.
        chat_request: The chat message.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The agent's response.

    Raises:
        HTTPException: If deployment not found or not running.
    """
    deployment = db.query(AgentDeployment).filter(
        AgentDeployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if deployment.status != DeploymentStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Deployment is not running (status: {deployment.status})"
        )

    if not deployment.port:
        raise HTTPException(status_code=500, detail="Deployment has no assigned port")

    # Proxy request to container
    # Use host.docker.internal to reach host from inside Docker container (Mac/Windows)
    container_url = f"http://host.docker.internal:{deployment.port}/chat"
    conversation_id = chat_request.conversation_id or str(uuid.uuid4())

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                container_url,
                json={
                    "message": chat_request.message,
                    "conversation_id": conversation_id,
                },
                timeout=aiohttp.ClientTimeout(total=120),
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Agent error: {error_text}"
                    )

                data = await response.json()
                return ChatResponse(
                    response=data.get("response", ""),
                    conversation_id=data.get("conversation_id", conversation_id),
                )
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to agent container: {str(e)}"
        )


@router.websocket("/api/deployments/{deployment_id}/ws")
async def websocket_chat(
    websocket: WebSocket,
    deployment_id: UUID,
    db: Session = Depends(get_db),
):
    """WebSocket endpoint for streaming chat with deployed agent.

    Args:
        websocket: The WebSocket connection.
        deployment_id: The deployment's UUID.
        db: Database session.
    """
    deployment = db.query(AgentDeployment).filter(
        AgentDeployment.id == deployment_id
    ).first()

    if not deployment:
        await websocket.close(code=4004, reason="Deployment not found")
        return

    if deployment.status != DeploymentStatus.RUNNING.value:
        await websocket.close(code=4000, reason=f"Deployment not running: {deployment.status}")
        return

    if not deployment.port:
        await websocket.close(code=4002, reason="No port assigned")
        return

    await websocket.accept()

    # Connect to container WebSocket
    # Use host.docker.internal to reach host from inside Docker container (Mac/Windows)
    # On Linux, use the Docker bridge gateway IP or host network mode
    container_ws_url = f"ws://host.docker.internal:{deployment.port}/ws"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(container_ws_url) as container_ws:
                # Forward messages between client and container
                import asyncio

                async def forward_to_container():
                    try:
                        while True:
                            data = await websocket.receive_json()
                            await container_ws.send_json(data)
                    except WebSocketDisconnect:
                        await container_ws.close()

                async def forward_to_client():
                    try:
                        async for msg in container_ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                await websocket.send_text(msg.data)
                            elif msg.type == aiohttp.WSMsgType.ERROR:
                                break
                    except Exception:
                        pass

                # Run both directions concurrently
                await asyncio.gather(
                    forward_to_container(),
                    forward_to_client(),
                    return_exceptions=True,
                )
    except Exception as e:
        try:
            await websocket.close(code=4003, reason=str(e)[:123])  # Reason must be < 125 bytes
        except Exception:
            pass  # Connection may already be closed


# =============================================================================
# Working Memory Endpoints
# =============================================================================


@router.get("/api/deployments/{deployment_id}/working-memory")
async def get_working_memory(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current working memory for a deployment.

    Working memory is runtime-specific and contains the current task context.

    Args:
        deployment_id: The deployment's UUID.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        Current working memory entries for the deployment.

    Raises:
        HTTPException: If deployment not found.
    """
    deployment = db.query(AgentDeployment).filter(
        AgentDeployment.id == deployment_id
    ).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if deployment.status != DeploymentStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Deployment is not running (status: {deployment.status})"
        )

    if not deployment.port:
        raise HTTPException(status_code=500, detail="Deployment has no assigned port")

    # Fetch working memory from container
    container_url = f"http://host.docker.internal:{deployment.port}/working-memory"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                container_url,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Container error: {error_text}"
                    )
                data = await response.json()
                entries = data.get("entries", [])

                # Transform entries to match frontend WorkingMemoryState structure
                # All injected entries are considered "user" sourced
                user_injected = [
                    {
                        "id": f"{deployment_id}-{i}",
                        "content": entry.get("content", ""),
                        "source": "user",
                        "created_at": None,
                    }
                    for i, entry in enumerate(entries)
                ]

                return {
                    "items": [],  # System items (not implemented yet)
                    "user_injected": user_injected,
                }
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to agent container: {str(e)}"
        )


@router.post("/api/deployments/{deployment_id}/working-memory")
async def add_working_memory(
    deployment_id: UUID,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inject content into working memory for a deployment.

    Allows injecting contextual information into an agent's working memory
    during an active session. This is useful for providing real-time context.

    Args:
        deployment_id: The deployment's UUID.
        data: JSON body with 'content' (required) and 'name' (optional).
        db: Database session.
        current_user: The authenticated user.

    Returns:
        Success status and confirmation message.

    Raises:
        HTTPException: If deployment not found or not running.
    """
    deployment = db.query(AgentDeployment).filter(
        AgentDeployment.id == deployment_id
    ).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if deployment.status != DeploymentStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Deployment is not running (status: {deployment.status})"
        )

    if not deployment.port:
        raise HTTPException(status_code=500, detail="Deployment has no assigned port")

    content = data.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")

    name = data.get("name")

    # Inject context into container
    container_url = f"http://host.docker.internal:{deployment.port}/inject-context"

    try:
        async with aiohttp.ClientSession() as session:
            payload = {"content": content}
            if name:
                payload["name"] = name

            async with session.post(
                container_url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Container error: {error_text}"
                    )

                response_data = await response.json()
                entries = response_data.get("entries", [])

                # Transform entries to match frontend WorkingMemoryState structure
                user_injected = [
                    {
                        "id": f"{deployment_id}-{i}",
                        "content": entry.get("content", ""),
                        "source": "user",
                        "created_at": None,
                    }
                    for i, entry in enumerate(entries)
                ]

                return {
                    "items": [],
                    "user_injected": user_injected,
                }
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to agent container: {str(e)}"
        )


@router.delete("/api/deployments/{deployment_id}/working-memory")
async def clear_working_memory(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all working memory for a deployment.

    Removes all transient working memory entries for the specified deployment.
    This is typically called when resetting a conversation or task context.

    Args:
        deployment_id: The deployment's UUID.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        Success status and confirmation message.

    Raises:
        HTTPException: If deployment not found.
    """
    deployment = db.query(AgentDeployment).filter(
        AgentDeployment.id == deployment_id
    ).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if deployment.status != DeploymentStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Deployment is not running (status: {deployment.status})"
        )

    if not deployment.port:
        raise HTTPException(status_code=500, detail="Deployment has no assigned port")

    # Clear working memory in container
    container_url = f"http://host.docker.internal:{deployment.port}/working-memory"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                container_url,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Container error: {error_text}"
                    )

                # Return empty working memory state
                return {
                    "items": [],
                    "user_injected": [],
                }
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to agent container: {str(e)}"
        )
