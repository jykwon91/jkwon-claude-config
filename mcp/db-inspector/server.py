"""
Database MCP server for Claude Code.
Stack-agnostic — connects via DATABASE_URL from .env using raw database drivers.
Supports read, write, schema inspection, query analysis, and database export.
"""
import os
import re
import subprocess
from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP(name="db-inspector")


def _find_database_url() -> str | None:
    """Find DATABASE_URL from .env in the current project or parent directories."""
    search_dirs = [
        Path.cwd(),
        Path.cwd() / "backend",
        Path.cwd() / "server",
    ]
    for d in search_dirs:
        env_file = d / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                if key.strip() == "DATABASE_URL":
                    return value.strip().strip("\"'")
    return os.environ.get("DATABASE_URL")


def _get_sync_url(url: str) -> str:
    """Convert async database URLs to sync equivalents."""
    url = re.sub(r"postgresql\+asyncpg://", "postgresql://", url)
    url = re.sub(r"sqlite\+aiosqlite://", "sqlite://", url)
    return url


def _parse_pg_url(url: str) -> dict:
    """Extract host, port, user, password, dbname from a PostgreSQL URL."""
    sync_url = _get_sync_url(url)
    match = re.match(
        r"postgresql://(?P<user>[^:]+):(?P<password>[^@]+)@(?P<host>[^:/]+)(?::(?P<port>\d+))?/(?P<dbname>[^?]+)",
        sync_url,
    )
    if not match:
        raise ValueError(f"Cannot parse PostgreSQL URL: {sync_url}")
    params = match.groupdict()
    params["port"] = int(params["port"] or 5432)
    return params


def _connect(url: str):
    """Return a DB-API connection based on the URL scheme."""
    sync_url = _get_sync_url(url)

    if sync_url.startswith("postgresql://"):
        import psycopg2
        params = _parse_pg_url(url)
        return psycopg2.connect(
            host=params["host"],
            port=params["port"],
            user=params["user"],
            password=params["password"],
            dbname=params["dbname"],
        )
    elif sync_url.startswith("sqlite://"):
        import sqlite3
        db_path = sync_url.replace("sqlite:///", "").replace("sqlite://", "")
        if not db_path or db_path == ":memory:":
            db_path = ":memory:"
        return sqlite3.connect(db_path)
    else:
        raise ValueError(f"Unsupported database URL scheme: {sync_url}")


def _is_postgres(url: str) -> bool:
    return "postgresql" in url or "postgres" in url


# ─── Read Tools ──────────────────────────────────────────────────────────────


@mcp.tool()
def db_tables() -> list[dict]:
    """List all tables in the database with row counts. Returns table name and approximate row count."""
    url = _find_database_url()
    if not url:
        return [{"error": "No DATABASE_URL found in .env or environment"}]

    conn = _connect(url)
    cur = conn.cursor()

    try:
        if _is_postgres(url):
            cur.execute("""
                SELECT schemaname || '.' || tablename AS table_name,
                       n_live_tup AS approx_rows
                FROM pg_stat_user_tables
                ORDER BY n_live_tup DESC
            """)
        else:
            cur.execute("""
                SELECT name AS table_name, 0 AS approx_rows
                FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            """)

        rows = cur.fetchall()
        return [{"table": r[0], "approx_rows": r[1]} for r in rows]
    finally:
        cur.close()
        conn.close()


@mcp.tool()
def db_schema(table: str) -> list[dict]:
    """Get column names, types, constraints, and indexes for a table."""
    url = _find_database_url()
    if not url:
        return [{"error": "No DATABASE_URL found in .env or environment"}]

    conn = _connect(url)
    cur = conn.cursor()

    try:
        if _is_postgres(url):
            schema = "public"
            table_name = table
            if "." in table:
                schema, table_name = table.rsplit(".", 1)

            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position
            """, (schema, table_name))
            columns = [
                {"column": r[0], "type": r[1], "nullable": r[2], "default": r[3]}
                for r in cur.fetchall()
            ]

            cur.execute("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = %s AND tablename = %s
            """, (schema, table_name))
            indexes = [{"name": r[0], "definition": r[1]} for r in cur.fetchall()]

            return [{"columns": columns, "indexes": indexes}]
        else:
            cur.execute(f"PRAGMA table_info({table})")
            columns = [
                {"column": r[1], "type": r[2], "nullable": "NO" if r[3] else "YES", "default": r[4]}
                for r in cur.fetchall()
            ]
            return [{"columns": columns, "indexes": []}]
    finally:
        cur.close()
        conn.close()


