---
description: In monorepos with multiple apps, enforce strict parity on shared infrastructure (security primitives, app-bootstrap shape, layout shells) so new apps inherit canonical patterns instead of forking them
---

# Monorepo Parity Discipline

## Purpose

In monorepos with multiple apps that share infrastructure, drift between apps causes production incidents. The whole point of a monorepo is that the second app should be faster to build than the first, and the third faster than the second — because each new app inherits operational and security primitives that have already been hardened. When apps are allowed to fork instead of inherit, every new app re-litigates the same infrastructure problems and re-introduces the same classes of bugs.

This rule encodes the parity discipline. It applies whenever a project has two or more apps under the same monorepo root sharing one or more packages.

## Hierarchy of authority

When deciding what shape a piece of code should take in any app of a monorepo, walk the layers top-down. Higher layers always win.

1. **Best practice / security spec / `jkwon-claude-config` rules** — the codified universals: this rule, `g-auto-capture.md`, `no-bandaid-solutions.md`, `stacks/*.md`, `global-preferences.md`. These are non-negotiable.
2. **Shared library code** (`platform_shared`, `@platform/ui`, or whatever the project calls its shared package) — security primitives, common schemas, shared data models, shared component primitives. Every app imports.
3. **Shared operational templates** (`infra/templates/`, base classes, factory functions) — Caddyfile templates, docker-compose templates, deploy workflow templates, settings base class, lifespan factory, layout shell, theme bootstrap. Inherited or rendered, not copy-pasted.
4. **The most-mature app** (the canonical / reference implementation) — concrete realization of layers 1-3 plus its own Tier 3 domain code.
5. **New apps** — derived from layers 1-4. A new app's non-domain code should be byte-identical to the canonical app's matching files except for app names, ports, and domain.

When any two layers disagree, the higher layer wins. Always. If the canonical app says one thing and the shared library says another, the shared library is right and the canonical app needs to be fixed.

## The Three Tiers of code in a monorepo

Every file in a monorepo app belongs to exactly one tier. The rules differ per tier.

### Tier 1 — Shared library code

Security primitives and common data shapes. **Reinventing these per-app is a security defect, not a style preference.**

Tier 1 includes:

- **Security primitives**: RBAC roles + `RequireRole` dependency, TOTP enrollment + challenge + recovery codes, account lockout (threshold + exponential backoff + auto-reset), per-IP login rate limit, HIBP password breach check, Turnstile CAPTCHA + boot guard, OAuth token encryption (Fernet + HKDF + hybrid property), PII column encryption (`EncryptedString` `TypeDecorator` + `key_version`), audit log + sensitive field masking, auth events table + `log_auth_event` helper, account deletion (password + email + TOTP confirmation), data export with PII redaction, email verification + password reset flows, disposable email blocklist, tenant isolation (user_id scoping at repo layer)
- **Common table schemas**: users, auth_events, audit_logs, organizations, members, sessions
- **Shared component primitives** (frontend): button, input, dialog, toast, table, badge, form primitives — anything that should look identical across every app

Rule: **Tier 1 code MUST live in the shared package. Every app imports it. Per-app reimplementations are bugs.** When you find one, the fix is to extract to shared and import — not to copy-paste the canonical implementation into the new app.

### Tier 2 — Shared operational templates

App-bootstrap and operational shape. **Inherited or rendered, never copy-pasted.**

Tier 2 includes:

- **Backend**: Caddyfile, `docker-compose.yml`, deploy workflow (`.github/workflows/deploy-*.yml`), `.env.example`, `Settings` base class, lifespan factory, Sentry init, boot guards, bucket initializers, DB pool teardown
- **Frontend**: layout shell (AppShell or equivalent), theme bootstrap (`localStorage.<key>` + prefers-color-scheme), Tailwind dark variants, page wrappers (centered max-width container), skeleton loading patterns, toast usage, empty-state structures
- **Auth pages**: Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Security, Settings, Account Deletion — these are part of the auth contract, not app-specific UX

Rule: **Tier 2 code MUST be inherited from a base class, rendered from a template, or imported from a shared module. Each new operational step (a new lifespan hook, a new Caddy directive, a new auth page) is added once in the shared layer; all apps inherit.**

### Tier 3 — App-specific domain code

The unique value proposition of each app. **Allowed to diverge — that's the whole point of having multiple apps.**

Tier 3 includes:

