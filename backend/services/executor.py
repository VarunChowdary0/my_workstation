import asyncio
import json
import os
import shutil
import socket
import tempfile
import uuid
from asyncio import Queue
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class ProjectType(Enum):
    NEXTJS = "nextjs"
    REACT_CRA = "react-cra"
    VITE = "vite"
    NODEJS = "nodejs"
    PYTHON = "python"
    SIMPLE_WEB = "simple-web"
    UNKNOWN = "unknown"


def get_free_port() -> int:
    """Find a free port on the system."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


@dataclass
class ExecutionSession:
    session_id: str
    project_dir: str
    process: Any = None  # subprocess.Popen process (sync)
    output_queue: Queue = field(default_factory=Queue)
    is_running: bool = False
    project_type: ProjectType = ProjectType.UNKNOWN
    port: int = 0  # Assigned port for the dev server
    should_stop: bool = False  # Flag to signal stop request


# Store active sessions
active_sessions: dict[str, ExecutionSession] = {}


def detect_project_type(files: list[dict]) -> ProjectType:
    """Detect project type from files."""
    file_names = set()
    package_json_content = None
    package_lock_content = None

    def collect_files(nodes: list[dict], prefix: str = ""):
        nonlocal package_json_content, package_lock_content
        for node in nodes:
            name = node.get("name", "")
            full_path = f"{prefix}/{name}" if prefix else name

            if node.get("children") is not None:
                collect_files(node["children"], full_path)
            else:
                file_names.add(name)
                if name == "package.json" and node.get("content"):
                    package_json_content = node["content"]
                elif name == "package-lock.json" and node.get("content"):
                    package_lock_content = node["content"]

    collect_files(files)

    # Check for package.json and detect JS framework
    if package_json_content:
        try:
            pkg = json.loads(package_json_content)
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

            if "next" in deps:
                return ProjectType.NEXTJS
            if "react-scripts" in deps:
                return ProjectType.REACT_CRA
            if "vite" in deps:
                return ProjectType.VITE
            return ProjectType.NODEJS
        except json.JSONDecodeError:
            pass

    # Fallback: Check package-lock.json for dependencies
    if package_lock_content:
        try:
            lock = json.loads(package_lock_content)
            packages = lock.get("packages", {})
            # Check root package or node_modules entries
            root_deps = packages.get("", {}).get("dependencies", {})

            if "next" in root_deps:
                return ProjectType.NEXTJS
            if "react-scripts" in root_deps:
                return ProjectType.REACT_CRA
            if "vite" in root_deps:
                return ProjectType.VITE

            # Also check if packages has these as keys
            if any("node_modules/next" in k for k in packages.keys()):
                return ProjectType.NEXTJS
            if any("node_modules/react-scripts" in k for k in packages.keys()):
                return ProjectType.REACT_CRA
            if any("node_modules/vite" in k for k in packages.keys()):
                return ProjectType.VITE

            return ProjectType.NODEJS
        except json.JSONDecodeError:
            pass

    # Check for Python
    if "requirements.txt" in file_names:
        return ProjectType.PYTHON
    if any(f.endswith(".py") for f in file_names):
        return ProjectType.PYTHON

    # Check for simple web
    if "index.html" in file_names:
        return ProjectType.SIMPLE_WEB

    return ProjectType.UNKNOWN


def get_run_commands(project_type: ProjectType, port: int, use_nodemon: bool = False) -> tuple[Optional[str], str]:
    """Get install and run commands for project type with dynamic port."""
    # Use environment variable PORT for most frameworks
    # React CRA uses PORT env var, Next.js uses -p flag, Vite uses --port flag

    # For Node.js, use nodemon for hot reload if requested
    nodejs_run = f"set PORT={port} && npx nodemon server.js" if use_nodemon else f"set PORT={port} && npm start"

    commands = {
        ProjectType.NEXTJS: ("npm install", f"npm run dev -- -p {port}"),
        ProjectType.REACT_CRA: ("npm install", f"set PORT={port} && npm start"),
        ProjectType.VITE: ("npm install", f"npm run dev -- --port {port}"),
        ProjectType.NODEJS: ("npm install", nodejs_run),
        ProjectType.PYTHON: (None, "python main.py"),
    }
    return commands.get(project_type, (None, ""))


def write_files_to_disk(files: list[dict], base_dir: str) -> None:
    """Write file tree to disk."""
    def write_node(node: dict, current_path: str):
        name = node.get("name", "")
        full_path = os.path.join(current_path, name)

        if node.get("children") is not None:
            # It's a directory
            os.makedirs(full_path, exist_ok=True)
            for child in node["children"]:
                write_node(child, full_path)
        else:
            # It's a file
            content = node.get("content", "")
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

    for node in files:
        write_node(node, base_dir)


def find_project_root(base_dir: str) -> str:
    """Find the actual project root (where package.json or main files are)."""
    # Check if base_dir itself has package.json or is the project root
    if os.path.exists(os.path.join(base_dir, "package.json")):
        return base_dir
    if os.path.exists(os.path.join(base_dir, "package-lock.json")):
        return base_dir
    if os.path.exists(os.path.join(base_dir, "requirements.txt")):
        return base_dir

    # Check if there's a single subdirectory that contains the project
    entries = os.listdir(base_dir)
    if len(entries) == 1:
        subdir = os.path.join(base_dir, entries[0])
        if os.path.isdir(subdir):
            # Check if this subdir is the project root
            if os.path.exists(os.path.join(subdir, "package.json")):
                return subdir
            if os.path.exists(os.path.join(subdir, "package-lock.json")):
                return subdir
            if os.path.exists(os.path.join(subdir, "requirements.txt")):
                return subdir
            # Check for src folder (common React/Node structure)
            if os.path.exists(os.path.join(subdir, "src")):
                return subdir

    return base_dir


async def create_session(files: list[dict]) -> ExecutionSession:
    """Create a new execution session."""
    session_id = str(uuid.uuid4())
    temp_dir = tempfile.mkdtemp(prefix=f"workstation_{session_id[:8]}_")

    # Write files to temp directory
    write_files_to_disk(files, temp_dir)

    # Find actual project root (handles nested folder structures)
    project_dir = find_project_root(temp_dir)

    # Detect project type
    project_type = detect_project_type(files)

    # Get a free port for the dev server
    port = get_free_port()

    session = ExecutionSession(
        session_id=session_id,
        project_dir=project_dir,
        project_type=project_type,
        port=port,
    )

    active_sessions[session_id] = session

    # Add initial message to queue so stream has something to read
    await session.output_queue.put(f"Session created. Project dir: {project_dir}\n")
    await session.output_queue.put(f"Assigned port: {port}\n")

    return session


def _run_subprocess_sync(command: str, cwd: str, output_callback, session: "ExecutionSession") -> int:
    """Run subprocess synchronously (called from thread pool)."""
    import subprocess

    try:
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=cwd,
            env={**os.environ, "FORCE_COLOR": "1", "CI": "true"},
            bufsize=1,
            universal_newlines=False,
        )

        # Store process reference in session for stop functionality
        session.process = process

        # Read output line by line
        if process.stdout:
            for line in iter(process.stdout.readline, b''):
                if not line:
                    break
                # Check if stop was requested
                if session.should_stop:
                    break
                decoded = line.decode("utf-8", errors="replace")
                output_callback(decoded)
            process.stdout.close()

        process.wait()
        return process.returncode or 0

    except Exception as e:
        output_callback(f"\n✗ Subprocess error: {str(e)}\n")
        return -1
    finally:
        session.process = None


async def run_command(session: ExecutionSession, command: str, signal_end: bool = True) -> int:
    """Run a command and stream output to the session queue.

    Returns the exit code of the process.
    """
    exit_code = -1
    try:
        session.is_running = True
        await session.output_queue.put(f"$ {command}\n")

        loop = asyncio.get_event_loop()

        # Callback to put output into the async queue
        def output_callback(text: str):
            # Schedule the coroutine on the event loop from the thread
            asyncio.run_coroutine_threadsafe(
                session.output_queue.put(text),
                loop
            )

        # Run subprocess in thread pool to avoid Windows asyncio subprocess issues
        exit_code = await loop.run_in_executor(
            None,
            _run_subprocess_sync,
            command,
            session.project_dir,
            output_callback,
            session
        )

        if exit_code == 0:
            await session.output_queue.put(f"\n✓ Process exited with code {exit_code}\n")
        else:
            await session.output_queue.put(f"\n✗ Process exited with code {exit_code}\n")

    except asyncio.CancelledError:
        await session.output_queue.put("\n⚠ Process cancelled\n")
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        await session.output_queue.put(f"\n✗ Error: {type(e).__name__}: {str(e)}\n")
        await session.output_queue.put(f"Details: {error_details}\n")
    finally:
        session.is_running = False
        if signal_end:
            await session.output_queue.put(None)  # Signal end of output

    return exit_code


def patch_nodejs_port(project_dir: str, port: int) -> list[str]:
    """Patch Node.js files to use the dynamic port instead of hardcoded ports.

    Returns list of patched files.
    """
    import re
    patched_files = []

    # Common entry point files for Node.js
    entry_files = ["server.js", "app.js", "index.js", "main.js", "src/server.js", "src/app.js", "src/index.js"]

    for entry_file in entry_files:
        file_path = os.path.join(project_dir, entry_file)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                original_content = content

                # Pattern 1: .listen(3000) or .listen(8080) etc - hardcoded port numbers in listen()
                # Replace with process.env.PORT || original_port
                content = re.sub(
                    r'\.listen\s*\(\s*(\d{3,5})\s*([,\)])',
                    lambda m: f'.listen(process.env.PORT || {m.group(1)}{m.group(2)}',
                    content
                )

                # Pattern 2: const PORT = 3000 or let port = 8080 etc (variable assignment)
                # Match: const/let/var + port/PORT + = + number + ; (with optional spaces)
                content = re.sub(
                    r'(const|let|var)\s+(port|PORT)\s*=\s*(\d{3,5})\s*;',
                    lambda m: f'{m.group(1)} {m.group(2)} = process.env.PORT || {m.group(3)};',
                    content
                )

                if content != original_content:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    patched_files.append(entry_file)

            except Exception:
                pass

    return patched_files


async def execute_project(session: ExecutionSession) -> None:
    """Execute the project based on its type."""
    project_type = session.project_type

    if project_type == ProjectType.UNKNOWN:
        await session.output_queue.put("✗ Unknown project type. Cannot run.\n")
        await session.output_queue.put(None)
        return

    if project_type == ProjectType.SIMPLE_WEB:
        await session.output_queue.put("✓ Simple web project detected. Use browser preview.\n")
        await session.output_queue.put(None)
        return

    # For Node.js, use nodemon for hot reload
    use_nodemon = project_type == ProjectType.NODEJS

    install_cmd, run_cmd = get_run_commands(project_type, session.port, use_nodemon=use_nodemon)

    await session.output_queue.put(f"Detected project type: {project_type.value}\n")
    await session.output_queue.put(f"Dev server will run on port: {session.port}\n\n")

    # For Node.js projects, patch hardcoded ports and find entry file
    main_js_file = "server.js"  # Default
    if project_type == ProjectType.NODEJS:
        patched = patch_nodejs_port(session.project_dir, session.port)
        if patched:
            await session.output_queue.put(f"⚙ Patched port in: {', '.join(patched)}\n\n")
            # Use the first patched file as entry point
            main_js_file = patched[0]
        else:
            # Find main entry file
            for entry in ["server.js", "app.js", "index.js", "main.js"]:
                if os.path.exists(os.path.join(session.project_dir, entry)):
                    main_js_file = entry
                    break

        # Update run command with correct entry file
        run_cmd = f"set PORT={session.port} && npx nodemon {main_js_file}"
        await session.output_queue.put(f"⚙ Using nodemon for hot reload (entry: {main_js_file})\n\n")

    # Run install command if needed
    if install_cmd:
        # Check if node_modules already exists
        node_modules = os.path.join(session.project_dir, "node_modules")
        package_json = os.path.join(session.project_dir, "package.json")

        if not os.path.exists(node_modules):
            # Check if package.json exists - npm install requires it
            if not os.path.exists(package_json):
                await session.output_queue.put("⚠ No package.json found. Skipping npm install.\n")
            else:
                exit_code = await run_command(session, install_cmd, signal_end=False)
                # Check if install failed
                if exit_code != 0:
                    await session.output_queue.put(None)
                    return

    # Check for requirements.txt for Python
    if project_type == ProjectType.PYTHON:
        req_file = os.path.join(session.project_dir, "requirements.txt")
        if os.path.exists(req_file):
            exit_code = await run_command(session, "pip install -r requirements.txt", signal_end=False)
            if exit_code != 0:
                # Try installing without version pins (fallback for old dependencies)
                await session.output_queue.put("\n⚠ Pinned versions failed. Trying without version constraints...\n\n")

                # Read requirements and strip version pins
                with open(req_file, "r") as f:
                    packages = []
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            # Strip version specifiers (==, >=, <=, ~=, etc.)
                            pkg_name = line.split("==")[0].split(">=")[0].split("<=")[0].split("~=")[0].split("<")[0].split(">")[0].strip()
                            if pkg_name:
                                packages.append(pkg_name)

                if packages:
                    # Install packages without version pins
                    packages_str = " ".join(packages)
                    exit_code = await run_command(session, f"pip install {packages_str}", signal_end=False)
                    if exit_code != 0:
                        await session.output_queue.put(None)
                        return
                else:
                    await session.output_queue.put(None)
                    return

        # Check what type of Python web framework it is
        is_fastapi = False
        is_flask = False
        if os.path.exists(req_file):
            with open(req_file, "r") as f:
                req_content = f.read().lower()
                is_fastapi = "fastapi" in req_content or "uvicorn" in req_content
                is_flask = "flask" in req_content

        # Find main Python file
        py_files = list(Path(session.project_dir).glob("*.py"))
        if py_files:
            main_file = "main.py" if Path(session.project_dir, "main.py").exists() else py_files[0].name

            if is_fastapi:
                # Use uvicorn for FastAPI projects
                module_name = main_file.replace(".py", "")
                run_cmd = f"uvicorn {module_name}:app --reload --host 0.0.0.0 --port {session.port}"
            elif is_flask:
                # Use flask run for Flask projects
                module_name = main_file.replace(".py", "")
                run_cmd = f"set FLASK_APP={main_file} && set FLASK_DEBUG=1 && flask run --host=0.0.0.0 --port={session.port}"
            else:
                # Regular Python script with PORT env var
                run_cmd = f"set PORT={session.port} && python {main_file}"

    # Run the project (this one signals end)
    await run_command(session, run_cmd, signal_end=True)


async def stop_session(session_id: str) -> bool:
    """Stop a running session."""
    import subprocess

    session = active_sessions.get(session_id)
    if not session:
        return False

    # Set stop flag
    session.should_stop = True

    if session.process and session.is_running:
        try:
            import sys
            pid = session.process.pid
            print(f"[Stop] Attempting to kill process {pid}")

            if sys.platform == "win32":
                # On Windows, use taskkill to kill the entire process tree
                # This handles uvicorn's child processes
                result = subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    capture_output=True,
                    text=True
                )
                print(f"[Stop] taskkill result: {result.returncode}, stdout: {result.stdout}, stderr: {result.stderr}")

                # Also try to kill any processes listening on our port
                # This catches uvicorn reload workers that might be orphaned
                try:
                    # Find processes using the port
                    netstat_result = subprocess.run(
                        f'netstat -ano | findstr ":{session.port}"',
                        shell=True,
                        capture_output=True,
                        text=True
                    )
                    if netstat_result.stdout:
                        for line in netstat_result.stdout.strip().split('\n'):
                            parts = line.split()
                            if len(parts) >= 5:
                                port_pid = parts[-1]
                                if port_pid.isdigit() and port_pid != str(pid):
                                    print(f"[Stop] Killing orphaned process on port: {port_pid}")
                                    subprocess.run(
                                        ["taskkill", "/F", "/PID", port_pid],
                                        capture_output=True
                                    )
                except Exception as e:
                    print(f"[Stop] Error cleaning up port processes: {e}")
            else:
                # On Unix, send SIGTERM then SIGKILL
                session.process.terminate()
                await asyncio.sleep(0.5)
                if session.process.poll() is None:
                    session.process.kill()
        except Exception as e:
            print(f"[Stop] Error terminating process: {e}")

    # Mark session as not running
    session.is_running = False

    return True


async def cleanup_session(session_id: str) -> None:
    """Clean up session resources."""
    session = active_sessions.pop(session_id, None)
    if session:
        # Clean up temp directory
        try:
            shutil.rmtree(session.project_dir, ignore_errors=True)
        except Exception:
            pass
