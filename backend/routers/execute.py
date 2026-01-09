import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.executor import (
    active_sessions,
    cleanup_session,
    create_session,
    execute_project,
    stop_session,
)

router = APIRouter()


class FileNode(BaseModel):
    name: str
    content: str | None = None
    isEditable: bool | None = True
    children: list["FileNode"] | None = None


class RunRequest(BaseModel):
    files: list[FileNode]


class RunResponse(BaseModel):
    session_id: str
    project_type: str
    port: int
    message: str


class StopRequest(BaseModel):
    session_id: str


class UpdateFileRequest(BaseModel):
    session_id: str
    file_path: str  # Relative path like "src/App.tsx"
    content: str


@router.post("/run", response_model=RunResponse)
async def run_project(request: RunRequest):
    """Start running a project."""
    print(f"[Run] Received run request with {len(request.files)} files")

    # Convert Pydantic models to dicts
    files_data = [f.model_dump() for f in request.files]

    # Create session
    session = await create_session(files_data)
    print(f"[Run] Session created: {session.session_id}, type: {session.project_type.value}, port: {session.port}")
    print(f"[Run] Active sessions: {list(active_sessions.keys())}")

    # Start execution in background
    asyncio.create_task(execute_project(session))

    return RunResponse(
        session_id=session.session_id,
        project_type=session.project_type.value,
        port=session.port,
        message=f"Started execution for {session.project_type.value} project on port {session.port}",
    )


@router.get("/stream/{session_id}")
async def stream_output(session_id: str):
    """Stream output from a running session via SSE."""
    print(f"[Stream] Request for session {session_id}")
    session = active_sessions.get(session_id)
    if not session:
        print(f"[Stream] Session {session_id} not found")
        raise HTTPException(status_code=404, detail="Session not found")

    print(f"[Stream] Session found, starting generator")

    async def event_generator():
        try:
            print(f"[Stream] Sending CONNECTED")
            # Send initial connection message
            yield f"data: [CONNECTED]\n\n"

            while True:
                try:
                    # Wait for output with shorter timeout for heartbeat
                    output = await asyncio.wait_for(
                        session.output_queue.get(),
                        timeout=30.0  # 30 second timeout for heartbeat
                    )

                    if output is None:
                        # End of output
                        yield f"data: [END]\n\n"
                        break

                    # Escape newlines for SSE
                    escaped = output.replace("\n", "\\n").replace("\r", "\\r")
                    print(f"[Stream] Sending: {escaped[:50]}...")
                    yield f"data: {escaped}\n\n"

                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    if session.is_running:
                        yield f": heartbeat\n\n"
                    else:
                        # Process ended but no None was received - end stream
                        yield f"data: [END]\n\n"
                        break

        except asyncio.CancelledError:
            print(f"[Stream] CancelledError")
        except GeneratorExit:
            print(f"[Stream] GeneratorExit")
        except Exception as e:
            print(f"[Stream] Exception: {e}")
        finally:
            print(f"[Stream] Generator cleanup")
            # Don't cleanup immediately - allow reconnection
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


@router.post("/stop")
async def stop_project(request: StopRequest):
    """Stop a running project."""
    success = await stop_session(request.session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "message": "Process stopped"}


@router.post("/update-file")
async def update_file(request: UpdateFileRequest):
    """Update a file in a running session (for hot reload)."""
    import os

    session = active_sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build full path - sanitize to prevent directory traversal
    file_path = request.file_path.replace("\\", "/").lstrip("/")
    if ".." in file_path:
        raise HTTPException(status_code=400, detail="Invalid file path")

    full_path = os.path.join(session.project_dir, file_path)

    try:
        # Ensure parent directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Write the updated content
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(request.content)

        print(f"[Update] File updated: {file_path}")
        return {"success": True, "message": f"File {file_path} updated"}

    except Exception as e:
        print(f"[Update] Error updating file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session and its resources."""
    await cleanup_session(session_id)
    return {"success": True, "message": "Session cleaned up"}
