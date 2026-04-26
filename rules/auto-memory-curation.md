---
description: Before saving a memory, automatically check for duplicates and tier-misplacement. Before starting a substantial plan, check for in-flight overlap. Designed for low intrusiveness — narrow triggers, conservative thresholds.
---

# Auto-Memory-Curation

The `g-memory-curator` agent and `/curate-memory` skill handle full audits. This rule handles the **inline checks** that should happen automatically. Triggers are deliberately narrow — false positives on these checks are intrusive (the user notices), so the bar to fire is high.

## Trigger 1 — Before saving a memory (always-on)

Whenever you are about to write a new memory file (any file under `~/.claude/projects/<project-hash>/memory/`):

1. **Grep the SAME directory** for the key phrase / rule / fact you're about to capture: `grep -ril "<key phrase>" ~/.claude/projects/<project>/memory/`
2. **If a duplicate exists in the same directory**: do NOT create a new file. Either:
   - Existing memory is correct + complete — skip the save and tell the user "already captured in `<existing>.md`"
   - Existing memory is partially right — UPDATE the existing file (don't create a new one)
   - Existing memory is wrong/stale — UPDATE it with a `**Updated:** <date>` line
3. **If saving a feedback memory that uses words like "always" / "never" / "for all projects"** — surface to user: "this looks generic — `/add-preference` instead?" — let user decide.

That's the entire trigger. Specifically:
- Do NOT cross-tier check unless the user explicitly opts in (too noisy for trivial saves)
- Do NOT block on near-duplicates — only EXACT key-phrase matches in the same directory
- Do NOT mention this rule's name when surfacing results — just say "looks like overlap with X, want to update there?"

## Trigger 2 — Before starting a substantial plan (high bar)

Fires only when ALL of these are true:
- About to create >5 tasks via TaskCreate, OR about to enter Plan mode, OR about to write a multi-section design doc
- The plan touches a project (not a config-repo or one-off scratch)
- The session has been active for >5 minutes (skip on quick turns where there's no time for in-flight overlap)

When fired, do exactly:

1. **Check open PRs by current user** in the affected project: `gh pr list --author @me --state open --json number,title,headRefName`
2. If ANY open PR's title overlaps with the planned work (substring match on the main noun), surface to user with the title + URL: "I see open PR #X (title). Continue that or open something new?"
3. **If `ROADMAP.md` exists in the project root**, read it and grep for the planned work's main noun. Surface a "previously deferred / completed / in flight" note ONLY if the grep returns a hit.

Do NOT:
- Read every memory file at plan-start (too noisy, too slow)
- Block planning if no overlap is found — just proceed silently
- Fire on quick fixes, single-file edits, bug investigations

## Trigger 3 — At session start (silent)

ONLY when:
- It's been >60 days since `~/.claude/projects/<project>/memory/MEMORY.md` was last modified, AND
- The user is about to do work in that project this session

Action:
- Add ONE line to your first response in this session: "(memory hasn't been curated in N days — `/curate-memory` when convenient)"
- Do not fire if the user is doing read-only work (questions, reviews) — only fire on write/plan work

That's it. No automatic curation. No cross-tier nudges. Just a one-line reminder once per stale-project-touch.

## What NOT to do

- Do NOT run the full `g-pipeline-curate-memory` pipeline inline. That's a heavyweight `/curate-memory` invocation only.
- Do NOT block memory saves on minor staleness. If a fact is mostly current, save it.
- Do NOT silently drop information. If you skip a save because of a duplicate, TELL the user where the existing entry is.
- Do NOT auto-promote between tiers. Promotion is the user's call — only SUGGEST.
- Do NOT mention this rule by name to the user.

## Promotion checklist (reference for the user, not auto-applied)

When the user is about to save a memory that looks generic, consider the tier ladder. This is a reference guide — the rule does NOT auto-promote.

| Memory type | Right tier | How to save |
|---|---|---|
| Project-specific fact ("our DB uses X column for Y") | Project CLAUDE.md (tier 2) | Edit CLAUDE.md, not auto-memory |
| Project-specific in-flight state ("PR #44 in progress") | Auto-memory (tier 1) | Save to project_*.md; auto-deletes when stale |
| User preference, project-specific | Auto-memory feedback_*.md (tier 1) | Save with **Why** + **How to apply** lines |
| User preference, generic / cross-project | Global preferences (tier 3) | Suggest `/add-preference` |
| Architectural decision affecting multiple files | Project CLAUDE.md "Architecture" section | Edit CLAUDE.md |
| Tech debt with location + recommendation | Project TECH_DEBT.md (tier 2) | Append entry |
| Active initiative spanning multiple PRs | Project ROADMAP.md (tier 2) | Edit ROADMAP.md, or suggest `/curate-memory` to regenerate |

## Relationship to other rules

- **`g-auto-capture.md`**: governs auto-capture of stack-specific best practices to `stacks/*.md`. That has its own dedicated trigger and PR mechanism. This rule covers auto-memory + planning only.
- **`never-auto-merge-config-repo.md`**: any change this rule proposes that would touch global config goes through PR per that rule. Never write to `jkwon-claude-config/` directly during inline curation.

## Tuning

These thresholds are conservative defaults. If you find this rule firing too often or not often enough, adjust:

- **Trigger 1 too aggressive** (false-positive duplicate detection on legitimately-different memories): tighten the grep to `-w` (whole-word) or require ≥3 matching key phrases.
- **Trigger 2 too quiet** (missing real overlaps): lower the >5-task threshold or add `gh issue list --author @me --state open` to the surfaced sources.
- **Trigger 3 too noisy** (the one-line reminder bothers you): change 60 days to 90, or remove the trigger entirely (Trigger 1 is the highest-value one).
