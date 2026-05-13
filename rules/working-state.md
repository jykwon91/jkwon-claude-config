# Working State

When a piece of non-trivial work spans multiple sessions, capture the current state in a `STATE.md` snapshot so the next session can pick it up cold without re-deriving intent from the conversation context.

## Where it lives

`~/.claude/projects/<project-hash>/STATE.md` — one file per project, in the auto-memory tier (alongside `memory/MEMORY.md`).

The project hash matches Claude Code's `~/.claude/projects/` directory naming — `C:\Users\me\Documents\Git\X` becomes `C--Users-me-Documents-Git-X`, `/Users/me/Documents/Git/X` becomes `-Users-me-Documents-Git-X`.

Why the auto-memory dir and not the project root:

- **Private** — never accidentally committed to a public repo (per `rules/non-code-public-repo-guardrails.md`)
- **Persistent** — survives session resets and `/clear`
- **Auto-discoverable** — future sessions find it without per-project config
- **One canonical location** — no `.gitignore` discipline required

## When to write one

- Work expected to span >1 session (multi-PR feature, drawn-out debugging, paused for >30 min)
- Before `/clear`-ing the conversation while work is in flight
- After hitting a meaningful blocker and you need to leave
- Before context-window pressure forces a wrap-up

**Don't** write STATE.md for one-off fixes, single-PR work, or exploratory sessions where you don't know where you'll land. It's a tool for spanning sessions, not for documenting any work.

## Format

```markdown
# Working State

**Last updated:** YYYY-MM-DD HH:MM — short context tag

## Now
<one paragraph: what I'm working on right this moment, why>

## Next
- <specific next steps in order>

## Blockers
- <if any; "none" otherwise>

## Pick-up signal
<how a future session verifies this state is still valid before acting>
```

The **Pick-up signal** is critical — it's what lets the next session detect when STATE.md is stale or out of sync with reality. Examples:

- "Check `git log`: the last commit should be `abc123 'feat(x): scaffold'`. If it's not, the branch has advanced since this state was written and these notes are stale."
- "PR #142 should still be open and awaiting review. If it's merged or closed, this state is post-shipped and should be deleted."
- "`apps/x/backend/foo.py` line 42 should still contain the placeholder `TODO: state-driven`. If absent, work has already advanced."

A STATE.md without a pick-up signal is harder to trust on resumption.

## Lifecycle

- **Create** when picking up multi-session work; commit-discipline doesn't apply (it's never in the repo)
- **Update** whenever the "Now" or "Next" sections become stale — same session is fine; sessions later are essential
- **Delete** when:
  - The work ships (delete as part of the merge ceremony — STATE.md outlives its usefulness once the PR is in)
  - It hasn't been touched in >7 days (treat as dead context; the next session should not trust it as authoritative without verifying via the pick-up signal)

## Hook integration

The `state-update-reminder.js` hook fires on `Edit` / `Write` / `MultiEdit` and emits an advisory `additionalContext` reminder when:

- STATE.md exists for this project
- The session has done ≥10 file modifications
- STATE.md has not been touched in this session

Reminder is debounced to once per ~20 tool calls after firing. Never blocks. Silent when STATE.md doesn't exist (so the hook is effectively opt-in by file presence).

## Relationship to other tiers

| Tier | What | Lifetime |
|---|---|---|
| Auto-memory (`memory/*.md`) | Durable user / feedback / project / reference facts | Persistent across sessions |
| **STATE.md** | **Current in-flight work snapshot** | **Transient; delete on completion or staleness** |
| Project ROADMAP.md | Active initiatives at multi-PR grain | Updated by `g-pipeline-curate-memory` |
| Project TECH_DEBT.md | Ranked backlog | Updated by `g-tech-debt-scan` |
| Project CLAUDE.md | Repo conventions, architecture, commands | Stable |
| Global preferences (`jkwon-claude-config/global-preferences.md`) | Cross-project user preferences | Stable |

STATE describes "where I am right now in the work" — finer-grained than ROADMAP. ROADMAP is "what big things are happening"; STATE is "what step am I on inside one of those things". When STATE work completes, the relevant info usually graduates either to ROADMAP (if it's a milestone worth tracking) or to auto-memory (if it's a durable learning).

## What this rule does NOT require

- Writing STATE.md for every piece of work — opt-in by file presence
- Any in-project file convention — STATE lives in `~/.claude/projects/<hash>/`, not the repo
- A `/save-state` skill — write the file with the Write tool when you need to
- Integration with `g-build-feature` or any other agent — that's a separate concern. STATE is for the human/operator and the next agent session that reads it cold