- Domain models (Transaction, Invoice, JobApplication, ResumeUpload — whatever the app uniquely owns)
- Domain pages and feature components (the screens that render the app's unique data)
- Domain-specific empty-state copy and onboarding
- Domain-specific RTK Query slices / API hooks
- Domain-specific business logic services

Rule: **Tier 3 is meant to differ across apps. No parity required.**

## The canonical-app rule

In a monorepo with two or more apps, designate ONE app as canonical — typically the most mature, the one that has shipped the most production incidents and accumulated the most learnings. Document the designation in the project's root `CLAUDE.md` or `MEMORY.md`.

Non-canonical apps mirror the canonical app **byte-for-byte** for Tier 1 and Tier 2 code. The only allowed divergences are:

- App name (in `package.json`, `pyproject.toml`, container names, log prefixes)
- Ports (frontend dev port, backend port, exposed container ports)
- Domain / subdomain (Caddy site address, allowed CORS origins)
- Tier 3 domain code (the reason the app exists)

Everything else is parity-required. If the non-canonical app's Caddyfile structurally differs from the canonical's, that is drift and is a bug.

## Audit prerequisite

**BEFORE designating any app as canonical, audit it.** If you mirror a buggy canonical, you mirror the bug into every new app and turn one bug into N bugs. The audit must cover:

- **Security checklist** — every Tier 1 primitive correctly implemented or imported from shared. No reimplementations. No silent-fail try/except blocks. No missing-env crashes.
- **Best-practice rules from `stacks/*.md`** — the canonical must conform to the relevant stack guides (python.md, fastapi.md, react.md, caddy.md, docker-compose.md). Any violation is a fix-canonical-first item.
- **Tech debt log** (`TECH_DEBT.md`) — no known broken patterns in load-bearing files. Critical-severity items must be resolved before canonical designation.
- **Latent-bug scan** — silent-fail catches, missing-env crashes, deprecated patterns, hardcoded "temporary" values, untested code paths in security-sensitive flows.

If the audit surfaces any defect, fix it in the canonical app first, then mirror the corrected version forward.

## Correction flow when canonical is wrong

The canonical app is a reference implementation, not divine writ. When it's wrong, fix it — don't propagate the bug. Five scenarios with required responses:

1. **Latent bug in canonical** (e.g., race condition, missing await, unindexed query) → Fix canonical first. Then mirror the fix into every non-canonical app in the same PR sweep or as immediate follow-ups.
2. **Deprecated pattern in canonical** (e.g., uses old library, old auth approach, old test framework) → Modernize canonical first. Mirror the modernization. Update `stacks/*.md` if the pattern was guide-level.
3. **Security flaw in canonical** (e.g., unscoped query, missing rate limit, plaintext token) → STOP. Fix canonical immediately. **Reproducing a security flaw across apps for the sake of parity is itself a security defect.** Treat as P0.
4. **Pattern in canonical is actually app-specific, not shared infrastructure** (you discover this during a parity check) → Don't mirror. Mark with a code comment in canonical (`# App-specific: this pattern only applies to <canonical>; do not propagate`) so future agents don't mirror it.
5. **Canonical and shared library disagree** (canonical hand-rolls something the shared library already provides) → Fix canonical to import from shared. Delete the canonical reimplementation. This is the most common form of drift.

## The litmus test

For any file in a non-canonical app: "If I told a stranger this was the canonical app, could they tell otherwise?"

- **No, indistinguishable** → properly mirrored ✓
- **Yes, because of name/port/domain** → expected divergence ✓
- **Yes, because the structure differs** → drift; fix it ✗
- **Yes, because it's new business logic that doesn't exist in canonical** → expected, that's Tier 3 ✓

When in doubt, the litmus is: same Tier 1/Tier 2 shape, different Tier 3 contents.

## Decision flow when adding new code to a non-canonical app

Step-by-step, what an agent should do before writing any non-domain code in a non-canonical app:

1. **Is there a matching file/pattern in the canonical app?**
   - **Yes** → mirror it. If the structure differs (not just names/ports), revisit — you're either drifting from canonical or this is genuinely Tier 3.
   - **No** → continue to step 2.

2. **Is this novel infrastructure** (a new lifespan step, a new shared component, a new auth flow)?
   - **Yes** → build it in the shared library or operational template first. Then both canonical and non-canonical consume from shared.
   - **No** → continue to step 3.

3. **Is this Tier 1** (security primitive, common schema)?
   - **Yes** → MUST go in the shared library. If not yet there, extract first. Per-app implementations are bugs.
   - **No** → continue to step 4.

4. **Is this Tier 2** (operational shape, layout shell, auth page)?
   - **Yes** → MUST go in shared template / base class. If not yet there, extract first.
   - **No** → continue to step 5.

5. **Is this Tier 3** (domain-specific business logic)?
   - **Yes** → app-local is correct. Write it in the app.

If step 5 is "no" too, the proposed code doesn't belong anywhere. Reconsider the requirement.

## Auto-promote rule

When a pattern appears in 2+ apps of a monorepo, **the PR that introduces the second occurrence MUST extract it to shared in the same commit**. Never deferred to a TECH_DEBT entry. Never "we'll consolidate later."

The reasoning: deferred consolidation never happens. Once a pattern lives in two places, every subsequent PR is one more place where the third app could copy from either of the existing ones, increasing drift surface area. Extracting at the moment of duplication is cheap. Extracting after three apps and four PRs is a major refactor.

This rule is symmetric with `no-bandaid-solutions.md` — the bandaid here is "ship the duplicate, fix it later." Don't.

## Reference incident

Tonight's incident on MyFreeApps (2026-05-04 / 05) is the canonical example. The user has two apps in the monorepo: `mybookkeeper` (canonical, mature) and `myjobhunter` (newer, scaffolded by separate agent runs). Every MyJobHunter production bug that night traced to MJH diverging from MBK on operational/security/infrastructure shape:

- MJH's docker Caddyfile used `{$DOMAIN}` while MBK's used `:80` — caused infinite HTTPS redirect loop in container
- MJH's `Settings.database_url_sync` was a required field while MBK's was an `@property`-derived computed value — broke env validation
- MJH had no Sentry init wired into lifespan
- MJH had no SMTP wired
- MJH's profile page had no centered max-width container, AppShell header wasn't sticky
- MJH's table is named `users` (plural) while MBK uses `user` (singular) — schema convention drift
- MJH had no RBAC, no TOTP, no account lockout — security primitives reinvented (or absent) per-app

Root cause: the shared package was a utility library, not a real platform. It abstracted some primitives but not the operational shape, and there was no rule preventing per-app forking. Each new app hand-rolled bootstrap shape via copy-paste from the canonical, the copies drifted, and drift caused outages.

For full session context, refer to the project memory at the canonical hash for that project (`~/.claude/projects/<MyFreeApps-hash>/memory/project_platform_shared_real_platform.md`).

## Specific schema conventions (non-exhaustive)

When the canonical app and any non-canonical app share a database, table conventions are part of the parity surface. The following are universally enforced:

- **UUID primary keys** — `uuid.uuid4` Python default + server-side default. Never `uuid-ossp` or `gen_random_uuid()` only — the application should not depend on a Postgres extension being present.
- **Timezone-aware timestamps** — `DateTime(timezone=True)` for `created_at` + `updated_at`. Both Python and server defaults so inserts from raw SQL still populate them.
- **Tenant FK** — `user_id` (or `organization_id` for multi-tenant apps) with `ON DELETE CASCADE` and an index. Repository-layer queries must filter by tenant on every read.
- **Enums as `String(N)` + `CheckConstraint`**, never SQLAlchemy `Enum` type — Postgres enum types require migrations to add values, and SQLAlchemy `Enum` couples the app's runtime values to the DB type.
- **Soft-delete only where users expect undo** (transactions, leases, applications). Audit-log tables, auth_events, and append-only logs do not soft-delete.
- **Encrypted PII** via `EncryptedString` `TypeDecorator` + `key_version` column. Never plaintext PII in the database.
- **Partial unique indexes for soft-delete uniqueness** — `WHERE deleted_at IS NULL` on the unique constraint so undeletes don't collide.

Violating a schema convention is a bug, not a style preference. Frontend type unions and backend enum strings must move together (per `feedback_enum_changes_cross_stack.md`).

## Relationship to other rules

- **`g-auto-capture.md`** — when a parity-related practice is captured during user work, this rule says where it belongs (shared package, not a per-app stack guide entry).
- **`no-bandaid-solutions.md`** — "ship the duplicate, consolidate later" is a bandaid. The auto-promote rule above is the parity-specific application of no-bandaid.
- **`never-auto-merge-config-repo.md`** — changes to this rule (or to `stacks/*.md` driven by parity findings) still require user merge.
- **`stacks/*.md`** — language-specific guides reference this rule. The stack guides codify "what" the practice is; this rule codifies "where in the monorepo" it belongs.
