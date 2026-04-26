## Global Software Engineering Preferences

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
- Extract data mapping and conversion logic into dedicated mapper modules — services orchestrate (load, decide, persist), mappers convert (raw data → model). Never duplicate model construction logic across multiple files.
- All imports belong at the top of the file — never inside functions or methods. If a circular import occurs, fix the architecture (break the cycle by restructuring modules), don't hide it with a lazy import.
- Before writing a custom solution, research whether a well-supported, well-maintained library already solves the problem. Suggest it as an option if it fits the exact requirement and doesn't significantly increase project overhead.

### Testing
- Always include tests in the same commit as the code change — never commit logic without corresponding tests, then add tests as a follow-up. Tests are part of the deliverable, not a separate step.
- E2E tests are regression contracts — when a test fails, the code is broken, not the test. Fix the code to make the test pass. Never change a test just to satisfy broken code. Only update tests when feature requirements explicitly change.
- Always include E2E layout tests when adding new pages or modifying page layouts.
- Always write E2E tests that exercise real user flows end-to-end — create test data via API or UI, perform the action being tested, verify the outcome in the UI and database state, then clean up test data. Never write E2E tests that only check if elements are visible or rendered — those are layout tests, not behavioral tests.
- Always write E2E tests that verify skeleton loading states match the loaded page structure — same sections, same grid columns, same element count.
- For any uniqueness constraint, deduplication logic, or entity-matching rule: enumerate and test all composite key combinations before implementation — same entity from same source, same entity from different sources, different entities sharing partial keys (e.g., same EIN but different documents). Never assume the obvious case is the only case.

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
- Before building or redesigning any page, define the information hierarchy — list every data point the page will display and justify its presence. If a data point isn't actionable on this page, it doesn't belong. Remove before adding. UX reversals (adding then removing elements) indicate the hierarchy wasn't validated before implementation.

### Data Integrity
- Always inspect actual data before fixing bugs — query the database, check API responses, examine extraction output. Never assume what the data looks like.
- Never make destructive data decisions (deletes, merges, choosing between records) based on metadata alone — always verify by inspecting the actual content of the records or documents involved.
- Never write fixes that drop, nullify, or silence valid data to avoid errors — if real data violates a constraint, fix the field mapping or the constraint, not the data. Data accuracy with the source is non-negotiable.
- Always evaluate schema changes against the full existing schema — enforce normalization (every fact stored once), referential integrity (every FK enforced with intentional cascade behavior), query efficiency (indexes support actual query patterns), type correctness (column types match the domain), and consistency (same conventions across all tables). Flag violations before implementing.
- Never introduce tech debt — every commit must leave the codebase cleaner than or equal to how it was found. If a change creates a new issue (broken test, missing validation, dead code, loose typing, missing skeleton), fix it in the same commit. Never defer new issues to a tech debt tracker — TECH_DEBT.md is for pre-existing issues discovered during audits, not for deferring work from the current session.

### Refactoring
- Never refactor or rewrite components without preserving all existing functionality — inventory current features before rewriting, verify each feature works after, and get explicit confirmation before removing any feature.

