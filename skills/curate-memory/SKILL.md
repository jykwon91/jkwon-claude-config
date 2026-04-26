---
name: curate-memory
description: Audit and reconcile the assistant's memory across all tiers (auto-memory, project CLAUDE.md, TECH_DEBT.md, ROADMAP.md, GitHub state). Detects staleness, duplication, contradictions, and tier-misplacement. Applies safe changes automatically; surfaces ambiguous ones for user confirmation. Emits a unified ROADMAP.md per project so future sessions have visibility into active plans.
argument-hint: [scope=all|project-name|project-path]
---

# Curate Memory

Run this when:
- Memory feels noisy or you can't find a fact you know was saved
- You finished a major milestone (multi-PR sweep, migration, sprint) and want to clean up stale "in flight" memories
- You haven't run it in >30 days

Invokes `g-pipeline-curate-memory` with the requested scope (defaults to `all`).

## What it does

1. **Audits** every memory + CLAUDE.md + TECH_DEBT.md + ROADMAP.md across all your projects (and the global config repo) against current GitHub state and file-system reality
2. **Auto-applies** safe changes (delete stale PR references, dedup worktree-fanout copies, merge overlapping files)
3. **Surfaces** ambiguous changes for your confirmation (promote a memory to a global preference? merge a contradiction? split a file?)
4. **Regenerates** `MEMORY.md` index so it stays under the 200-line auto-load limit
5. **Emits** a single `ROADMAP.md` per project surfacing active initiatives, recently shipped work, and deferred decisions

## Safety

- Full backup of the memory tree before any modification (kept 14 days)
- Per-tier action caps to prevent over-aggressive cleanup
- Never silently drops information — anything ambiguous is surfaced
- Never modifies files in another active session (detected via `git status` per project)
- Changes to `jkwon-claude-config` (global tier) always go through PR per `rules/never-auto-merge-config-repo.md` — never auto-applied

## Recommended cadence

Weekly for actively-developed projects; monthly when things are quiet.

You can automate via `/schedule` to run this pipeline on a recurring cadence.
