"""
Dev services MCP server — start, stop, restart, and check status of local dev services.
Works on Windows and Unix. Detects services by port and process name.
"""
import os
import platform
import signal
import socket
import subprocess
import time
from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP(name="dev-services")

IS_WINDOWS = platform.system() == "Windows"

# ─── Service Definitions ─────────────────────────────────────────────────────
# These can be overridden by SERVICE_CONFIG env var or auto-detected from project

DEFAULT_SERVICES = {
    "backend": {
        "port": 8000,
        "process_pattern": "uvicorn",
        "start_cmd": "uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8000",
        "cwd_hint": "backend",
        "health_url": "http://localhost:8000/health",
        "venv": True,
    },
    "frontend": {
        "port": 5173,
        "process_pattern": "vite",
        "start_cmd": "npm run dev",
        "cwd_hint": "frontend",
        "health_url": None,
        "venv": False,
    },
    "worker": {
        "port": None,
        "process_pattern": "upload_processor_worker",
        "start_cmd": "python -m app.workers.upload_processor_worker",
        "cwd_hint": "backend",
        "health_url": None,
        "venv": True,
    },
}


def _find_project_root() -> Path:
    """Walk up from cwd to find the project root (has backend/ and frontend/)."""
    d = Path.cwd()
    for _ in range(10):
        if (d / "backend").is_dir() and (d / "frontend").is_dir():
            return d
        if (d / "backend").is_dir():
            return d
        parent = d.parent
        if parent == d:
            break
        d = parent
    return Path.cwd()


def _find_venv(project_root: Path, service_cwd: str) -> str | None:
    """Find the venv activate script or python path."""
    backend_dir = project_root / service_cwd
    if IS_WINDOWS:
        venv_python = backend_dir / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = backend_dir / ".venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python)
    return None


def _get_pid_on_port(port: int) -> int | None:
    """Find the PID of the process listening on a port."""
    if port is None:
        return None
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 5 and f":{port}" in parts[1] and parts[3] == "LISTENING":
                    return int(parts[4])
        else:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True, text=True, timeout=10,
            )
            if result.stdout.strip():
                return int(result.stdout.strip().splitlines()[0])
    except Exception:
        pass
    return None


def _find_process_by_pattern(pattern: str) -> list[dict]:
    """Find running processes matching a name pattern."""
    matches = []
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["wmic", "process", "where", f"CommandLine like '%{pattern}%'",
                 "get", "ProcessId,CommandLine", "/format:csv"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.strip().splitlines()[1:]:
                parts = line.strip().split(",")
                if len(parts) >= 3 and pattern.lower() in ",".join(parts).lower():
                    pid = parts[-1].strip()
                    cmd = ",".join(parts[1:-1]).strip()
                    if pid.isdigit():
                        matches.append({"pid": int(pid), "command": cmd})
        else:
            result = subprocess.run(
                ["pgrep", "-af", pattern],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.strip().splitlines():
                parts = line.split(None, 1)
                if len(parts) == 2:
                    matches.append({"pid": int(parts[0]), "command": parts[1]})
    except Exception:
        pass
    return matches


def _check_health(url: str) -> dict:
    """Check if a health endpoint responds."""
    if not url:
        return {"status": "no_health_url"}
    try:
        import urllib.request
        req = urllib.request.urlopen(url, timeout=5)
        return {"status": "ok", "code": req.getcode()}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _is_port_available(port: int) -> bool:
    """Check if a port is free."""
    if port is None:
        return True
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            s.bind(("127.0.0.1", port))
            return True
    except OSError:
        return False


def _kill_pid(pid: int) -> bool:
    """Kill a process by PID."""
    try:
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                           capture_output=True, timeout=10)
        else:
            os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        return True
    except Exception:
        return False


# ─── Tools ───────────────────────────────────────────────────────────────────


@mcp.tool()
def dev_status() -> dict:
    """Check the status of all dev services (backend, frontend, worker). Returns running state, PIDs, ports, and health check results."""
    result = {}
    for name, config in DEFAULT_SERVICES.items():
        port = config["port"]
        pid = _get_pid_on_port(port) if port else None
        processes = _find_process_by_pattern(config["process_pattern"])
        running = pid is not None or len(processes) > 0

        entry = {
            "running": running,
            "port": port,
            "pid": pid,
            "processes": len(processes),
        }

        if running and config.get("health_url"):
            entry["health"] = _check_health(config["health_url"])

        result[name] = entry

    # Also check database connectivity
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)
            s.connect(("127.0.0.1", 5432))
            result["postgres_5432"] = {"running": True}
    except OSError:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(2)
                s.connect(("127.0.0.1", 5433))
                result["postgres_5433"] = {"running": True}
        except OSError:
            result["postgres"] = {"running": False}

    return result


