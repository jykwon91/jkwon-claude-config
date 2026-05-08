---
name: refactor-plan
description: Run the three audit agents in parallel (g-tech-debt-scan + g-extract-shared + g-parity-audit) and produce a unified, ranked refactor plan in TECH_DEBT.md. Use when planning a refactor cycle, before a major version bump, or when deciding what to work on next.
---

# Refactor Plan

This skill orchestrates a comprehensive refactor audit by composing three independent agents that each look at the codebase from a different angle. Their outputs merge into a single ranked plan.

## When to invoke

- Before starting a multi-PR refactor cycle (you want to know what's worth refactoring before sequencing)
- After adding a 2nd or 3rd app to a monorepo (extraction opportunities multiply)
- When the operator asks "what should we refactor?" or "what's the technical debt looking like?"
- Periodically (every 2-4 weeks) on actively-developed projects to catch drift early

## What it does

1. **Spawns three agents in parallel** (single message, multiple Agent tool uses):

   - **`g-tech-debt-scan`** — single-app issues across data, architecture, UX, security, plus the long-files audit (files over 500 LOC). Outputs to project's `TECH_DEBT.md`.
   - **`g-extract-shared`** — monorepo-only; flags app-specific code that should live in shared packages. Outputs to per-app `TECH_DEBT.md` under "Monorepo refactor audit".
   - **`g-parity-audit`** — monorepo-only; flags drift between canonical app and non-canonical apps. Outputs to per-app `TECH_DEBT.md` and surfaces the canonical-vs-drift distinction.

   For single-app projects, only `g-tech-debt-scan` runs; the other two no-op cleanly.

2. **After all three return**, read the updated `TECH_DEBT.md` files and produce a unified summary with:
   - Top 5 items across all three axes, ranked by (severity × blast radius / effort)
   - Quick-wins section (XS / S items with high payoff, e.g. parity-drift "delete local copy" tasks)
   - Blocked items section (anything tagged `blocked-on-X`)
   - Suggested PR sequence (extractions before consumers, fixes before splits, etc.)

3. **Stop after the summary.** Do NOT auto-execute fixes. The plan is the deliverable; execution is up to the operator.

## Inputs

- The project root (auto-detected from `cwd`)
- Optional: explicit canonical-app designation (passed through to `g-parity-audit`)
- Optional: scope filter (e.g. "frontend only" / "backend only") — passed to each agent

## Outputs

- `TECH_DEBT.md` files updated in place across the project (each app for monorepos)
- A markdown summary in the chat with the unified ranked plan

## Composition pattern

This skill follows the same shape as `g-pipeline-curate-memory` and `g-pipeline-retro` — it's a thin orchestrator that spawns agents in parallel, waits for them to complete, then synthesizes their outputs. The agents themselves are the durable contracts; the skill is a convenience wrapper for "run them all + give me the unified view."

## What this skill is NOT

- It does NOT modify code (read-only audit cycle).
- It does NOT auto-merge any PRs.
- It does NOT ship extraction PRs — those are separate, one-feature-per-PR follow-ups the operator triggers based on the plan.

## Behavior in single-app projects

If the project doesn't have multiple `apps/*/` directories, only `g-tech-debt-scan` is meaningful. `g-extract-shared` and `g-parity-audit` will detect single-app and stop early per their own contracts. The skill should report this back: "Single-app project — only g-tech-debt-scan ran; extraction + parity audits are no-ops here."

## Example invocation

```
/refactor-plan
```

Or with scope:

```
/refactor-plan --scope=backend
```

The skill detects monorepo structure, spawns the appropriate agent set, waits for completion, and produces the unified summary.

## Output format (chat summary)

```markdown
## Refactor plan — YYYY-MM-DD

**Total findings:** N critical, N high, N medium, N low

### Top 5 by impact

1. [Severity] [Category] Short description — `path:line` — Effort: S/M/L
2. ...
3. ...

### Quick wins (XS/S effort, high payoff)

- [Severity] Short description — `path:line`
- ...

### Blocked items (tagged)

- [Tag] Short description — what unblocks it
- ...

### Suggested PR sequence

1. PR A — extract X to shared (unblocks PRs B and C)
2. PR B — refactor app to consume shared X
3. PR C — split long file Y
4. ...

Full details in:
- `apps/<app>/TECH_DEBT.md`
- (other apps' TECH_DEBT.md files for monorepos)
```

## Why three agents instead of one

Each agent is opinionated about a different question:

- `g-tech-debt-scan` — "what's wrong inside this codebase?"
- `g-extract-shared` — "what should be in the shared package?"
- `g-parity-audit` — "where do the apps disagree with the canonical?"

Combining them dilutes each. Running them in parallel and merging outputs gets you the unified view without losing the focus.
