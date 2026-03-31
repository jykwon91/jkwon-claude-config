"""
API test MCP server — make HTTP requests to the dev server with automatic auth token management.
Handles login, token caching, JSON/form bodies, and structured response output.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP(name="api-test")

# In-memory token cache (persists for the MCP server's lifetime)
_token_cache: dict[str, dict] = {}


def _default_base_url() -> str:
    """Detect base URL from project config."""
    return os.environ.get("API_BASE_URL", "http://localhost:8000")


def _get_cached_token(base_url: str) -> str | None:
    """Get cached auth token if still valid."""
    entry = _token_cache.get(base_url)
    if entry and entry["expires_at"] > time.time():
        return entry["token"]
    return None


def _login(base_url: str, email: str, password: str) -> dict:
    """Authenticate and cache the JWT token."""
    url = f"{base_url}/auth/jwt/login"
    data = urllib.parse.urlencode({"username": email, "password": password}).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            token = body.get("access_token")
            if token:
                _token_cache[base_url] = {
                    "token": token,
                    "expires_at": time.time() + 82800,  # 23 hours
                    "email": email,
                }
                return {"status": "ok", "email": email}
            return {"error": "No access_token in response", "body": body}
    except urllib.error.HTTPError as e:
        return {"error": f"Login failed: {e.code}", "body": e.read().decode()}
    except Exception as e:
        return {"error": str(e)}


def _find_test_credentials() -> dict | None:
    """Look for E2E test credentials in env files."""
    search_paths = [
        Path.cwd() / "frontend" / ".env",
        Path.cwd() / ".env",
        Path.cwd() / "frontend" / ".env.local",
    ]
    for p in search_paths:
        if p.exists():
            env_vars = {}
            for line in p.read_text().splitlines():
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                env_vars[key.strip()] = value.strip().strip("\"'")
            email = env_vars.get("E2E_EMAIL") or env_vars.get("TEST_EMAIL")
            password = env_vars.get("E2E_PASSWORD") or env_vars.get("TEST_PASSWORD")
            if email and password:
                return {"email": email, "password": password}
    return None


@mcp.tool()
def api_request(
    method: str,
    path: str,
    body: str = "",
    query_params: str = "",
    auth: str = "auto",
    base_url: str = "",
    headers: str = "",
    expect_status: int = 0,
) -> dict:
    """Make an HTTP request to the API.

    Args:
        method: HTTP method (GET, POST, PUT, PATCH, DELETE)
        path: API path (e.g., "/transactions"). Prepended with base_url.
        body: JSON string for request body (e.g., '{"vendor": "Test"}')
        query_params: JSON string of query parameters (e.g., '{"status": "approved"}')
        auth: "auto" (find credentials and login), "none" (no auth), or "cached" (use cached token)
        base_url: Override base URL (default: http://localhost:8000)
        headers: JSON string of additional headers
        expect_status: If set, assert this status code
    """
    base = base_url or _default_base_url()
    url = f"{base}{path}"

    # Add query params
    if query_params:
        try:
            params = json.loads(query_params)
            url += "?" + urllib.parse.urlencode(params)
        except json.JSONDecodeError:
            return {"error": f"Invalid query_params JSON: {query_params}"}

    # Parse body
    body_bytes = None
    if body:
        try:
            json.loads(body)  # validate
            body_bytes = body.encode()
        except json.JSONDecodeError:
            return {"error": f"Invalid body JSON: {body}"}

    # Build request
    req = urllib.request.Request(url, data=body_bytes, method=method.upper())
    if body_bytes:
        req.add_header("Content-Type", "application/json")

    # Add custom headers
    if headers:
        try:
            for key, value in json.loads(headers).items():
                req.add_header(key, value)
        except json.JSONDecodeError:
            return {"error": f"Invalid headers JSON: {headers}"}

    # Handle auth
    if auth != "none":
        token = _get_cached_token(base)
        if not token and auth in ("auto", "login"):
            creds = _find_test_credentials()
            if creds:
                login_result = _login(base, creds["email"], creds["password"])
                if "error" in login_result:
                    return {"error": f"Auto-login failed: {login_result['error']}"}
                token = _get_cached_token(base)
            elif auth == "auto":
                pass  # No credentials found, proceed without auth
            else:
                return {"error": "No cached token and no credentials found for login"}

        if token:
            req.add_header("Authorization", f"Bearer {token}")

        # Also add org header if available
        org_path = Path.cwd() / "frontend" / "e2e" / ".auth-org"
        if org_path.exists():
            org_id = org_path.read_text().strip()
            if org_id:
                req.add_header("X-Organization-Id", org_id)

    # Execute request
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            elapsed_ms = round((time.time() - start_time) * 1000)
            resp_body = resp.read().decode()
            try:
                resp_json = json.loads(resp_body)
            except json.JSONDecodeError:
                resp_json = None

            result = {
                "status": resp.getcode(),
                "response_time_ms": elapsed_ms,
                "body": resp_json if resp_json is not None else resp_body[:2000],
            }

            if expect_status and resp.getcode() != expect_status:
                result["status_match"] = False
                result["expected"] = expect_status
            elif expect_status:
                result["status_match"] = True

            return result

    except urllib.error.HTTPError as e:
        elapsed_ms = round((time.time() - start_time) * 1000)
        try:
            err_body = json.loads(e.read().decode())
        except Exception:
            err_body = e.read().decode()[:2000]

        result = {
            "status": e.code,
            "response_time_ms": elapsed_ms,
            "body": err_body,
        }
        if expect_status and e.code != expect_status:
            result["status_match"] = False
            result["expected"] = expect_status
        elif expect_status:
            result["status_match"] = True
        return result

    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def api_login(email: str, password: str, base_url: str = "") -> dict:
    """Authenticate with the API and cache the token for subsequent requests."""
    base = base_url or _default_base_url()
    return _login(base, email, password)


@mcp.tool()
def api_token_status() -> dict:
    """Check the status of cached auth tokens."""
    result = {}
    for base_url, entry in _token_cache.items():
        remaining = entry["expires_at"] - time.time()
        result[base_url] = {
            "email": entry["email"],
            "valid": remaining > 0,
            "expires_in_seconds": max(0, int(remaining)),
        }
    if not result:
        return {"status": "no_cached_tokens"}
    return result


if __name__ == "__main__":
    mcp.run()
