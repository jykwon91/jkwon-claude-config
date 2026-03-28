# Global Copilot Instructions

## Software Engineering Preferences

### Code Quality
- Prefer simple, minimal solutions. Avoid over-engineering.
- Don't add abstractions, helpers, or utilities unless clearly necessary.
- Don't add comments unless the logic is non-obvious.
- Prefer editing existing code over creating new files.
- Write code for readability and maintainability first — optimise for the next developer reading it, not for cleverness.
- Never use hacks or workarounds — always prefer the cleaner, more elegant, and robust approach even if it takes more effort upfront.
- Don't duplicate code — extract repeated logic into a shared function or module rather than copying it.
- Always remove unused code, files, directories, imports, type exports, and stale references when making changes — don't leave dead code or orphaned references behind.

### Typing & Structure
- Always use strict typing. Avoid `any`, implicit types, or loose type definitions.
- Define one type, model, or interface per file — never group multiple type definitions in a single file.
- Keep types, constants, and configuration in dedicated directories — never define them inline in component, route, or service files.
- Separate configuration from code — keep environment-specific values, constants, and magic numbers in dedicated config or constants files, not inline.

### Architecture
- Modularize code by responsibility — each module, file, or function should have a single, well-defined purpose.
- Structure projects logically — group files by feature or domain, not by file type, so related code lives together.
- Prefer pure functions — functions with no side effects and deterministic output — unless state or side effects are required.
- Follow layered architecture — route/controller handlers should be thin wrappers that delegate to services; services contain business logic; repositories or data-access modules handle all database operations.
- Never import database or ORM primitives in route handlers — data access belongs in the service or repository layer.
- Extract data mapping and conversion logic into dedicated mapper modules — services orchestrate (load, decide, persist), mappers convert (raw data → model). Never duplicate model construction logic across multiple files.
- All imports belong at the top of the file — never inside functions or methods. If a circular import occurs, fix the architecture (break the cycle by restructuring modules), don't hide it with a lazy import.
- Before writing a custom solution, research whether a well-supported, well-maintained library already solves the problem. Suggest it as an option if it fits the exact requirement and doesn't significantly increase project overhead.

### Testing
- Always include tests in the same commit as the code change — never commit logic without corresponding tests.
- E2E tests are regression contracts — when a test fails, the code is broken, not the test. Fix the code to make the test pass. Never change a test just to satisfy broken code. Only update tests when feature requirements explicitly change.
- Always include E2E layout tests when adding new pages or modifying page layouts.
- Always write E2E tests that simulate real user interactions (fill forms, click buttons, submit, verify outcomes) — never write tests that only check if elements are visible or rendered.
- Always write E2E tests that verify skeleton loading states match the loaded page structure — same sections, same grid columns, same element count.

### Security
- Never hardcode secrets or API keys in source files — always use environment variables. Committing `.env` files with dev/dummy values is acceptable.
- Always validate field names against an explicit allowlist before applying dynamic updates (`setattr`, spread operators, etc.).

### UX Patterns
- Never define components inline or inside other components — always extract to separate files and import.
- Extract reusable UI components for any pattern repeated 3+ times — loading states, empty states, badges, cards.
- Use toast banners or non-intrusive notifications for error and success feedback — never use `alert()` or modal dialogs for operation results.
- Use skeleton loaders for page loading states — never show plain text like "Loading..." as a placeholder. Skeletons should mirror the layout of the loaded page to prevent layout shift.
- Always show a loading state on buttons immediately when clicked — don't wait for the API response to indicate progress.
- Always design UI components and pages with mobile-first responsiveness — ensure touch targets are at least 44x44px, layouts work on small screens, data tables have responsive column visibility or card alternatives, and interactive elements support touch events alongside mouse events.
- Never block the UI or API responsiveness with background work — offload long-running tasks so users can continue interacting with the application.
- Always provide visible feedback for every user action — show progress during operations, confirm success on completion, and display clear error messages on failure. Never leave the user wondering if something happened.

### Data Integrity
- Always inspect actual data before fixing bugs — query the database, check API responses, examine extraction output. Never assume what the data looks like.
- Never write fixes that drop, nullify, or silence valid data to avoid errors — if real data violates a constraint, fix the field mapping or the constraint, not the data. Data accuracy with the source is non-negotiable.
- Never introduce tech debt — if a solution requires TODO comments, temporary workarounds, known shortcuts, or "we'll fix this later" compromises, find the proper solution now or flag it as a blocker before proceeding.

### Refactoring
- Never refactor or rewrite components without preserving all existing functionality — inventory current features before rewriting, verify each feature works after, and get explicit confirmation before removing any feature.

### Workflow
- Always create a new git branch for each feature or PR — never push multiple unrelated changes to the same branch.
- Always merge existing feature branches to main before starting new work.
- When a user corrects a mistake, don't just fix it — identify the root cause and create a systemic fix (test, preference, or workflow change) so the same mistake never reaches the user again.
- Always write and run E2E tests for every new feature before committing.

---

## Available Agents

The following custom agents are installed at `~/.copilot/agents/`. Use them via `/agent` or by name in prompts.

