---
description: `git push -u` on a fresh branch followed by ANY other Bash call can trigger a PostToolUse cleanup hook to delete the remote branch and auto-close the PR. Push from main with explicit refspec, no `-u`, when working around an unfixed cleanup hook.
---

# `git push -u` + PostToolUse Cleanup = Branch Destruction Hazard

Specific failure mode that destroyed PR #116 in this repo on 2026-05-12.

## The pattern

1. You create a feature branch and make commits
2. You run `git push -u origin feature/...` — this sets the branch's upstream to `origin/feature/...`
3. Any subsequent Bash call fires the PostToolUse Bash matcher
4. A cleanup hook chain runs: `git checkout main && git pull && git branch -d <branch> && git push origin --delete <branch>`
5. `git branch -d` succeeds **because the branch is merged with its upstream** (you just pushed; local matches remote). This is a separate concept from "merged to main".
6. `git push origin --delete` then runs, removing the remote branch
7. GitHub auto-closes any open PR using that branch as head

## Why `branch -d` succeeds when you don't expect it to

`git branch -d` doc:

> The branch must be **fully merged in its upstream branch**, or in HEAD if no upstream was set with `--track` or `--set-upstream-to`.

So with upstream set, `branch -d` only requires "matches upstream" — not "merged to main". After `git push -u`, the upstream is the just-pushed remote branch, which trivially matches.

## Workarounds

**Best (long-term):** Fix the cleanup hook to self-gate on `tool_input.command` (see `claude-code-hook-if-field-unreliable.md`). The fix in PR #118 removes the hazard entirely.

**While stuck with an unfixed cleanup hook:**

1. **Push from main with an explicit refspec, no `-u`:**
   ```bash
   git checkout main          # do this BEFORE the destructive hook can fire
   git push origin feature/foo:feature/foo
   gh pr create --head feature/foo --base main --title "..." --body "..."
   ```
   The cleanup hook's `git checkout main` is a no-op (already on main), `branch -d` is gated by `[ "$BRANCH" != "main" ]` and won't fire. Branch stays alive on remote.

2. **Unset upstream after creating the branch:**
   ```bash
   git checkout -b feature/foo origin/main   # tracks origin/main by default
   git branch --unset-upstream
   ```
   Without upstream, `branch -d` falls back to "merged to HEAD" semantics, which won't match a new commit ahead of main.

3. **Recover destroyed work via reflog:**
   ```bash
   git reflog --all | grep <commit-message-snippet>
   git branch <branch-name> <commit-sha>
   ```
   Local commits survive even after `branch -d` because reflog keeps them for 30+ days. Recreate the branch ref from the reflog entry.

## What this means for hook authors

A cleanup hook that does `git push origin --delete` after `git branch -d` is **only safe if `branch -d` reflects "merged to main", not "merged to upstream"**. The simplest fix: chain the steps with `&&` AND explicitly checkout main FIRST so `branch -d`'s HEAD check is against main, not upstream:

```bash
# Wrong — branch -d uses upstream when set, succeeds against fresh push
git branch -d "$BRANCH" && git push origin --delete "$BRANCH"

# Better — also require it's merged to main, not just to upstream
if git merge-base --is-ancestor "$BRANCH" main; then
  git branch -d "$BRANCH" && git push origin --delete "$BRANCH"
fi
```

Or self-gate the entire cleanup to fire only on `gh pr merge` (which is the only context where the branch is genuinely merged).
