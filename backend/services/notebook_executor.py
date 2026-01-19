"""
Jupyter Notebook Cell Execution Service

This service manages Jupyter kernels and executes notebook cells,
returning outputs in a format compatible with the frontend NotebookEditor.

Supports full project context - files are written to an isolated temp directory
and the kernel runs with that directory as its working directory, allowing
imports from project files and access to datasets.
"""

import asyncio
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass, field
from typing import Any
from datetime import datetime

from jupyter_client import KernelManager
from jupyter_client.asynchronous import AsyncKernelClient


@dataclass
class KernelSession:
    """Represents an active Jupyter kernel session."""
    session_id: str
    kernel_manager: KernelManager
    kernel_client: AsyncKernelClient
    project_dir: str | None = None  # Temp directory for project files
    execution_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)


# Active kernel sessions
kernel_sessions: dict[str, KernelSession] = {}


def write_files_to_disk(files: list[dict], base_dir: str) -> None:
    """Write file tree to disk, preserving directory structure."""
    files_written = []

    def write_node(node: dict, current_path: str):
        name = node.get("name", "")
        full_path = os.path.join(current_path, name)

        if node.get("children") is not None:
            # It's a directory
            os.makedirs(full_path, exist_ok=True)
            print(f"[Notebook] Created directory: {full_path}")
            for child in node["children"]:
                write_node(child, full_path)
        else:
            # It's a file
            content = node.get("content", "")
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            files_written.append(full_path)
            print(f"[Notebook] Written file: {full_path} ({len(content)} bytes)")

    for node in files:
        write_node(node, base_dir)

    print(f"[Notebook] Total files written: {len(files_written)}")


async def create_kernel_session(
    files: list[dict] | None = None,
    requirements_txt: str | None = None
) -> KernelSession:
    """
    Create a new Jupyter kernel session with optional project context.

    Args:
        files: Optional file tree to write to the session's project directory.
               This allows the notebook to import from project files and access datasets.
        requirements_txt: Optional contents of requirements.txt to install packages from.
    """
    session_id = str(uuid.uuid4())[:8]

    # Create temp directory for project files
    project_dir = None
    if files:
        project_dir = tempfile.mkdtemp(prefix=f"notebook_{session_id}_")
        write_files_to_disk(files, project_dir)
        print(f"[Notebook] Created project directory: {project_dir}")

    # Create kernel manager
    km = KernelManager(kernel_name='python3')

    # Start kernel with project directory as cwd (if provided)
    if project_dir:
        km.start_kernel(cwd=project_dir)
    else:
        km.start_kernel()

    # Get async client
    kc = km.client()
    kc.start_channels()

    # Wait for kernel to be ready
    try:
        await asyncio.wait_for(
            asyncio.to_thread(kc.wait_for_ready),
            timeout=30.0
        )
    except asyncio.TimeoutError:
        km.shutdown_kernel()
        # Cleanup temp directory on failure
        if project_dir:
            shutil.rmtree(project_dir, ignore_errors=True)
        raise RuntimeError("Kernel startup timed out")

    session = KernelSession(
        session_id=session_id,
        kernel_manager=km,
        kernel_client=kc,
        project_dir=project_dir,
    )

    kernel_sessions[session_id] = session
    print(f"[Notebook] Created kernel session: {session_id}")

    # Initialize project directory in the kernel's Python environment
    if project_dir:
        await _init_project_environment(session_id, project_dir)

    # Install packages from requirements.txt if provided
    if requirements_txt:
        await _install_requirements(session_id, requirements_txt)

    return session


async def _init_project_environment(session_id: str, project_dir: str) -> None:
    """Initialize the kernel's Python environment to use the project directory."""
    # Escape backslashes for Windows paths
    escaped_path = project_dir.replace("\\", "\\\\")

    init_code = f'''
import sys
import os

# Add project directory to Python path for imports
project_dir = r"{project_dir}"
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

# Set working directory to project
os.chdir(project_dir)

# Clean up - don't pollute namespace
del project_dir
'''

    try:
        result = await execute_cell(session_id, init_code, timeout=10.0)
        if result["status"] == "ok":
            print(f"[Notebook] Initialized project environment for session {session_id}")
        else:
            print(f"[Notebook] Warning: Failed to initialize project environment")
    except Exception as e:
        print(f"[Notebook] Error initializing project environment: {e}")


