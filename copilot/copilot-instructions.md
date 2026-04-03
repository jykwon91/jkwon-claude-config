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
- Never import database or ORM primitives in route handlers or service files — all data access must go through repository functions. If a repository function doesn't exist for the query you need, create it first. Violations of layered architecture are bugs, not tech debt to address later.
- Extract data mapping and conversion logic into dedicated mapper modules — services orchestrate (load, decide, persist), mappers convert (raw data -> model). Never duplicate model construction logic across multiple files.
- All imports belong at the top of the file — never inside functions or methods. If a circular import occurs, fix the architecture (break the cycle by restructuring modules), don't hide it with a lazy import.
- Before writing a custom solution, research whether a well-supported, well-maintained library already solves the problem. Suggest it as an option if it fits the exact requirement and doesn't significantly increase project overhead.

### Testing
- Always include tests in the same commit as the code change — never commit logic without corresponding tests, then add tests as a follow-up. Tests are part of the deliverable, not a separate step.
- E2E tests are regression contracts — when a test fails, the code is broken, not the test. Fix the code to make the test pass. Never change a test just to satisfy broken code. Only update tests when feature requirements explicitly change.
- Always include E2E layout tests when adding new pages or modifying page layouts.
- Always write E2E tests that exercise real user flows end-to-end — create test data via API or UI, perform the action being tested, verify the outcome in the UI and database state, then clean up test data. Never write E2E tests that only check if elements are visible or rendered — those are layout tests, not behavioral tests.
- Always write E2E tests that verify skeleton loading states match the loaded page structure — same sections, same grid columns, same element count.
- For any uniqueness constraint, deduplication logic, or entity-matching rule: enumerate and test all composite key combinations before implementation.

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
- Before building or redesigning any page, define the information hierarchy — list every data point the page will display and justify its presence. If a data point isn't actionable on this page, it doesn't belong. Remove before adding.

### Data Integrity
- Always inspect actual data before fixing bugs — query the database, check API responses, examine extraction output. Never assume what the data looks like.
- Never make destructive data decisions (deletes, merges, choosing between records) based on metadata alone — always verify by inspecting the actual content.
- Never write fixes that drop, nullify, or silence valid data to avoid errors — if real data violates a constraint, fix the field mapping or the constraint, not the data. Data accuracy with the source is non-negotiable.
- Always evaluate schema changes against the full existing schema — enforce normalization, referential integrity, query efficiency, type correctness, and consistency.
- Never introduce tech debt — every commit must leave the codebase cleaner than or equal to how it was found.

### Refactoring
- Never refactor or rewrite components without preserving all existing functionality — inventory current features before rewriting, verify each feature works after, and get explicit confirmation before removing any feature.

### Workflow
- Always run design agents (UX, architecture, data) before implementing features — design agents are solutioning partners, not post-implementation reviewers.
- Always create a new git branch for each feature or PR — never push multiple unrelated changes to the same branch. Maximum one user-facing feature per PR.
- Always merge your own existing feature branches to main before starting new work.
- When a user corrects a mistake, don't just fix it — identify the root cause and create a systemic fix (test, preference, or workflow change) so the same mistake never reaches the user again.
- Always write and run E2E tests for every new feature before committing — verify E2E test files are staged alongside feature code and confirm a green result before proceeding.
- Never skip pipeline steps (design agents, test-writer, code-reviewer, pre-commit) for any reason.
- Never leave test data in a dev or production database — teardown must delete all test artifacts.
- Never combine multiple features into a single pipeline agent call — one focused feature per invocation.

---

## Available Agents

The following custom agents are installed at `~/.copilot/agents/`. Use them via `/agent` or by name in prompts.

### Pipeline & Orchestration
| Agent | Purpose |
|-------|---------|
| `g-build-feature` | End-to-end feature builder: design -> implement -> test -> review -> commit |
| `g-troubleshoot` | End-to-end bug fix: diagnose -> design review -> implement -> regression test -> validate |
| `g-pipeline` | Full validation pipeline: build -> unit tests -> E2E -> code review |
| `g-pre-commit` | Pre-commit review: security + code review + bug detection in parallel, with auto-fix |
| `g-scaffold` | Generate boilerplate file structure with TODO markers for a new feature |

