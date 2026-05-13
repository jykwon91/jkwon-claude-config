---
description: In monorepos with multiple apps, enforce strict parity on shared infrastructure (security primitives, app-bootstrap shape, layout shells) so new apps inherit canonical patterns instead of forking them
---

# Monorepo Parity Discipline

Applies whenever a project has two or more apps under the same monorepo root sharing one or more packages. Drift between apps causes production incidents — new apps must inherit operational and security primitives, not re-litigate them.

## Hierarchy of authority

When deciding what shape a piece of code should take in any app, walk top-down. Higher layers always win.

1. **Best practice / security spec / `jkwon-claude-config` rules** — codified universals (this rule, `g-auto-capture.md`, `no-bandaid-solutions.md`, `stacks/*.md`, `global-preferences.md`). Non-negotiable.
2. **Shared library code** (`platform_shared`, `@platform/ui`) — security primitives, common schemas, shared models, shared component primitives. Every app imports.
3. **Shared operational templates** (`infra/templates/`, base classes, factories) — Caddyfile, compose, deploy workflow, Settings base, lifespan factory, layout shell, theme bootstrap. Inherited or rendered, never copy-pasted.
4. **The most-mature app** (canonical / reference) — concrete realization of layers 1-3 plus its own Tier 3.
5. **New apps** — derived from layers 1-4. Non-domain code byte-identical to canonical except for names, ports, domain.

When two layers disagree, the higher layer wins. If canonical disagrees with shared library, fix canonical.

## The Three Tiers

### Tier 1 — Shared library code
Security primitives and common data shapes. **Reinventing per-app is a security defect.**

- **Security primitives**: RBAC + `RequireRole`, TOTP (enroll/challenge/recovery), account lockout, per-IP login rate limit, HIBP breach check, Turnstile + boot guard, OAuth token encryption (Fernet + HKDF + hybrid property), PII column encryption (`EncryptedString` + `key_version`), audit log + masking, auth events + `log_auth_event`, account deletion, data export with PII redaction, email verify + password reset, disposable email blocklist, tenant isolation
- **Common table schemas**: users, auth_events, audit_logs, organizations, members, sessions
- **Shared component primitives** (frontend): button, input, dialog, toast, table, badge, form primitives

Rule: **MUST live in the shared package. Per-app reimplementations are bugs — extract to shared, don't copy-paste.**

### Tier 2 — Shared operational templates
App-bootstrap and operational shape. **Inherited or rendered, never copy-pasted.**

- **Backend**: Caddyfile, `docker-compose.yml`, deploy workflow, `.env.example`, `Settings` base, lifespan factory, Sentry init, boot guards, bucket initializers, DB pool teardown
- **Frontend**: layout shell, theme bootstrap, Tailwind dark variants, page wrappers, skeleton patterns, toast usage, empty-state structures
- **Auth pages**: Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Security, Settings, Account Deletion

Rule: **MUST be inherited from base class, rendered from template, or imported. Add operational steps once in the shared layer; all apps inherit.**

### Tier 3 — App-specific domain code
The unique value proposition. **Allowed to diverge — that's the point.** Domain models, domain pages, domain-specific copy, domain hooks/services. No parity required.

## The canonical-app rule

Designate ONE app as canonical (typically most mature). Document in project root `CLAUDE.md` or `MEMORY.md`. Non-canonical apps mirror canonical **byte-for-byte** for Tier 1 + Tier 2. Allowed divergences: app name, ports, domain, Tier 3.

## Audit prerequisite

**BEFORE designating canonical, audit it.** Mirroring a buggy canonical turns one bug into N bugs. Audit must cover:

- **Security checklist** — every Tier 1 primitive correctly implemented or imported. No reimplementations. No silent-fail try/except. No missing-env crashes.
- **Best-practice rules from `stacks/*.md`** — canonical must conform.
- **Tech debt log** (`TECH_DEBT.md`) — no known broken patterns. Critical items resolved.
- **Latent-bug scan** — silent-fail catches, missing-env crashes, deprecated patterns, hardcoded "temporary" values, untested security paths.

Fix defects in canonical first, then mirror corrected version forward.

## Correction flow when canonical is wrong

Canonical is reference, not divine writ. Five scenarios:

1. **Latent bug in canonical** → Fix canonical first. Mirror fix into non-canonical apps in same PR sweep or immediate follow-ups.
2. **Deprecated pattern** → Modernize canonical first. Mirror. Update `stacks/*.md` if guide-level.
3. **Security flaw in canonical** → STOP. Fix immediately. **Reproducing a security flaw for parity is itself a defect.** P0.
4. **Pattern is actually app-specific, not shared** → Don't mirror. Mark in canonical (`# App-specific: do not propagate`).
5. **Canonical disagrees with shared library** (most common drift) → Fix canonical to import from shared. Delete the reimplementation.

## The litmus test

For any file in a non-canonical app: "If I told a stranger this was the canonical app, could they tell otherwise?"

- **No, indistinguishable** → properly mirrored ✓
- **Yes, name/port/domain** → expected ✓
- **Yes, structure differs** → drift; fix ✗
- **Yes, new business logic** → expected Tier 3 ✓

## Decision flow when adding new code to a non-canonical app

1. **Matching file/pattern in canonical?** Yes → mirror. No → step 2.
2. **Novel infrastructure?** Yes → build in shared library / template first. Both apps consume from shared.
3. **Tier 1** (security primitive, common schema)? Yes → MUST go in shared library.
4. **Tier 2** (operational shape, layout shell, auth page)? Yes → MUST go in shared template / base.
5. **Tier 3** (domain-specific)? Yes → app-local is correct.

If step 5 is also "no", the code doesn't belong anywhere. Reconsider.

## Auto-promote rule

When a pattern appears in 2+ apps, **the PR introducing the second occurrence MUST extract to shared in the same commit.** Never deferred. Extracting at duplication is cheap; extracting after three apps is a major refactor.

## Schema conventions (non-exhaustive)

Universally enforced:

- **UUID primary keys** — `uuid.uuid4` Python default + server-side default. Never depend on Postgres extension presence.
- **Timezone-aware timestamps** — `DateTime(timezone=True)` for `created_at`/`updated_at`. Python AND server defaults.
- **Tenant FK** — `user_id` (or `organization_id`) with `ON DELETE CASCADE` + index. Repository queries filter by tenant on every read.
- **Enums as `String(N)` + `CheckConstraint`**, never SQLAlchemy `Enum` type.
- **Soft-delete only where users expect undo** (transactions, leases, applications). Audit-log / auth_events / append-only logs don't soft-delete.
- **Encrypted PII** via `EncryptedString` `TypeDecorator` + `key_version`. Never plaintext.
- **Partial unique indexes for soft-delete uniqueness** — `WHERE deleted_at IS NULL`.

Schema violations are bugs, not style. Frontend type unions and backend enum strings move together (per `feedback_enum_changes_cross_stack.md`).
