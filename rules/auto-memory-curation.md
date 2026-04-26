---
description: Before saving a memory or starting a plan, automatically check for duplicates, contradictions, and related existing memories — without waiting for the user to invoke /curate-memory
---

# Auto-Memory-Curation

The `g-memory-curator` agent and `/curate-memory` skill handle full audits. This rule handles the **inline checks** that should happen automatically every time you touch memory or start planning, so the user never has to remember to run a curation pass.

## Trigger 1 — Before saving a memory

Whenever you are about to write a new memory file (any file under `~/.claude/projects/<project-hash>/memory/`), do these checks first:

1. **Read the project's `MEMORY.md` index** — scan for entries with overlapping descriptions to what you're about to save
2. **Grep the memory directory** for the key phrase / rule / fact you're about to capture (`grep -ri "<key phrase>" ~/.claude/projects/<project>/memory/`)
3. **If a duplicate exists**: do NOT create a new file. Either:
   - The existing memory is correct and complete — skip the save and tell the user "already captured in `<existing>.md`"
   - The existing memory is partially right — UPDATE the existing file, don't create a new one
   - The existing memory is wrong/stale — UPDATE it with the new fact and a `**Updated:** <date>` line at the bottom
4. **If a near-duplicate exists in a different tier** (project CLAUDE.md, global preferences) — surface that to the user before writing: "This looks like it overlaps with `<file>:<section>`. Want me to update there instead, or is this project-specific enough to also live in auto-memory?"
5. **If saving a feedback memory** (rule the user enforced), additionally check `jkwon-claude-config/global-preferences.md` — if the rule looks generic (no project-specific reasoning), tell the user "This looks like a universal preference — consider `/add-preference` instead" rather than burying it in auto-memory.

This applies to ALL memory saves, including ones triggered by the `auto memory` system instructions in the harness.

## Trigger 2 — Before starting a plan

Whenever you are about to:
- Open a Plan via `EnterPlanMode`
- Create a new TaskCreate sequence for a multi-step initiative
- Begin work on a feature that takes >3 commits
- Write a `ROADMAP.md` entry or design doc

Do these checks first:

1. **Read the project's `ROADMAP.md`** if present — see what's already in flight, what's deferred, what was recently completed
2. **Read `MEMORY.md`** for entries tagged with the project area you're about to touch
3. **Check open GitHub PRs** by current user: `gh pr list --author @me --state open` — surface any in-flight work that overlaps with what's being planned
4. **Surface conflicts** to the user before planning:
   - "Already in flight as PR #X" → ask: continue that, or close it and start fresh?
   - "Deferred in ROADMAP under Y reason" → ask: has the reason changed, or should we keep deferring?
   - "Was already tried in <past PR>; reverted because <reason>" → surface the prior attempt's outcome before re-attempting

This protects against the "I forgot we already tried this" failure mode that the user explicitly flagged.

## Trigger 3 — At session start (recommended; not enforced)

Sessions started via `/session-start` already pull current state. For sessions started any other way, the **first time** the user describes work that touches a project this session, silently:

1. Read `ROADMAP.md` if present in the project root
2. Read `MEMORY.md` index for the project (already auto-loaded by the harness, but double-check it's current — if the index hasn't been touched in >30 days, suggest `/curate-memory` after the immediate task wraps)

## What NOT to do

- Do NOT run the full `g-pipeline-curate-memory` pipeline on every memory save — that's too heavyweight. The inline checks above are sufficient for in-the-moment correctness.
- Do NOT block memory saves on minor staleness. If a fact is mostly current, save it; the periodic full curation cleans up.
- Do NOT silently drop information. If you decide not to save (because of a duplicate), TELL the user where the existing entry is.
- Do NOT mention this rule's existence to the user during the inline checks. Just do the checks. Surface results when relevant.

## Promotion checklist

When the user is about to save a memory that looks generic, consider the tier ladder:

| Memory type | Right tier | How to save |
|---|---|---|
| Project-specific fact ("our DB uses X column for Y") | Project CLAUDE.md (tier 2) | Edit CLAUDE.md, not auto-memory |
| Project-specific in-flight state ("PR #44 in progress") | Auto-memory (tier 1) | Save to project_*.md; auto-deletes when stale |
| User preference, project-specific | Auto-memory feedback_*.md (tier 1) | Save with **Why** + **How to apply** lines |
| User preference, generic / cross-project | Global preferences (tier 3) | Suggest `/add-preference` |
| Architectural decision affecting multiple files | Project CLAUDE.md "Architecture" section | Edit CLAUDE.md |
| Tech debt with location + recommendation | Project TECH_DEBT.md (tier 2) | Append entry; let pipeline do the work |
| Active initiative spanning multiple PRs | Project ROADMAP.md (tier 2) | Suggest `/curate-memory` to regenerate |

If you're not sure which tier an entry belongs in, ASK the user before saving.

## Relationship to other rules

- **`g-auto-capture.md`**: governs auto-capture of stack-specific best practices to `stacks/*.md` — that has its own dedicated trigger and PR mechanism. This rule is about everything else (auto-memory + project files + planning).
- **`never-auto-merge-config-repo.md`**: any change this rule proposes that would touch global config goes through PR per that rule. Never write to `jkwon-claude-config/` directly during inline curation.
