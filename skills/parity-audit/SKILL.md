---
name: parity-audit
description: Audit a monorepo for parity discipline (per `rules/monorepo-parity-discipline.md`). Two-pass scan — Pass 1 audits the canonical app for security/operational defects; Pass 2 audits non-canonical apps for drift against canonical. Outputs a ranked fix list, then asks whether to apply patches.
argument-hint: "[--patch] [--scope=canonical-only|non-canonical-only|both]"
allowed-tools: Read, Grep, Glob, Bash
---

# Parity Audit

Run this when:
- Working in a monorepo with multiple apps that share infrastructure
- A new app was scaffolded recently and you want to verify it inherits canonical patterns
- A canonical-app refactor landed and you want to make sure non-canonical apps mirror the new shape
- A production bug in a non-canonical app smells like "we forgot to mirror canonical"
- You haven't run it on this project yet, or it's been >30 days since the last audit

Invokes `g-parity-audit` against the current project.

## What it does

1. **Detects monorepo structure** — confirms the project has 2+ apps under a shared root. If it's a single-app project, exits early with "parity audit not applicable."
2. **Identifies the canonical app** — reads `CLAUDE.md` / `MEMORY.md` for an explicit designation. If none, surfaces a heuristic guess (most commits, oldest creation date, most lines of business logic) and asks for confirmation.
3. **Pass 1 — canonical audit** — scans the canonical app against `rules/monorepo-parity-discipline.md`, `stacks/*.md`, and the security checklist. Surfaces defects in canonical: hand-rolled Tier 1 primitives that should be shared, deprecated patterns, silent-fail catches, missing-env crashes, schema-convention violations.
4. **Pass 2 — drift audit** — for each non-canonical app, compares Tier 1 + Tier 2 files against canonical. Classifies each diff as bug / cosmetic / intentional-divergence.
5. **Ranked output** — produces a unified report with canonical fixes ordered FIRST (mirroring a buggy canonical produces N bugs), then non-canonical drift.
6. **Patch prompt** — after the report, asks: "Apply Pass 1 (canonical) fixes? Apply Pass 2 (non-canonical) fixes? Skip both?" Patches are opt-in per pass — never auto-applied.

## Arguments

- `--patch` — apply fixes after the report (default: audit-only). Even with this flag, the skill still asks per-pass before applying.
- `--scope=canonical-only` — run only Pass 1 (audit canonical, skip non-canonical drift). Useful when you just landed a canonical refactor and want to verify canonical is clean before mirroring.
- `--scope=non-canonical-only` — run only Pass 2 (assume canonical is correct, audit non-canonical drift). Useful when canonical was audited recently and you only need to check the new app.
- `--scope=both` — default. Run both passes.

## Safety

- **Audit-only by default.** Patches require explicit per-pass confirmation, even when `--patch` is set.
- **Canonical fixes always come first** in the recommendation order. Non-canonical patches are deferred until canonical is correct, OR the user explicitly opts to mirror current canonical anyway.
- **No mass-mirror.** Patches are applied per-file with reviewable commits, not as sweeping diffs.
- **Tier 3 (domain code) is excluded from drift detection.** Apps are meant to differ in their domain code; that's why they're separate apps.
- **Never modifies files in another active session** (detected via `git status` per app).

## Recommended cadence

- After every new-app scaffold: once, immediately, before the new app accumulates more drift
- After every canonical-app refactor that touches Tier 1 or Tier 2 code: to verify mirrors stay in sync
- Monthly otherwise, on actively-developed monorepos

## Relationship to other skills

- **`/curate-memory`** — orthogonal. Curate-memory cleans up assistant memory; parity-audit cleans up code drift.
- **`g-tech-debt-scan`** — adjacent but different. Tech-debt-scan audits a single app for general quality; parity-audit specifically audits drift between apps in a monorepo.
- **`g-build-feature` / `g-scaffold`** — both have a built-in parity check that fires before generating new code. Parity-audit is the explicit, on-demand version of the same check, plus the cross-app drift scan.