### Pipeline & Orchestration
| Agent | Purpose |
|-------|---------|
| `g-build-feature` | End-to-end feature builder: design → implement → test → review → commit |
| `g-pipeline` | Full validation pipeline: build → unit tests → E2E → code review |
| `g-pre-commit` | Pre-commit review: security + code review + bug detection in parallel, with auto-fix |

### Design (run before implementation)
| Agent | Purpose |
|-------|---------|
| `g-design-data` | Schema, models, migrations, query patterns |
| `g-design-architecture` | Layering, modularity, service boundaries |
| `g-design-ux` | Interaction flows, states, accessibility, mobile |
| `g-design-libraries` | Research existing libraries before building custom |
| `g-design-data-analyst` | Analytical queries, reporting, aggregation |
| `g-design-security` | Auth flows, access control, trust boundaries |
| `g-design-prompt` | AI extraction prompts, schema enforcement |

### Implementation
| Agent | Purpose |
|-------|---------|
| `g-implement-backend` | Backend features: models → schemas → repos → services → routes |
| `g-implement-frontend` | Frontend features: types → hooks → components → pages |

### Review
| Agent | Purpose |
|-------|---------|
| `g-review-code` | General code review: correctness, security, performance |
| `g-review-backend` | Backend-specific review with framework detection |
| `g-review-frontend` | Frontend-specific review with framework detection |

### Testing
| Agent | Purpose |
|-------|---------|
| `g-write-tests` | Write unit tests with happy path, edge cases, errors |
| `g-qa` | Generate project-specific QA agent |
| `g-diagnose-e2e` | Diagnose E2E failures (read-only, produces fix hypotheses) |
| `g-fix-e2e` | Apply diagnosed E2E fixes (edit-only) |

### Security & Debugging
| Agent | Purpose |
|-------|---------|
| `g-audit-security` | Security vulnerability audit |
| `g-debug-bug` | Systematic root cause analysis |

### Project Health
| Agent | Purpose |
|-------|---------|
| `g-tech-debt-scan` | Full project audit → prioritized TECH_DEBT.md |

## Available Skills

| Skill | Purpose |
|-------|---------|
| `fix-issue` | End-to-end GitHub issue fix workflow |
| `review-pr` | PR review with code + security analysis |
| `session-start` | Run session-start checks and show status dashboard |
| `cleanup-branches` | Find and delete merged local branches |

---

## React Stack Guide

Apply these patterns when the project uses React.

### CRITICAL — Component Architecture
- One component per file. Organize by feature/domain. Page components are thin orchestrators.
- Extract custom hooks for reusable stateful logic. Each hook does one thing.
- Keep forms, validation schemas, and defaults separate from form UI components.

### CRITICAL — State Management
- Server/API state → data-fetching library (React Query). Shared UI state → state manager. Form state → form library (React Hook Form). URL state → search params.
- Only ephemeral UI state (hover, open/closed) belongs in local useState.

### CRITICAL — Eliminating Waterfalls
- Defer `await` until the result is used. Parallelize independent async ops with `Promise.all()`.
- Start data fetching at the earliest possible moment.

### CRITICAL — Bundle Size
- Never import from barrel files. Lazy-load heavy components. Defer non-critical libraries.

### HIGH — Date Handling
- Use date-fns (or whichever the project has) — never raw `new Date()`.

### MEDIUM — Re-render Optimization
- Derive values during render. Don't define components inside other components.
- Use functional setState. Narrow useEffect dependencies to primitives.
- Use ternary for conditional rendering — never `&&` with 0/NaN values.

---

## Python Stack Guide

### CRITICAL — Import Discipline
- All imports at the top. Fix circular imports by restructuring, not lazy imports.
- Group: stdlib → third-party → local. Use absolute imports.

### CRITICAL — Type Safety
- Type hints on all signatures. Use `Optional[T]` explicitly. Avoid `Any`.
- Use `TypedDict` for known-key dicts, `Literal` for fixed strings.

### HIGH — Module Organization
- One model/schema per file. Group by feature/domain. Use `__init__.py` as facades.

### HIGH — Error Handling
- Never bare `except:` or `except Exception: pass`. Log with context. Custom exceptions for domain errors.

---

## FastAPI Stack Guide

### CRITICAL — Layered Architecture
- Routes → thin wrappers. Services → business logic. Repositories → data access. Mappers → conversions.
- Route handlers must never import database/ORM primitives.

### CRITICAL — Pydantic Schemas
- Define request/response as Pydantic models. Keep in `schemas/` directory.
- Separate schemas for create, update, and response. Use `from_attributes = True`.

### CRITICAL — Async Database Access
- Use async driver (asyncpg). Never synchronous calls in async handlers.
- Use `selectinload`/`joinedload` to avoid lazy loading in async context.

### HIGH — SQLAlchemy Patterns
- UUID primary keys. Explicit cascade behavior. Alembic for all schema changes.
- Migrations must be reversible and must not import runtime application code.

### HIGH — Auth & Authorization
- Validate auth in dependencies. Filter all queries by user scope. Check permissions at service layer.