@mcp.tool()
def db_query(sql: str) -> list[dict]:
    """Execute a read-only SQL query. Only SELECT statements are allowed. Returns up to 100 rows."""
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
        return [{"error": "Only SELECT and WITH (CTE) queries are allowed. This tool is read-only."}]

    url = _find_database_url()
    if not url:
        return [{"error": "No DATABASE_URL found in .env or environment"}]

    conn = _connect(url)
    cur = conn.cursor()

    try:
        if _is_postgres(url):
            cur.execute("SET TRANSACTION READ ONLY")

        cur.execute(sql)
        col_names = [desc[0] for desc in cur.description] if cur.description else []
        rows = cur.fetchmany(100)
        return [dict(zip(col_names, row)) for row in rows]
    finally:
        conn.rollback()
        cur.close()
        conn.close()


@mcp.tool()
def db_sample(table: str, limit: int = 10) -> list[dict]:
    """Get sample rows from a table. Returns up to `limit` rows (max 50)."""
    limit = min(limit, 50)
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_.]*$", table):
        return [{"error": f"Invalid table name: {table}"}]

    return db_query(f"SELECT * FROM {table} LIMIT {limit}")


# ─── Write Tools ─────────────────────────────────────────────────────────────


@mcp.tool()
def db_execute(sql: str) -> dict:
    """Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP). Returns affected row count. Changes are committed immediately."""
    stripped = sql.strip().upper()
    allowed_prefixes = ("INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE")
    if not any(stripped.startswith(p) for p in allowed_prefixes):
        return {"error": f"Only write statements are allowed ({', '.join(allowed_prefixes)}). Use db_query for SELECT."}

    url = _find_database_url()
    if not url:
        return {"error": "No DATABASE_URL found in .env or environment"}

    conn = _connect(url)
    cur = conn.cursor()

    try:
        cur.execute(sql)
        conn.commit()
        return {"status": "ok", "rows_affected": cur.rowcount}
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}
    finally:
        cur.close()
        conn.close()


# ─── Schema Analysis Tools ───────────────────────────────────────────────────


@mcp.tool()
def db_foreign_keys(table: str) -> list[dict]:
    """Get all foreign key relationships for a table — both outgoing (this table references) and incoming (other tables reference this). PostgreSQL only."""
    url = _find_database_url()
    if not url:
        return [{"error": "No DATABASE_URL found in .env or environment"}]
    if not _is_postgres(url):
        return [{"error": "db_foreign_keys is only supported for PostgreSQL"}]

    schema = "public"
    table_name = table
    if "." in table:
        schema, table_name = table.rsplit(".", 1)

    conn = _connect(url)
    cur = conn.cursor()

    try:
        # Outgoing: this table references others
        cur.execute("""
            SELECT
                kcu.column_name AS column,
                ccu.table_schema || '.' || ccu.table_name AS references_table,
                ccu.column_name AS references_column,
                rc.delete_rule AS on_delete,
                rc.update_rule AS on_update
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.referential_constraints rc
                ON kcu.constraint_name = rc.constraint_name
                AND kcu.constraint_schema = rc.constraint_schema
            JOIN information_schema.constraint_column_usage ccu
                ON rc.unique_constraint_name = ccu.constraint_name
                AND rc.unique_constraint_schema = ccu.constraint_schema
            WHERE kcu.table_schema = %s AND kcu.table_name = %s
            ORDER BY kcu.column_name
        """, (schema, table_name))
        outgoing = [
            {"column": r[0], "references_table": r[1], "references_column": r[2], "on_delete": r[3], "on_update": r[4]}
            for r in cur.fetchall()
        ]

        # Incoming: other tables reference this one
        cur.execute("""
            SELECT
                kcu.table_schema || '.' || kcu.table_name AS from_table,
                kcu.column_name AS from_column,
                ccu.column_name AS to_column,
                rc.delete_rule AS on_delete
            FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.referential_constraints rc
                ON ccu.constraint_name = rc.unique_constraint_name
                AND ccu.constraint_schema = rc.unique_constraint_schema
            JOIN information_schema.key_column_usage kcu
                ON rc.constraint_name = kcu.constraint_name
                AND rc.constraint_schema = kcu.constraint_schema
            WHERE ccu.table_schema = %s AND ccu.table_name = %s
            ORDER BY kcu.table_name
        """, (schema, table_name))
        incoming = [
            {"from_table": r[0], "from_column": r[1], "to_column": r[2], "on_delete": r[3]}
            for r in cur.fetchall()
        ]

        return [{"outgoing": outgoing, "incoming": incoming}]
    finally:
        cur.close()
        conn.close()


