---
description: Before saving a memory, automatically check for duplicates and tier-misplacement. Before starting a substantial plan, check for in-flight overlap. Designed for low intrusiveness — narrow triggers, conservative thresholds.
---

# Auto-Memory-Curation

The `g-memory-curator` agent and `/curate-memory` skill handle full audits. This rule handles **inline checks** that fire automatically. Triggers are deliberately narrow — false positives are intrusive, so the bar to fire is high.

## Trigger 1 — Before saving a memory (always-on)

When about to write a new memory file (any file under `~/.claude/projects/<project-hash>/memory/`):

1. **Grep the SAME directory** for the key phrase/rule/fact: `grep -ril "<key phrase>" ~/.claude/projects/<project>/memory/`
2. **If a duplicate exists in the same directory**: do NOT create a new file. Either:
   - Existing is correct + complete — skip the save, tell the user "already captured in `<existing>.md`"
   - Existing is partially right — UPDATE it (don't create a new one)
   - Existing is wrong/stale — UPDATE with a `**Updated:** <date>` line
3. **If saving a feedback memory using "always" / "never" / "for all projects"** — surface to user: "this looks generic — `/add-preference` instead?" Let user decide.

Specifically:
- Do NOT cross-tier check unless user explicitly opts in (too noisy)
- Do NOT block on near-duplicates — only EXACT key-phrase matches in the same directory
- Do NOT mention this rule's name when surfacing — just say "looks like overlap with X, want to update there?"

## Trigger 2 — Before starting a substantial plan (high bar)

Fires only when ALL true:
- About to create >5 tasks via TaskCreate, OR enter Plan mode, OR write a multi-section design doc
- Plan touches a project (not config-repo or scratch)
- Session has been active >5 minutes

When fired:

1. **Check open PRs by current user**: `gh pr list --author @me --state open --json number,title,headRefName`
2. If any open PR's title overlaps with planned work (substring match on the main noun), surface to user with title + URL: "I see open PR #X (title). Continue that or open something new?"
3. **If `ROADMAP.md` exists in project root**, read it and grep for the planned work's main noun. Surface a "previously deferred / completed / in flight" note ONLY if grep returns a hit.

Do NOT:
- Read every memory file at plan-start (too noisy/slow)
- Block planning if no overlap found — proceed silently
- Fire on quick fixes, single-file edits, bug investigations

## Trigger 3 — At session start (silent)

ONLY when:
- It's been >60 days since `~/.claude/projects/<project>/memory/MEMORY.md` was last modified, AND
- User is about to do write/plan work in that project

Action: add ONE line to first response: "(memory hasn't been curated in N days — `/curate-memory` when convenient)"

Do not fire on read-only work (questions, reviews).

## What NOT to do

- Do NOT run full `g-pipeline-curate-memory` inline — that's `/curate-memory` only
- Do NOT block memory saves on minor staleness — if mostly current, save it
- Do NOT silently drop information — if skipping due to duplicate, TELL the user where the existing entry is
- Do NOT auto-promote between tiers — only SUGGEST
- Do NOT mention this rule by name

## Promotion checklist (reference for the user, not auto-applied)

| Memory type | Right tier | How to save |
|---|---|---|
| Project-specific fact | Project CLAUDE.md (tier 2) | Edit CLAUDE.md, not auto-memory |
| Project-specific in-flight state | Auto-memory (tier 1) | Save to `project_*.md`; auto-deletes when stale |
| User preference, project-specific | Auto-memory `feedback_*.md` (tier 1) | Save with **Why** + **How to apply** lines |
| User preference, generic / cross-project | Global preferences (tier 3) | Suggest `/add-preference` |
| Architectural decision (multi-file) | Project CLAUDE.md "Architecture" section | Edit CLAUDE.md |
| Tech debt with location + recommendation | Project TECH_DEBT.md (tier 2) | Append entry |
| Active initiative spanning multiple PRs | Project ROADMAP.md (tier 2) | Edit ROADMAP.md or `/curate-memory` |
