# Python Stack Guide

Apply these patterns when the project uses Python. Detect Python from `requirements.txt`, `pyproject.toml`, `setup.py`, or `*.py` files.

## CRITICAL — Import Discipline

- All imports belong at the top of the file — never inside functions or methods.
- If a circular import occurs, fix the architecture (break the cycle by restructuring modules) — don't hide it with a lazy import.
- Group imports: stdlib → third-party → local, separated by blank lines.
- Use absolute imports from the package root, not relative imports.

## CRITICAL — Type Safety

- Use type hints on all function signatures — parameters and return types.
- Use `Optional[T]` explicitly, never implicit `None` returns.
- Avoid `Any` — if the type is truly dynamic, use `Union` or generics.
- Use `TypedDict` for dictionary structures with known keys.
- Use `Literal` for fixed string values instead of plain `str`.
- Run `mypy` or `pyright` if the project has it configured.

## HIGH — Module Organization

- One model, schema, or type definition per file.
- Group files by feature/domain, not by file type (e.g., `services/extraction/` not `services/all_services.py`).
- When a flat directory exceeds ~15 files, organize into domain subdirectories.
- Use `__init__.py` files as facades to re-export public APIs — callers import from the package, not internal modules.
- Keep constants, enums, and configuration in dedicated files — never inline in service or route files.

## HIGH — Data Mapping

- Extract data mapping and conversion logic into dedicated mapper modules.
- Services orchestrate (load, decide, persist); mappers convert (raw data → model).
- Never duplicate model construction logic across multiple service files — if the same model is being built from similar data in more than one place, consolidate into a shared mapper.

## HIGH — Error Handling

- Never use bare `except:` or `except Exception: pass` — always catch specific exceptions.
- Log exceptions with context before re-raising or returning error responses.
- Use custom exception classes for domain-specific errors.
- Never silence errors by returning default values — if something fails, the caller should know.

## MEDIUM — Async Patterns (if the project uses async)

- Never call blocking I/O (file reads, HTTP requests, subprocess) in async functions — use `asyncio.to_thread()` or async equivalents.
- Use `asyncio.gather()` to parallelize independent async operations.
- Never mix sync and async database drivers in the same codebase.

## MEDIUM — Pure Functions

- Prefer pure functions (no side effects, deterministic output) unless state or side effects are required.
- Separate I/O from computation — functions that compute should not also read files or query databases.
- Use dependency injection to make functions testable without mocking.

## LOW — Performance

- Use generators for large data processing instead of building full lists in memory.
- Use `set` for membership checks and `dict` for key lookups — O(1) vs O(n).
- Use list/dict/set comprehensions over manual loops when the logic is simple.
- Use `functools.lru_cache` for expensive pure function calls with hashable arguments.
