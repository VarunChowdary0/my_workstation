"""
Notebook API Router

Provides endpoints for Jupyter notebook cell execution.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.notebook_executor import (
    create_kernel_session,
    execute_cell,
    get_kernel_info,
    interrupt_kernel,
    list_sessions,
    restart_kernel,
    shutdown_kernel,
)

router = APIRouter()


# Request/Response Models

class CreateSessionRequest(BaseModel):
    requirements_txt: str | None = None  # Contents of requirements.txt to install


class CreateSessionResponse(BaseModel):
    session_id: str
    message: str


class ExecuteCellRequest(BaseModel):
    session_id: str
    code: str
    timeout: float = 60.0


class ExecuteCellResponse(BaseModel):
    execution_count: int
    outputs: list[dict[str, Any]]
    status: str


class SessionInfoResponse(BaseModel):
    session_id: str
    execution_count: int
    created_at: str
    last_activity: str
    is_alive: bool


class SessionListResponse(BaseModel):
    sessions: list[SessionInfoResponse]


class InstallPackageRequest(BaseModel):
    session_id: str
    packages: list[str]  # e.g., ["numpy", "pandas>=2.0.0"]


class InstallPackageResponse(BaseModel):
    success: bool
    installed: list[str]
    failed: list[str]
    output: str


# Endpoints

@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest | None = None):
    """
    Create a new kernel session.

    Optionally accepts requirements.txt content to install packages automatically.
    """
    try:
        requirements = request.requirements_txt if request else None
        session = await create_kernel_session(requirements_txt=requirements)
        return CreateSessionResponse(
            session_id=session.session_id,
            message="Kernel session created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create kernel: {str(e)}")


@router.post("/execute", response_model=ExecuteCellResponse)
async def execute(request: ExecuteCellRequest):
    """Execute a code cell in a kernel session."""
    try:
        result = await execute_cell(
            session_id=request.session_id,
            code=request.code,
            timeout=request.timeout
        )
        return ExecuteCellResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions():
    """List all active kernel sessions."""
    sessions = list_sessions()
    return SessionListResponse(sessions=sessions)


@router.get("/sessions/{session_id}", response_model=SessionInfoResponse)
async def get_session(session_id: str):
    """Get information about a specific kernel session."""
    info = await get_kernel_info(session_id)
    if not info:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionInfoResponse(**info)


@router.post("/sessions/{session_id}/interrupt")
async def interrupt(session_id: str):
    """Interrupt a running kernel."""
    success = await interrupt_kernel(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "message": "Kernel interrupted"}


@router.post("/sessions/{session_id}/restart")
async def restart(session_id: str):
    """Restart a kernel, clearing all state."""
    success = await restart_kernel(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or restart failed")
    return {"success": True, "message": "Kernel restarted"}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Shutdown and delete a kernel session."""
    success = await shutdown_kernel(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "message": "Session deleted"}


@router.post("/install", response_model=InstallPackageResponse)
async def install_packages(request: InstallPackageRequest):
    """
    Install Python packages via pip in the kernel session.

    Uses `%pip install` magic command which installs packages into
    the same environment as the running kernel.
    """
    if not request.packages:
        raise HTTPException(status_code=400, detail="No packages specified")

    # Sanitize package names (basic validation)
    sanitized = []
    for pkg in request.packages:
        # Only allow alphanumeric, hyphen, underscore, brackets, comparison operators
        pkg = pkg.strip()
        if pkg and all(c.isalnum() or c in "-_[]<>=.,! " for c in pkg):
            sanitized.append(pkg)

    if not sanitized:
        raise HTTPException(status_code=400, detail="Invalid package names")

    # Build pip install command using %pip magic (works in Jupyter kernels)
    packages_str = " ".join(f'"{pkg}"' for pkg in sanitized)
    code = f"!pip install {packages_str}"

    try:
        result = await execute_cell(
            session_id=request.session_id,
            code=code,
            timeout=300.0  # 5 minute timeout for installations
        )

        # Parse output to determine success/failure
        output_text = ""
        for output in result["outputs"]:
            if output.get("text"):
                output_text += "".join(output["text"])
            elif output.get("data", {}).get("text/plain"):
                text = output["data"]["text/plain"]
                output_text += "".join(text) if isinstance(text, list) else text

        # Check for success indicators
        installed = []
        failed = []

        for pkg in sanitized:
            pkg_name = pkg.split("[")[0].split("<")[0].split(">")[0].split("=")[0].split("!")[0].strip()
            if f"Successfully installed" in output_text and pkg_name.lower() in output_text.lower():
                installed.append(pkg)
            elif f"Requirement already satisfied: {pkg_name}" in output_text:
                installed.append(pkg)  # Already installed counts as success
            elif "ERROR" in output_text and pkg_name.lower() in output_text.lower():
                failed.append(pkg)
            else:
                # Assume success if no explicit error
                installed.append(pkg)

        return InstallPackageResponse(
            success=len(failed) == 0,
            installed=installed,
            failed=failed,
            output=output_text
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Installation failed: {str(e)}")
