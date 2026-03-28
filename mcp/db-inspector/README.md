# DB Inspector MCP Server

Stack-agnostic database inspection tool for Claude Code. Connects via `DATABASE_URL` from `.env` using raw database drivers — not tied to any ORM.

## Setup

```bash
pip install -r requirements.txt
claude mcp add db-inspector -- python /path/to/server.py
```

## Tools

- `db_tables()` — list all tables with row counts
- `db_schema(table)` — column names, types, constraints, indexes
- `db_query(sql)` — read-only SELECT queries (max 100 rows)
- `db_sample(table, limit)` — sample rows from a table (max 50)

## Supported Databases

- PostgreSQL (via psycopg2)
- SQLite (via stdlib sqlite3)

## How It Finds the Database

Searches for `DATABASE_URL` in:
1. `.env` in the current directory
2. `backend/.env`
3. `server/.env`
4. `DATABASE_URL` environment variable
