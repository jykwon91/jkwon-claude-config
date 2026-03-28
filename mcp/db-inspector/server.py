"""
Generic database inspector MCP server for Claude Code.
Stack-agnostic — connects via DATABASE_URL from .env using raw database drivers.
Uses information_schema for table discovery. Read-only by default.
"""
import os
import re
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


def _connect(url: str):
    """Return a DB-API connection based on the URL scheme."""
    sync_url = _get_sync_url(url)

    if sync_url.startswith("postgresql://"):
        import psycopg2
        # Extract connection info from URL
        match = re.match(
            r"postgresql://(?P<user>[^:]+):(?P<password>[^@]+)@(?P<host>[^:/]+)(?::(?P<port>\d+))?/(?P<dbname>[^?]+)",
            sync_url,
        )
        if not match:
            raise ValueError(f"Cannot parse PostgreSQL URL: {sync_url}")
        params = match.groupdict()
        return psycopg2.connect(
            host=params["host"],
            port=int(params["port"] or 5432),
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
            # Strip schema prefix if present
            schema = "public"
            table_name = table
            if "." in table:
                schema, table_name = table.rsplit(".", 1)

            # Columns
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

            # Indexes
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
    # Safety: only allow SELECT statements
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
        return [{"error": "Only SELECT and WITH (CTE) queries are allowed. This tool is read-only."}]

    url = _find_database_url()
    if not url:
        return [{"error": "No DATABASE_URL found in .env or environment"}]

    conn = _connect(url)
    cur = conn.cursor()

    try:
        # Enforce read-only via transaction
        if _is_postgres(url):
            cur.execute("SET TRANSACTION READ ONLY")

        cur.execute(sql)
        col_names = [desc[0] for desc in cur.description] if cur.description else []
        rows = cur.fetchmany(100)
        return [dict(zip(col_names, row)) for row in rows]
    finally:
        conn.rollback()  # Ensure no writes even if somehow attempted
        cur.close()
        conn.close()


@mcp.tool()
def db_sample(table: str, limit: int = 10) -> list[dict]:
    """Get sample rows from a table. Returns up to `limit` rows (max 50)."""
    limit = min(limit, 50)
    # Validate table name to prevent SQL injection
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_.]*$", table):
        return [{"error": f"Invalid table name: {table}"}]

    return db_query(f"SELECT * FROM {table} LIMIT {limit}")


if __name__ == "__main__":
    mcp.run()
