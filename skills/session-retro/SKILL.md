---
name: session-retro
description: Run a session retrospective — mine recent work for reusable patterns and open PRs against the global Claude config (agents, skills, MCPs, preferences, hooks, stack guides). Use at the end of a meaningful session to codify learnings instead of losing them.
argument-hint: "[timeframe — e.g. 'today', 'this week', '7d', or a commit SHA]"
---

The user wants to run a retrospective on the recent session and turn discovered patterns into PRs on the shared `jkwon-claude-config` repo.

## Steps

1. Invoke the `g-pipeline-retro` agent and forward `$ARGUMENTS` as the `since=` timeframe.
   - If `$ARGUMENTS` is empty, let the pipeline use its default ("since the last config-repo commit by current user").
2. The pipeline will:
   - Mine recent commits and merged PRs across all registered projects via `g-session-retro`
   - Triage each discovered pattern (auto-PR / user-confirm / drop)
   - Open one PR per accepted proposal against `jkwon-claude-config`
3. When the pipeline finishes, return its summary table to the user — counts by outcome, list of opened PR URLs, and any surfaced conflicts.

## Notes

- This skill is the user-invocable entry point. All real work happens in `g-pipeline-retro` and its delegated `g-session-retro` agent — do not duplicate logic here.
- The pipeline writes to a worktree of the config repo, never the main checkout, so it is safe to run alongside other active sessions.
- Stack-guide proposals are deduped against PRs that `g-auto-capture` may have already opened inline during the session.