### Design (run before implementation)
| Agent | Purpose |
|-------|---------|
| `g-design-data` | Schema, models, migrations, query patterns, cross-store consistency |
| `g-design-architecture` | Layering, modularity, service boundaries, API contracts |
| `g-design-ux` | Interaction flows, states, accessibility, mobile, navigation state |
| `g-design-libraries` | Research existing libraries before building custom |
| `g-design-data-analyst` | Analytical queries, reporting, aggregation, export compatibility |
| `g-design-security` | Auth flows, access control, trust boundaries, secrets management |
| `g-design-prompt` | AI extraction prompts, schema enforcement, edge cases |

### Implementation
| Agent | Purpose |
|-------|---------|
| `g-implement-backend` | Backend features: models -> schemas -> repos -> services -> routes |
| `g-implement-frontend` | Frontend features: types -> hooks -> components -> pages |

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
| `g-tech-debt-scan` | Full project audit -> prioritized TECH_DEBT.md |

## Available Skills

| Skill | Purpose |
|-------|---------|
| `fix-issue` | End-to-end GitHub issue fix workflow |
| `review-pr` | PR review with code + security analysis |
| `session-start` | Run session-start checks and show status dashboard |
| `cleanup-branches` | Find and delete merged local branches |
| `codebase-brief` | Generate compressed project context summary |

---

## Workflow Rules

### Pipeline Routing
When the user describes work, automatically route to the correct agent:
- **Error/bug/regression/failing test** -> `g-troubleshoot` (full pipeline fix)
- **New feature/enhancement/new page** -> `g-build-feature` (full pipeline build)
- **Diagnosis only ("what's causing this?")** -> `g-debug-bug` (lightweight, no pipeline)
- **Ambiguous**: existing code that should handle it but doesn't -> `g-troubleshoot`; no existing code -> `g-build-feature`

### Multi-Session Safety
Before modifying code, check if the working directory is already in use:
- Run `git status --porcelain` and `git branch --show-current`
- If uncommitted changes exist or on a feature/fix branch, use a **git worktree** instead of working in the same directory
- Worktree servers use offset ports (e.g., :3001/:8001) to avoid collisions
- Only one session should create database migrations at a time
- Never `git checkout` in a directory where another session is working — use worktrees
- Never run `git stash` to shelve another session's work

### Cleanup After Merge
After merging a PR:
1. Delete the local and remote branch that was merged
2. Prune stale remote tracking branches: `git remote prune origin`
3. Only delete branches you own — check last commit author against `git config user.name`
4. Clean up worktrees associated with the merged branch

### Check Unmerged Branches
At session start, check `git branch --no-merged main` and cross-reference with `gh pr list --state open`. Report your unmerged branches with PR status. Say nothing if you have no unmerged branches.

### Auto-Capture Stack Practices
When a technical user states or corrects a stack-specific best practice, automatically capture it to the relevant stack guide. Only modify `stacks/*.md`. If the practice is universal (not stack-specific), mention it to the user instead of capturing.

---

## React Stack Guide

Apply these patterns when the project uses React.

### CRITICAL -- Component Architecture
- One component per file. Organize by feature/domain. Page components are thin orchestrators.
- Extract custom hooks for reusable stateful logic. Each hook does one thing.
- Keep forms, validation schemas, and defaults separate from form UI components.
- Side effects live in hooks, not scattered through event handlers and render bodies.

### CRITICAL -- State Management
- Server/API state -> data-fetching library (React Query). Shared UI state -> state manager. Form state -> form library (React Hook Form). URL state -> search params.
- Only ephemeral UI state (hover, open/closed) belongs in local useState.

### CRITICAL -- Navigation State Planning
- For pages with sub-views/tabs/drilldowns: plan URL state, back button behavior, and deep-link support before implementing.
- Every selectable view must be represented in URL search params.

### CRITICAL -- Eliminating Waterfalls
- Defer `await` until the result is used. Parallelize independent async ops with `Promise.all()`.
- Start data fetching at the earliest possible moment. Use Suspense boundaries strategically.

### CRITICAL -- Bundle Size
- Never import from barrel files. Lazy-load heavy components. Defer non-critical libraries.
- Preload based on user intent (hover/focus) before actual interaction.