async def _install_requirements(session_id: str, requirements_txt: str) -> None:
    """Install packages from requirements.txt content."""
    # Parse requirements.txt - extract package names, skip comments and empty lines
    packages = []
    for line in requirements_txt.strip().split('\n'):
        line = line.strip()
        # Skip empty lines and comments
        if not line or line.startswith('#'):
            continue
        # Skip options like -r, -e, --index-url, etc.
        if line.startswith('-'):
            continue
        packages.append(line)

    if not packages:
        print(f"[Notebook] No packages to install from requirements.txt")
        return

    print(f"[Notebook] Installing {len(packages)} packages from requirements.txt...")

    # Build pip install command
    packages_str = " ".join(f'"{pkg}"' for pkg in packages)
    code = f"!pip install {packages_str} -q"

    try:
        result = await execute_cell(session_id, code, timeout=300.0)

        if result["status"] == "ok":
            print(f"[Notebook] Successfully installed packages: {', '.join(packages)}")
        else:
            # Log error but don't fail session creation
            print(f"[Notebook] Warning: Some packages may have failed to install")
            for output in result["outputs"]:
                if output.get("text"):
                    print(f"[Notebook] {output['text']}")
    except Exception as e:
        print(f"[Notebook] Error installing packages: {e}")


async def get_or_create_session(session_id: str | None = None) -> KernelSession:
    """Get existing session or create a new one."""
    if session_id and session_id in kernel_sessions:
        session = kernel_sessions[session_id]
        session.last_activity = datetime.now()
        return session

    return await create_kernel_session()


