"""
Jupyter Notebook Cell Execution Service

This service manages Jupyter kernels and executes notebook cells,
returning outputs in a format compatible with the frontend NotebookEditor.
"""

import asyncio
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
    execution_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)


# Active kernel sessions
kernel_sessions: dict[str, KernelSession] = {}


async def create_kernel_session(requirements_txt: str | None = None) -> KernelSession:
    """
    Create a new Jupyter kernel session.

    Args:
        requirements_txt: Optional contents of requirements.txt to install packages from.
    """
    session_id = str(uuid.uuid4())[:8]

    # Create kernel manager
    km = KernelManager(kernel_name='python3')
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
        raise RuntimeError("Kernel startup timed out")

    session = KernelSession(
        session_id=session_id,
        kernel_manager=km,
        kernel_client=kc,
    )

    kernel_sessions[session_id] = session
    print(f"[Notebook] Created kernel session: {session_id}")

    # Install packages from requirements.txt if provided
    if requirements_txt:
        await _install_requirements(session_id, requirements_txt)

    return session


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
    """Restart a kernel, preserving the session."""
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
        return True
    except Exception as e:
        print(f"[Notebook] Failed to restart kernel: {e}")
        return False


async def shutdown_kernel(session_id: str) -> bool:
    """Shutdown a kernel and cleanup the session."""
    session = kernel_sessions.pop(session_id, None)
    if not session:
        return False

    try:
        session.kernel_client.stop_channels()
        session.kernel_manager.shutdown_kernel()
        print(f"[Notebook] Shutdown kernel session: {session_id}")
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
        "is_alive": session.kernel_manager.is_alive()
    }


def list_sessions() -> list[dict[str, Any]]:
    """List all active kernel sessions."""
    return [
        {
            "session_id": s.session_id,
            "execution_count": s.execution_count,
            "created_at": s.created_at.isoformat(),
            "last_activity": s.last_activity.isoformat(),
            "is_alive": s.kernel_manager.is_alive()
        }
        for s in kernel_sessions.values()
    ]


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