### HIGH -- Next.js Specific (skip for Vite/CRA/SPA)
- Authenticate Server Actions same as API routes. Use `React.cache()` for per-request dedup.
- Pass only needed fields across RSC boundaries. Schedule non-blocking work with `after()`.

### HIGH -- Client-Side Data Fetching
- Use data-fetching library for dedup, caching, revalidation.
- Add `{ passive: true }` to scroll/touch listeners. Version localStorage keys.

### HIGH -- Date Handling
- Use date-fns (or whichever the project has) — never raw `new Date()` or `Date.parse()`.

### MEDIUM -- Re-render Optimization
- Derive values during render. Don't define components inside other components.
- Use functional setState. Narrow useEffect dependencies to primitives.
- Use ternary for conditional rendering — never `&&` with 0/NaN values.
- Extract default values to module-level constants to prevent broken memoization.

### MEDIUM -- Rendering Performance
- Use `useTransition` instead of manual loading state. Apply `content-visibility: auto` to long lists.
- Hoist static JSX outside components.

### LOW-MEDIUM -- JavaScript Performance
- Build index Maps for repeated `.find()` calls. Use `Set` for membership checks.
- Use `flatMap()` to map and filter in one pass. Use `.toSorted()` for immutability.

---

## Python Stack Guide

### CRITICAL -- Import Discipline
- All imports at the top. Fix circular imports by restructuring, not lazy imports.
- Group: stdlib -> third-party -> local. Use absolute imports.

### CRITICAL -- Type Safety
- Type hints on all signatures. Use `Optional[T]` explicitly. Avoid `Any`.
- Use `TypedDict` for known-key dicts, `Literal` for fixed strings.

### HIGH -- Module Organization
- One model/schema per file. Group by feature/domain. Use `__init__.py` as facades.
- When a directory exceeds ~15 files, organize into domain subdirectories.

### HIGH -- Data Mapping
- Extract data mapping into dedicated mapper modules. Services orchestrate; mappers convert.
- Never duplicate model construction logic across multiple service files.

### HIGH -- Error Handling
- Never bare `except:` or `except Exception: pass`. Log with context. Custom exceptions for domain errors.
- Never silence errors by returning default values.

### MEDIUM -- Async Patterns
- Never call blocking I/O in async functions — use `asyncio.to_thread()` or async equivalents.
- Use `asyncio.gather()` for independent async operations.

### MEDIUM -- Pure Functions
- Prefer pure functions. Separate I/O from computation. Use dependency injection for testability.

### LOW -- Performance
- Use generators for large data. Use `set` for membership checks. Use comprehensions over manual loops.

---

## FastAPI Stack Guide

### CRITICAL -- Layered Architecture
- Routes -> thin wrappers. Services -> business logic. Repositories -> data access. Mappers -> conversions.
- Route handlers must never import database/ORM primitives.

### CRITICAL -- Pydantic Schemas
- Define request/response as Pydantic models. Keep in `schemas/` directory.
- Separate schemas for create, update, and response. Use `from_attributes = True`.
- Use `Field()` with constraints for input validation.

### CRITICAL -- Async Database Access
- Use async driver (asyncpg). Never synchronous calls in async handlers.
- Use `selectinload`/`joinedload` to avoid lazy loading in async context.
- Use unit-of-work pattern for multi-table operations.

### HIGH -- SQLAlchemy Patterns
- UUID primary keys. Explicit cascade behavior. Alembic for all schema changes.
- Migrations must be reversible and must not import runtime application code.
- Test migrations against existing data.

### HIGH -- Auth & Authorization
- Validate auth in dependencies. Filter all queries by user scope. Check permissions at service layer.

### HIGH -- Error Handling
- Structured error responses. Appropriate HTTP status codes. Never expose internal error details.
- Use exception handlers for common error types.

### MEDIUM -- Background Jobs
- Offload long-running work to background workers with their own database sessions.
- Implement timeouts and retry logic.

### MEDIUM -- Rate Limiting & Security
- Rate-limit auth endpoints and expensive operations.
- Validate file types by magic bytes, not just extension. Set max request body sizes.

### LOW -- Performance
- Database-level aggregation (SUM, COUNT, GROUP BY). Add indexes for filtered columns. Connection pooling.