### Workflow
- Always run the QA generator (`g-qa`) on first use in a new project to create a domain-specific QA agent tailored to that project's tech stack and data types. Then run the generated QA agent after implementing features to write and run tests.
- Always run the pre-commit review agent (`g-pre-commit`) before committing code changes to catch security issues, logic errors, and performance problems early.
- Always run design agents (UX, architecture, data) before implementing features — design agents are solutioning partners, not post-implementation reviewers.
- Always create a new git branch for each feature or PR — never push multiple unrelated changes to the same branch. Maximum one user-facing feature per PR — multi-feature PRs make regressions impossible to isolate and reviews impossible to focus. If planning multiple features, implement and merge each separately.
- Always merge your own existing feature branches to main before starting new work — check `git branch --no-merged main` at the start of every session and create PRs for any of your unmerged branches first. Other developers' branches are their responsibility.
- When a user corrects a mistake, don't just fix it — identify the root cause and create a systemic fix (test, preference, or workflow change) so the same mistake never reaches the user again.
- Never create a new PR on the shared config repo (jkwon-claude-config) if you already have an open PR there — push additional changes to your existing open PR branch to avoid stale conflicts. Other developers' open PRs do not block you from creating your own.
- Always write and run E2E tests for every new feature before committing — verify E2E test files are staged alongside feature code and confirm a green result before proceeding. Unit tests alone are never sufficient validation for user-facing changes. Tests must cover the full user flow (form submission, API interaction, state changes, error handling), not just rendering or visibility checks.
- When a project has a targeted test runner (e.g., `scripts/run-affected-tests.sh` with a `test-map.json`), use it instead of running the full test suite. Only run the full suite when shared infrastructure changes (auth, config, models, database session, test fixtures) or when the targeted runner explicitly falls back. Keep the test map updated when adding new test files or source directories.
- Enforce critical workflow rules with automated hooks (pre-commit checks, post-test sentinels), not just preferences — if a rule is important enough to write down, it's important enough to block the commit when violated.
- Always run database migrations immediately after creating or modifying migration files — never leave migrations unapplied, as the running dev server will crash on the next request that touches new or altered columns.
- Never skip pipeline steps (design agents, test-writer, code-reviewer, pre-commit) for any reason — if completing the full pipeline isn't possible in the current session, pause and continue in the next session rather than cutting corners.
- Delegate volatile codebase reads (component APIs, schemas, route lists, test patterns) to focused Explore subagents instead of reading files individually in the main context — reserve main-context file reads for files that need to be edited.
- Never acknowledge a code quality issue, standards violation, or missing test without fixing it in the same session — if you identify something broken, fix it before committing. If the fix is too large for the current PR, create a separate branch and complete it in the same session.
- Code review runs per-PR, never retroactively across multiple PRs. Every PR must pass review independently before merging. If a retroactive review finds issues across prior PRs, that's a signal to strengthen the per-PR review agents, not to batch reviews later.
- Never mark an audit item as resolved without verifying zero remaining violations — after fixing, re-run the same scan (grep, lint, test) to confirm the count is zero. Report exact file counts with file names, not estimates. If you can't fix all violations in one pass, leave the item open with the remaining count and file list.
- Never leave test data in a dev or production database — if tests insert records via API or direct DB access, the teardown must delete them. Always verify no test artifacts remain after running tests or agents that touch live databases.
- Never combine multiple features into a single pipeline agent call — split work into one focused feature per invocation, each with its own design → implement → E2E test → review cycle, to prevent over-scoping and skipped pipeline steps.
- Before starting any development work (features, bug fixes, refactoring), check if the working directory is already in use: run `git status --porcelain` and `git branch --show-current`. If the repo has uncommitted changes or is on a feature/fix branch (not main/master), do NOT switch branches or start working — set up a git worktree with `git worktree add` and work entirely within it. This check is mandatory, not optional — skipping it causes dirty branches and merge conflicts across sessions. Only one session should create database migrations at a time.
- Use a separate worktree per concurrent PR during multi-PR sweeps (dependency bundles, snapshot refreshes, audit fixes) — one worktree per branch lets agents run in parallel without contaminating each other's lockfiles, build outputs, or staged changes. Tear worktrees down after merge with `git worktree remove`.
- Bundle dependabot PRs by `(ecosystem, domain path)` whenever 3+ are open against the same lockfile, or whenever peer-dep coupling (React + react-dom + @types/react, Vite + plugin-react + vitest, TypeScript + @types/node) would leave a half-upgraded state if merged individually. Bundling avoids N-1 dependabot rebases and gives the breaking-change migration code one coherent home. Close the originals with "Superseded by #<bundle>" comments. Never bundle across ecosystems (npm + pip stay separate) or across domain paths (one app's deps stay separate from another's).
- Bumping a shared package (a `packages/*` workspace, a vendored library, a published internal package) requires verifying every downstream consumer typechecks and builds clean before opening the PR. List the consumers in the PR body — without that proof, consumers regress on the next build and the bump's blast radius is invisible to reviewers.
- Always force-push with `--force-with-lease`, never `--force`. The `--with-lease` variant aborts if the remote has commits you haven't seen — protecting against silently overwriting another developer's push to a shared branch (snapshot refreshes, dependency bundles, and stacked PRs all hit this).
- Admin-merge (`gh pr merge --admin`) is only acceptable after exhausting genuine fixes for the failing checks AND documenting the remaining failures as accepted-risk in a PR comment plus tracking issues. Use it for known/intentional CodeQL findings, build-time-only CVEs without runtime exposure, or pre-existing failures that the current PR doesn't introduce. Never use it to skip a check that the PR could legitimately fix. Every admin-merge must leave behind a tracking issue per accepted finding so the risk doesn't get forgotten.
- Never infer remote server state from a deploy workflow, config file, or memory — before any destructive op on a VPS (`mv`, `rm -rf`, `git reset --hard`, `docker compose down -v`, rename, symlink), require a fresh diagnostic paste from the user (`ls /srv/`, `docker compose ls -a`, `ss -tlnp`, `systemctl list-units --state=running`). A broken workflow can lie for years; config files in a monorepo are not evidence of what's deployed. State the risk, wait for the paste, then proceed.