@mcp.tool()
def db_explain(sql: str) -> list[dict]:
    """Run EXPLAIN ANALYZE on a SELECT query and return the execution plan. PostgreSQL only. The query IS executed (but inside a rolled-back transaction so no side effects)."""
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
        return [{"error": "Only SELECT/WITH queries can be explained."}]

    url = _find_database_url()
    if not url:
        return [{"error": "No DATABASE_URL found in .env or environment"}]
    if not _is_postgres(url):
        return [{"error": "db_explain is only supported for PostgreSQL"}]

    conn = _connect(url)
    cur = conn.cursor()

    try:
        cur.execute(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) {sql}")
        plan_lines = [r[0] for r in cur.fetchall()]
        return [{"plan": "\n".join(plan_lines)}]
    finally:
        conn.rollback()
        cur.close()
        conn.close()


# ─── Export Tools ────────────────────────────────────────────────────────────


@mcp.tool()
def db_dump(output_path: str, exclude_patterns: str = "") -> dict:
    """Export the database to a compressed dump file using pg_dump. PostgreSQL only.

    Args:
        output_path: Path for the output .dump file (e.g. "mybookkeeper.dump")
        exclude_patterns: Comma-separated table name patterns to exclude (e.g. "dramatiq_*,django_*")
    """
    url = _find_database_url()
    if not url:
        return {"error": "No DATABASE_URL found in .env or environment"}
    if not _is_postgres(url):
        return {"error": "db_dump is only supported for PostgreSQL"}

    params = _parse_pg_url(url)
    cmd = [
        "pg_dump",
        "-h", params["host"],
        "-p", str(params["port"]),
        "-U", params["user"],
        "-Fc",
        "--no-owner",
        "--no-privileges",
    ]

    if exclude_patterns:
        for pattern in exclude_patterns.split(","):
            pattern = pattern.strip()
            if pattern:
                cmd.extend(["--exclude-table", pattern])

    cmd.append(params["dbname"])

    env = os.environ.copy()
    env["PGPASSWORD"] = params["password"]

    try:
        with open(output_path, "wb") as f:
            result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, env=env, timeout=300)

        if result.returncode != 0:
            return {"error": f"pg_dump failed: {result.stderr.decode()}"}

        size = os.path.getsize(output_path)
        size_mb = round(size / (1024 * 1024), 2)
        return {"status": "ok", "path": output_path, "size_mb": size_mb}
    except FileNotFoundError:
        return {"error": "pg_dump not found. Install PostgreSQL client tools."}
    except subprocess.TimeoutExpired:
        return {"error": "pg_dump timed out after 5 minutes"}


@mcp.tool()
def db_migration_status() -> dict:
    """Check Alembic migration status — current revision vs head. Looks for alembic.ini in the project."""
    search_dirs = [
        Path.cwd(),
        Path.cwd() / "backend",
    ]

    alembic_dir = None
    for d in search_dirs:
        if (d / "alembic.ini").exists():
            alembic_dir = d
            break

    if not alembic_dir:
        return {"error": "No alembic.ini found in project"}

    env = os.environ.copy()
    url = _find_database_url()
    if url:
        env["DATABASE_URL"] = url

    try:
        current = subprocess.run(
            ["alembic", "current"],
            capture_output=True, text=True, cwd=str(alembic_dir), env=env, timeout=30,
        )
        head = subprocess.run(
            ["alembic", "heads"],
            capture_output=True, text=True, cwd=str(alembic_dir), env=env, timeout=30,
        )

        current_rev = current.stdout.strip()
        head_rev = head.stdout.strip()
        is_current = current_rev.split(" ")[0] == head_rev.split(" ")[0] if current_rev and head_rev else False

        return {
            "current": current_rev or current.stderr.strip(),
            "head": head_rev or head.stderr.strip(),
            "up_to_date": is_current,
        }
    except FileNotFoundError:
        return {"error": "alembic command not found. Activate the virtual environment first."}
    except subprocess.TimeoutExpired:
        return {"error": "alembic command timed out"}


if __name__ == "__main__":
    mcp.run()