async def execute_cell(
    session_id: str,
    code: str,
    timeout: float = 60.0
) -> dict[str, Any]:
    """
    Execute a code cell and return outputs.

    Returns dict with:
    - execution_count: int
    - outputs: list of output objects
    - status: "ok" | "error"
    """
    session = kernel_sessions.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    session.last_activity = datetime.now()
    session.execution_count += 1
    exec_count = session.execution_count

    kc = session.kernel_client
    outputs: list[dict] = []
    status = "ok"

    # Execute the code
    msg_id = kc.execute(code)

    # Collect outputs
    try:
        while True:
            try:
                msg = await asyncio.wait_for(
                    asyncio.to_thread(kc.get_iopub_msg),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                outputs.append({
                    "output_type": "error",
                    "ename": "TimeoutError",
                    "evalue": f"Cell execution timed out after {timeout}s",
                    "traceback": [f"TimeoutError: Cell execution timed out after {timeout}s"]
                })
                status = "error"
                break

            msg_type = msg['header']['msg_type']
            content = msg['content']

            # Check if this message is for our execution
            if msg['parent_header'].get('msg_id') != msg_id:
                continue

            if msg_type == 'status':
                if content['execution_state'] == 'idle':
                    # Execution complete
                    break

            elif msg_type == 'stream':
                # stdout/stderr output
                outputs.append({
                    "output_type": "stream",
                    "name": content.get('name', 'stdout'),
                    "text": [content.get('text', '')]
                })

            elif msg_type == 'execute_result':
                # Return value
                outputs.append({
                    "output_type": "execute_result",
                    "execution_count": exec_count,
                    "data": content.get('data', {}),
                    "metadata": content.get('metadata', {})
                })

            elif msg_type == 'display_data':
                # Display output (images, HTML, etc.)
                outputs.append({
                    "output_type": "display_data",
                    "data": content.get('data', {}),
                    "metadata": content.get('metadata', {})
                })

            elif msg_type == 'error':
                # Error output
                outputs.append({
                    "output_type": "error",
                    "ename": content.get('ename', 'Error'),
                    "evalue": content.get('evalue', ''),
                    "traceback": content.get('traceback', [])
                })
                status = "error"

    except Exception as e:
        outputs.append({
            "output_type": "error",
            "ename": type(e).__name__,
            "evalue": str(e),
            "traceback": [f"{type(e).__name__}: {e}"]
        })
        status = "error"

    return {
        "execution_count": exec_count,
        "outputs": outputs,
        "status": status
    }


async def interrupt_kernel(session_id: str) -> bool:
    """Interrupt a running kernel."""
    session = kernel_sessions.get(session_id)
    if not session:
        return False

    try:
        session.kernel_manager.interrupt_kernel()
        return True
    except Exception as e:
        print(f"[Notebook] Failed to interrupt kernel: {e}")
        return False


async def restart_kernel(session_id: str) -> bool:
    """Restart a kernel, preserving the session and project context."""
    session = kernel_sessions.get(session_id)
    if not session:
        return False

    try:
        session.kernel_manager.restart_kernel()
        session.execution_count = 0
        session.last_activity = datetime.now()

        # Wait for kernel to be ready
        await asyncio.wait_for(
            asyncio.to_thread(session.kernel_client.wait_for_ready),
            timeout=30.0
        )

        # Re-initialize project environment if it was set up
        if session.project_dir:
            await _init_project_environment(session_id, session.project_dir)

        return True
    except Exception as e:
        print(f"[Notebook] Failed to restart kernel: {e}")
        return False


async def shutdown_kernel(session_id: str) -> bool:
    """Shutdown a kernel and cleanup the session, including temp directory."""
    session = kernel_sessions.pop(session_id, None)
    if not session:
        return False

    try:
        session.kernel_client.stop_channels()
        session.kernel_manager.shutdown_kernel()
        print(f"[Notebook] Shutdown kernel session: {session_id}")

        # Cleanup project directory if it exists
        if session.project_dir:
            try:
                shutil.rmtree(session.project_dir, ignore_errors=True)
                print(f"[Notebook] Cleaned up project directory: {session.project_dir}")
            except Exception as cleanup_error:
                print(f"[Notebook] Warning: Failed to cleanup project directory: {cleanup_error}")

        return True
    except Exception as e:
        print(f"[Notebook] Error during kernel shutdown: {e}")
        return False


async def get_kernel_info(session_id: str) -> dict[str, Any] | None:
    """Get information about a kernel session."""
    session = kernel_sessions.get(session_id)
    if not session:
        return None

    return {
        "session_id": session.session_id,
        "execution_count": session.execution_count,
        "created_at": session.created_at.isoformat(),
        "last_activity": session.last_activity.isoformat(),
        "is_alive": session.kernel_manager.is_alive(),
        "has_project": session.project_dir is not None,
    }


def list_sessions() -> list[dict[str, Any]]:
    """List all active kernel sessions."""
    return [
        {
            "session_id": s.session_id,
            "execution_count": s.execution_count,
            "created_at": s.created_at.isoformat(),
            "last_activity": s.last_activity.isoformat(),
            "is_alive": s.kernel_manager.is_alive(),
            "has_project": s.project_dir is not None,
        }
        for s in kernel_sessions.values()
    ]


async def update_session_file(session_id: str, file_path: str, content: str) -> bool:
    """
    Update a file in the session's project directory.

    Args:
        session_id: The kernel session ID
        file_path: Relative path to the file (e.g., "utils/helpers.py")
        content: New content for the file

    Returns:
        True if successful, False otherwise
    """
    session = kernel_sessions.get(session_id)
    if not session or not session.project_dir:
        return False

    # Sanitize path to prevent directory traversal
    file_path = file_path.replace("\\", "/").lstrip("/")
    if ".." in file_path:
        print(f"[Notebook] Invalid file path (directory traversal): {file_path}")
        return False

    full_path = os.path.join(session.project_dir, file_path)

    try:
        # Ensure parent directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Write the updated content
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"[Notebook] Updated file in session {session_id}: {file_path}")
        session.last_activity = datetime.now()
        return True
    except Exception as e:
        print(f"[Notebook] Error updating file: {e}")
        return False


async def cleanup_idle_sessions(max_idle_minutes: int = 30):
    """Cleanup sessions that have been idle for too long."""
    now = datetime.now()
    to_remove = []

    for session_id, session in kernel_sessions.items():
        idle_minutes = (now - session.last_activity).total_seconds() / 60
        if idle_minutes > max_idle_minutes:
            to_remove.append(session_id)

    for session_id in to_remove:
        await shutdown_kernel(session_id)
        print(f"[Notebook] Cleaned up idle session: {session_id}")
