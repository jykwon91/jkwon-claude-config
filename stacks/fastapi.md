# FastAPI Stack Guide

Apply these patterns when the project uses FastAPI. Detect from `fastapi` in `requirements.txt` or `pyproject.toml`.

## CRITICAL — Layered Architecture

- **Route handlers** are thin wrappers — they validate input, call a service, and return a response. No business logic.
- **Services** contain business logic and orchestrate operations. They call repositories for data access.
- **Repositories** handle all database operations — queries, inserts, updates, deletes.
- **Mappers** convert between representations (API response → model, raw extraction → domain object).
- Route handlers must never import database/ORM primitives directly — services manage their own data access through repositories.

## CRITICAL — Pydantic Schemas

- Define request and response schemas as Pydantic models — never accept or return raw dicts.
- Keep schemas in a dedicated `schemas/` directory, organized by domain.
- Align Pydantic field types with SQLAlchemy column types — mismatches cause silent data corruption.
- Use `from_attributes = True` (Pydantic v2) for ORM model serialization.
- Use `Field()` with constraints (min_length, ge, le) for input validation.
- Use separate schemas for create, update, and response — don't reuse one model for all operations.

## CRITICAL — Async Database Access

- Use async database driver (asyncpg for PostgreSQL, aiosqlite for SQLite).
- Never use synchronous database calls in async route handlers.
- Use a session factory or dependency injection for database sessions — never create sessions manually in route handlers.
- Use a unit-of-work pattern for operations that span multiple tables.
- Use `selectinload` or `joinedload` to avoid lazy loading in async context (lazy loading triggers implicit I/O).

## HIGH — SQLAlchemy Patterns

- UUID primary keys for all models (if the project uses UUIDs).
- Define relationships with explicit cascade behavior.
- Use Alembic for all schema changes — never modify the database manually.
- Alembic migrations must not import runtime application code (services, models with runtime dependencies).
- Migrations must be reversible — always implement both `upgrade()` and `downgrade()`.
- Test migrations against existing data — adding NOT NULL without a default will fail on non-empty tables.

## HIGH — Authentication & Authorization

- Validate auth tokens in dependencies, not manually in each route.
- Filter all queries by the authenticated user's scope (user_id, organization_id) — never return cross-tenant data.
- Check permissions at the service layer, not just the route layer — services may be called from background jobs.

## HIGH — Error Handling

- Return structured error responses with consistent shape (`{"detail": "..."}` or custom error schema).
- Use appropriate HTTP status codes — don't return 200 for errors or 500 for client mistakes.
- Never expose internal error details (stack traces, SQL errors) in API responses.
- Use exception handlers for common error types — don't repeat try/except in every route.

## MEDIUM — Background Jobs

- Offload long-running work (email sending, file processing, report generation) to background workers.
- Use a task queue (Dramatiq, Celery, or similar) for reliable job processing.
- Background workers need their own database sessions — don't share sessions with the web process.
- Implement timeouts and retry logic for background jobs.

## MEDIUM — Rate Limiting & Security

- Rate-limit authentication endpoints (login, registration, password reset).
- Rate-limit expensive operations (file uploads, AI processing, exports).
- Validate file types by magic bytes, not just file extension.
- Set maximum request body sizes for upload endpoints.

## LOW — Performance

- Use database-level aggregation (SUM, COUNT, GROUP BY) — don't pull rows into Python to aggregate.
- Add indexes for columns used in WHERE, ORDER BY, and JOIN clauses.
- Use connection pooling for database connections.
- Cache expensive queries that don't change frequently.