@mcp.tool()
def dev_start(service: str) -> dict:
    """Start a dev service in the background. Service must be one of: backend, frontend, worker."""
    if service not in DEFAULT_SERVICES:
        return {"error": f"Unknown service: {service}. Must be one of: {', '.join(DEFAULT_SERVICES.keys())}"}

    config = DEFAULT_SERVICES[service]
    project_root = _find_project_root()
    cwd = project_root / config["cwd_hint"]

    if not cwd.is_dir():
        return {"error": f"Directory not found: {cwd}"}

    # Check if already running
    if config["port"] and not _is_port_available(config["port"]):
        pid = _get_pid_on_port(config["port"])
        return {"error": f"{service} already running on port {config['port']} (PID {pid})"}

    cmd = config["start_cmd"]
    env = os.environ.copy()

    if config.get("venv"):
        venv_python = _find_venv(project_root, config["cwd_hint"])
        if venv_python:
            venv_dir = Path(venv_python).parent.parent
            if IS_WINDOWS:
                env["PATH"] = str(venv_dir / "Scripts") + os.pathsep + env.get("PATH", "")
            else:
                env["PATH"] = str(venv_dir / "bin") + os.pathsep + env.get("PATH", "")
            env["VIRTUAL_ENV"] = str(venv_dir)

    try:
        if IS_WINDOWS:
            process = subprocess.Popen(
                cmd, shell=True, cwd=str(cwd), env=env,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            )
        else:
            process = subprocess.Popen(
                cmd, shell=True, cwd=str(cwd), env=env,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=True,
            )

        time.sleep(2)

        if process.poll() is not None:
            return {"error": f"{service} exited immediately with code {process.returncode}"}

        return {"status": "started", "pid": process.pid, "port": config["port"]}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def dev_stop(service: str) -> dict:
    """Stop a running dev service by killing its process."""
    if service not in DEFAULT_SERVICES:
        return {"error": f"Unknown service: {service}. Must be one of: {', '.join(DEFAULT_SERVICES.keys())}"}

    config = DEFAULT_SERVICES[service]
    killed = []

    # Kill by port
    if config["port"]:
        pid = _get_pid_on_port(config["port"])
        if pid:
            _kill_pid(pid)
            killed.append(pid)

    # Kill by pattern
    processes = _find_process_by_pattern(config["process_pattern"])
    for proc in processes:
        if proc["pid"] not in killed:
            _kill_pid(proc["pid"])
            killed.append(proc["pid"])

    if not killed:
        return {"status": "not_running", "message": f"{service} was not running"}

    return {"status": "stopped", "killed_pids": killed}


@mcp.tool()
def dev_restart(service: str) -> dict:
    """Restart a dev service (stop then start)."""
    stop_result = dev_stop(service)
    time.sleep(1)
    start_result = dev_start(service)
    return {"stop": stop_result, "start": start_result}


@mcp.tool()
def port_check(port: int) -> dict:
    """Check if a port is in use and what process is using it."""
    available = _is_port_available(port)
    result = {"port": port, "available": available}
    if not available:
        pid = _get_pid_on_port(port)
        result["pid"] = pid
        if pid:
            try:
                if IS_WINDOWS:
                    proc = subprocess.run(
                        ["wmic", "process", "where", f"ProcessId={pid}",
                         "get", "CommandLine", "/format:csv"],
                        capture_output=True, text=True, timeout=5,
                    )
                    lines = [l for l in proc.stdout.strip().splitlines() if l.strip()]
                    if len(lines) > 1:
                        result["command"] = lines[-1].split(",", 1)[-1].strip()
                else:
                    proc = subprocess.run(
                        ["ps", "-p", str(pid), "-o", "command="],
                        capture_output=True, text=True, timeout=5,
                    )
                    result["command"] = proc.stdout.strip()
            except Exception:
                pass
    return result


if __name__ == "__main__":
    mcp.run()
