"""Docker service for managing agent containers."""

import json
import tempfile
import shutil
from pathlib import Path
from typing import Optional
import docker
from docker.errors import DockerException, NotFound, APIError

from app.config import settings


class DockerService:
    """Service for managing Docker containers for deployed agents."""

    # Base runtime files template directory
    RUNTIME_TEMPLATE_DIR = Path(__file__).parent.parent / "runtime"

    def __init__(self):
        """Initialize Docker client."""
        try:
            # Explicitly use Unix socket to avoid http+docker scheme issues
            self.client = docker.DockerClient(base_url="unix:///var/run/docker.sock")
            # Test connection
            self.client.ping()
        except DockerException as e:
            raise RuntimeError(f"Failed to connect to Docker daemon: {e}")

    def build_image(
        self,
        agent_id: str,
        version_id: str,
        config: dict,
    ) -> str:
        """Build Docker image for an agent.

        Args:
            agent_id: The agent's UUID.
            version_id: The version's UUID.
            config: The compiled agent configuration.

        Returns:
            The built image ID.

        Raises:
            DockerException: If image build fails.
        """
        tag = f"agent-hr-agent-{agent_id[:8]}:{version_id[:8]}"

        # Create temporary build context
        with tempfile.TemporaryDirectory() as build_dir:
            build_path = Path(build_dir)

            # Copy runtime template files
            self._copy_runtime_files(build_path)

            # Write agent config
            config_dir = build_path / "config"
            config_dir.mkdir(exist_ok=True)
            (config_dir / "agent.json").write_text(json.dumps(config, indent=2))

            # Build image
            image, logs = self.client.images.build(
                path=str(build_path),
                tag=tag,
                rm=True,
                forcerm=True,
            )

            return image.id

    def create_container(
        self,
        image_id: str,
        deployment_id: str,
    ) -> tuple[str, int]:
        """Create and start a container from an image.

        Args:
            image_id: The Docker image ID.
            deployment_id: The deployment's UUID (used for naming).

        Returns:
            Tuple of (container_id, assigned_port).

        Raises:
            DockerException: If container creation fails.
        """
        container_name = f"agent-{deployment_id[:8]}"

        # Remove any existing container with this name
        try:
            existing = self.client.containers.get(container_name)
            existing.remove(force=True)
        except NotFound:
            pass

        # Create and start container
        container = self.client.containers.run(
            image_id,
            detach=True,
            name=container_name,
            ports={"8080/tcp": None},  # Dynamic port assignment
            environment={
                "ANTHROPIC_API_KEY": settings.anthropic_api_key,
            },
            restart_policy={"Name": "unless-stopped"},
        )

        # Get assigned port
        container.reload()
        port_bindings = container.ports.get("8080/tcp", [])
        if not port_bindings:
            raise DockerException("No port binding found for container")

        port = int(port_bindings[0]["HostPort"])
        return container.id, port

    def stop_container(self, container_id: str, timeout: int = 10) -> None:
        """Stop a running container gracefully.

        Args:
            container_id: The Docker container ID.
            timeout: Seconds to wait before forcing stop.

        Raises:
            NotFound: If container doesn't exist.
        """
        container = self.client.containers.get(container_id)
        container.stop(timeout=timeout)

    def remove_container(self, container_id: str, force: bool = True) -> None:
        """Remove a container.

        Args:
            container_id: The Docker container ID.
            force: Force removal even if running.

        Raises:
            NotFound: If container doesn't exist.
        """
        container = self.client.containers.get(container_id)
        container.remove(force=force)

    def get_container_status(self, container_id: str) -> dict:
        """Get container status and health information.

        Args:
            container_id: The Docker container ID.

        Returns:
            Dictionary with status and health info.

        Raises:
            NotFound: If container doesn't exist.
        """
        container = self.client.containers.get(container_id)
        container.reload()

        state = container.attrs.get("State", {})
        health = state.get("Health", {})

        return {
            "status": container.status,
            "running": state.get("Running", False),
            "health": health.get("Status", "unknown"),
            "started_at": state.get("StartedAt"),
            "finished_at": state.get("FinishedAt"),
        }

    def container_exists(self, container_id: str) -> bool:
        """Check if a container exists.

        Args:
            container_id: The Docker container ID.

        Returns:
            True if container exists, False otherwise.
        """
        try:
            self.client.containers.get(container_id)
            return True
        except NotFound:
            return False

    def get_container_logs(
        self,
        container_id: str,
        tail: int = 100,
    ) -> str:
        """Get container logs.

        Args:
            container_id: The Docker container ID.
            tail: Number of lines from the end to return.

        Returns:
            Log output as string.
        """
        container = self.client.containers.get(container_id)
        return container.logs(tail=tail).decode("utf-8")

    def _copy_runtime_files(self, dest_path: Path) -> None:
        """Copy runtime template files to build directory.

        Args:
            dest_path: Destination directory path.
        """
        if self.RUNTIME_TEMPLATE_DIR.exists():
            shutil.copytree(
                self.RUNTIME_TEMPLATE_DIR,
                dest_path,
                dirs_exist_ok=True,
            )
        else:
            # Create minimal runtime files if template doesn't exist
            self._create_default_runtime_files(dest_path)

    def _create_default_runtime_files(self, dest_path: Path) -> None:
        """Create default runtime files for agent container.

        Args:
            dest_path: Destination directory path.
        """
        # Dockerfile
        dockerfile = '''FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \\
    anthropic \\
    fastapi \\
    uvicorn[standard] \\
    websockets \\
    aiohttp

COPY server.py agent.py ./
COPY config/ ./config/

EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
'''
        (dest_path / "Dockerfile").write_text(dockerfile)

        # server.py
        server_py = '''"""FastAPI server for agent container."""

import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from agent import AgentRunner

app = FastAPI(title="Agent Runtime")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = AgentRunner()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


class InjectContextRequest(BaseModel):
    content: str
    name: Optional[str] = None


class WorkingMemoryEntry(BaseModel):
    name: str
    content: str


class WorkingMemoryResponse(BaseModel):
    success: bool
    entries: List[WorkingMemoryEntry]
    message: str


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/config")
async def config():
    """Return agent configuration summary."""
    return runner.get_config_summary()


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message and get a response."""
    conversation_id = request.conversation_id or str(uuid.uuid4())
    response = await runner.chat(request.message, conversation_id)
    return ChatResponse(response=response, conversation_id=conversation_id)


@app.get("/working-memory", response_model=WorkingMemoryResponse)
async def get_working_memory():
    """Get current working memory entries."""
    entries = runner.get_working_memory()
    return WorkingMemoryResponse(
        success=True,
        entries=[WorkingMemoryEntry(name=e["name"], content=e["content"]) for e in entries],
        message=f"{len(entries)} entries in working memory"
    )


@app.post("/inject-context", response_model=WorkingMemoryResponse)
async def inject_context(request: InjectContextRequest):
    """Inject context into the agent's working memory."""
    name = request.name or f"injected_{uuid.uuid4().hex[:8]}"
    runner.inject_context(name, request.content)
    entries = runner.get_working_memory()
    return WorkingMemoryResponse(
        success=True,
        entries=[WorkingMemoryEntry(name=e["name"], content=e["content"]) for e in entries],
        message=f"Injected '{name}' into working memory"
    )


@app.delete("/working-memory", response_model=WorkingMemoryResponse)
async def clear_working_memory():
    """Clear all working memory entries."""
    runner.clear_working_memory()
    return WorkingMemoryResponse(
        success=True,
        entries=[],
        message="Working memory cleared"
    )


@app.websocket("/ws")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat."""
    await websocket.accept()
    conversation_id = None

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            conversation_id = data.get("conversation_id") or conversation_id or str(uuid.uuid4())

            async for chunk in runner.stream(message, conversation_id):
                await websocket.send_json({
                    "type": "chunk",
                    "content": chunk,
                    "conversation_id": conversation_id,
                })

            await websocket.send_json({
                "type": "done",
                "conversation_id": conversation_id,
            })
    except WebSocketDisconnect:
        pass
'''
        (dest_path / "server.py").write_text(server_py)

        # agent.py
        agent_py = '''"""Agent runner using Anthropic API."""

import json
import os
from pathlib import Path
from typing import AsyncIterator
import anthropic


class AgentRunner:
    """Runs the agent using Anthropic API."""

    def __init__(self):
        """Initialize agent from config."""
        config_path = Path("/app/config/agent.json")
        self.config = json.loads(config_path.read_text())
        self.conversations: dict[str, list] = {}
        self.working_memory: list[dict] = []  # Runtime injected context

        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self.model = self.config.get("model", "claude-sonnet-4-5-20250929")

    def get_config_summary(self) -> dict:
        """Return a summary of the agent configuration."""
        return {
            "model": self.model,
            "has_tools": len(self.config.get("tools", [])) > 0,
            "skill_count": len(self.config.get("skills", [])),
            "memory_count": len(self.config.get("memory", [])),
            "working_memory_count": len(self.working_memory),
        }

    def inject_context(self, name: str, content: str) -> None:
        """Inject context into working memory.

        Args:
            name: Name/key for the memory entry.
            content: Content to inject.
        """
        # Remove existing entry with same name if exists
        self.working_memory = [m for m in self.working_memory if m["name"] != name]
        self.working_memory.append({"name": name, "content": content})
        # Clear conversation history so new context takes effect immediately
        self.conversations.clear()

    def get_working_memory(self) -> list[dict]:
        """Get current working memory entries."""
        return self.working_memory

    def clear_working_memory(self) -> None:
        """Clear all working memory entries."""
        self.working_memory = []
        # Also clear conversation history
        self.conversations.clear()

    def _build_system_prompt(self) -> str:
        """Build system prompt including working memory."""
        base_prompt = self.config.get("system_prompt", "You are a helpful assistant.")

        if not self.working_memory:
            return base_prompt

        # Append working memory context
        memory_context = "\\n\\n## Working Memory (Injected Context)\\n"
        for entry in self.working_memory:
            memory_context += f"\\n### {entry['name']}\\n{entry['content']}\\n"

        return base_prompt + memory_context

    async def chat(self, message: str, conversation_id: str) -> str:
        """Process a chat message and return response.

        Args:
            message: The user's message.
            conversation_id: Conversation identifier for history.

        Returns:
            The agent's response.
        """
        history = self.conversations.get(conversation_id, [])

        messages = history + [{"role": "user", "content": message}]

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=self._build_system_prompt(),
            messages=messages,
        )

        assistant_message = response.content[0].text

        # Update conversation history
        self.conversations[conversation_id] = messages + [
            {"role": "assistant", "content": assistant_message}
        ]

        return assistant_message

    async def stream(self, message: str, conversation_id: str) -> AsyncIterator[str]:
        """Stream a chat response.

        Args:
            message: The user's message.
            conversation_id: Conversation identifier for history.

        Yields:
            Response chunks as they arrive.
        """
        history = self.conversations.get(conversation_id, [])
        messages = history + [{"role": "user", "content": message}]

        full_response = ""

        with self.client.messages.stream(
            model=self.model,
            max_tokens=4096,
            system=self._build_system_prompt(),
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                full_response += text
                yield text

        # Update conversation history
        self.conversations[conversation_id] = messages + [
            {"role": "assistant", "content": full_response}
        ]
'''
        (dest_path / "agent.py").write_text(agent_py)

        # Create config directory
        (dest_path / "config").mkdir(exist_ok=True)
