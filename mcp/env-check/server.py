"""
Environment check MCP server — validate env files, diff across environments, generate secrets.
Stack-agnostic: works with any project that uses .env files.
"""
import ast
import os
import re
import secrets
from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP(name="env-check")


def _parse_env_file(filepath: str) -> dict[str, str]:
    """Parse a .env file into a dict of key=value pairs. Ignores comments and blank lines."""
    result = {}
    path = Path(filepath)
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("\"'")
        result[key] = value
    return result


def _find_config_fields(config_path: str) -> list[dict]:
    """Parse a Pydantic BaseSettings class to find field names and defaults."""
    path = Path(config_path)
    if not path.exists():
        return []

    fields = []
    try:
        source = path.read_text()
        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                for base in node.bases:
                    base_name = ""
                    if isinstance(base, ast.Name):
                        base_name = base.id
                    elif isinstance(base, ast.Attribute):
                        base_name = base.attr
                    if "Settings" not in base_name:
                        continue

                    for item in node.body:
                        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                            field_name = item.target.id
                            has_default = item.value is not None
                            default_val = None
                            if has_default and isinstance(item.value, ast.Constant):
                                default_val = item.value.value
                            fields.append({
                                "name": field_name,
                                "required": not has_default,
                                "default": default_val,
                            })
    except Exception:
        pass

    return fields


KNOWN_PLACEHOLDER_VALUES = {
    "change-me", "change-me-to-random-64-chars", "changeme",
    "your-secret-key", "your-api-key", "xxx", "TODO", "FIXME",
    "replace-me", "your-key-here", "sk-xxx",
}


@mcp.tool()
def env_validate(env_file: str = "", config_file: str = "") -> dict:
    """Validate a .env file against a Pydantic Settings class. Finds missing required vars, unused vars, and placeholder secrets.

    Args:
        env_file: Path to .env file (default: auto-detect backend/.env or .env)
        config_file: Path to config.py with BaseSettings class (default: auto-detect)
    """
    # Auto-detect env file
    if not env_file:
        for candidate in ["backend/.env", ".env", "server/.env"]:
            if Path(candidate).exists():
                env_file = candidate
                break
    if not env_file or not Path(env_file).exists():
        return {"error": f"No .env file found at: {env_file or 'auto-detect paths'}"}

    # Auto-detect config file
    if not config_file:
        for candidate in ["backend/app/core/config.py", "app/core/config.py", "server/config.py", "config.py"]:
            if Path(candidate).exists():
                config_file = candidate
                break

    env_vars = _parse_env_file(env_file)
    env_keys = set(env_vars.keys())

    result = {
        "env_file": env_file,
        "total_vars": len(env_vars),
    }

    if config_file and Path(config_file).exists():
        fields = _find_config_fields(config_file)
        config_keys = {f["name"].upper() for f in fields}
        required_keys = {f["name"].upper() for f in fields if f["required"]}
        optional_keys = config_keys - required_keys

        result["config_file"] = config_file
        result["required_missing"] = sorted(required_keys - env_keys)
        result["optional_missing"] = sorted(optional_keys - env_keys)
        result["in_env_not_in_config"] = sorted(env_keys - config_keys)
    else:
        result["config_file"] = None
        result["required_missing"] = []
        result["optional_missing"] = []
        result["in_env_not_in_config"] = []

    # Check for placeholder values
    placeholders = []
    for key, value in env_vars.items():
        if value.lower() in KNOWN_PLACEHOLDER_VALUES:
            placeholders.append(key)
    result["placeholder_values"] = sorted(placeholders)

    # Check for empty required vars
    empty = [k for k in env_vars if not env_vars[k]]
    result["empty_vars"] = sorted(empty)

    # Overall status
    if result["required_missing"] or result["placeholder_values"]:
        result["status"] = "error"
    elif result["optional_missing"] or result["empty_vars"]:
        result["status"] = "warning"
    else:
        result["status"] = "ok"

    return result


@mcp.tool()
def env_diff(file_a: str, file_b: str) -> dict:
    """Compare two .env files and show differences.

    Args:
        file_a: Path to first .env file
        file_b: Path to second .env file
    """
    if not Path(file_a).exists():
        return {"error": f"File not found: {file_a}"}
    if not Path(file_b).exists():
        return {"error": f"File not found: {file_b}"}

    vars_a = _parse_env_file(file_a)
    vars_b = _parse_env_file(file_b)

    keys_a = set(vars_a.keys())
    keys_b = set(vars_b.keys())

    value_diffs = []
    for key in sorted(keys_a & keys_b):
        if vars_a[key] != vars_b[key]:
            value_diffs.append({
                "key": key,
                "a": vars_a[key][:50] + ("..." if len(vars_a[key]) > 50 else ""),
                "b": vars_b[key][:50] + ("..." if len(vars_b[key]) > 50 else ""),
            })

    return {
        "file_a": file_a,
        "file_b": file_b,
        "only_in_a": sorted(keys_a - keys_b),
        "only_in_b": sorted(keys_b - keys_a),
        "in_both": len(keys_a & keys_b),
        "value_differences": value_diffs,
    }


@mcp.tool()
def env_generate_secret(length: int = 32, encoding: str = "hex") -> dict:
    """Generate a cryptographically secure random secret.

    Args:
        length: Number of random bytes (default: 32, produces 64 hex chars)
        encoding: Output encoding — "hex", "base64", or "urlsafe" (default: hex)
    """
    length = min(max(length, 8), 128)
    raw = secrets.token_bytes(length)

    if encoding == "base64":
        import base64
        secret = base64.b64encode(raw).decode()
    elif encoding == "urlsafe":
        secret = secrets.token_urlsafe(length)
    else:
        secret = secrets.token_hex(length)

    return {"secret": secret, "bytes": length, "encoding": encoding}


if __name__ == "__main__":
    mcp.run()
