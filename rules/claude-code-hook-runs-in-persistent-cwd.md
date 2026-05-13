---
description: Claude Code PreToolUse hooks run in the session's persistent CWD at hook-fire time — NOT in whatever directory a `cd` chained into the bash command would set. A `cd <worktree> && git commit` will trip a CWD-sensitive hook (e.g. "no committing to main") based on the OUTER CWD, before the `cd` runs. Split the `cd` into a dedicated Bash call so the next call's persistent CWD is correct.
---

# Claude Code Hooks Run in Persistent CWD, Not Chained `cd` Target

PreToolUse hooks fire before the bash command runs. Their subprocess inherits the Claude Code session's **persistent CWD** — the directory carried across Bash tool calls per the system prompt: "The working directory persists between commands, but shell state does not."

If your bash command starts with `cd <somewhere> && <real-command>`, the `cd` has NOT executed when the hook fires. Any hook that reads CWD-dependent state — current git branch, git status, the contents of `pwd`, the resolution of relative paths — sees the OUTER directory, not the chained-`cd` target.

## The failure mode

Observed in this repo on 2026-05-13 while opening PR #128 from a worktree:

1. Session's persistent CWD was the **main repo** (`~/Documents/Git/jkwon-claude-config`) on branch `main`.
2. Wanted to commit on a feature branch in a worktree at `~/Documents/Git/jkwon-claude-config-worktrees/stacked-pr-rule`.
3. Ran: `cd <worktree> && git add ... && git commit -m "..."`.
4. The `Bash(git commit*)` PreToolUse hook fired with CWD = main repo's directory, ran `git rev-parse --abbrev-ref HEAD`, got `main`, and emitted `{"decision":"block","reason":"Cannot commit directly to main..."}` — even though the actual commit was destined for the worktree's feature branch.

The block was technically correct given what the hook could see — the main repo IS on `main`, and a future call with this CWD WOULD commit to main. But the user's intent was a worktree commit, and the chained `cd` was supposed to redirect it.

## The fix

Split the directory change into its own Bash call so the persistent CWD updates **before** the hook-sensitive call runs:

```bash
# Call 1: update persistent CWD
cd ~/Documents/Git/jkwon-claude-config-worktrees/stacked-pr-rule

# Call 2: hook fires here with the new CWD; sees the feature branch; allows
git add rules/foo.md && git commit -m "..."
```

The first call has no CWD-sensitive command, so the hook either doesn't fire (no `git commit` match) or fires harmlessly. The second call inherits the updated persistent CWD, and the hook sees the right branch.

## Why `git -C <dir> commit` doesn't help

You might think `git -C <worktree> commit` would sidestep this by passing the path to git explicitly. It doesn't — the hook still runs `git rev-parse --abbrev-ref HEAD` in the **hook subprocess's** CWD, which is the persistent CWD, not the `-C` target. The hook's git-state query is independent of what flags the actual bash command is going to pass.

The same logic applies to `--git-dir=`, `--work-tree=`, and similar overrides — they affect the user's bash command, not the hook subprocess.

## Other hooks this affects

Any PreToolUse hook that runs CWD-sensitive commands on the same payload class:

- **`Bash(git push:*)`** — `gh pr view <branch>` requires a git repo; runs in hook CWD.
- **`Bash(git commit*)`** — branch check, as above.
- **`Bash(gh pr create*)`** — `git diff main...HEAD`, repo state checks.
- Any hook that reads files via relative paths or uses `process.cwd()` in Node.

## When you spot it

Symptoms: a hook blocks a command that you know is correct for the worktree/branch you're targeting, with a message referencing state from a different directory. Most often: "no committing to main" when you're on a feature branch in a worktree.

Recognition signal: the message comes back too fast (no `cd` could have executed), and the state it cites matches the persistent CWD (which you can confirm with a plain `pwd` Bash call).

## Auto-capture trigger

About to issue `cd <X> && <CWD-sensitive command>` where `<CWD-sensitive command>` is `git commit`, `git push`, `gh pr create`, or anything else likely to trigger a CWD-reading PreToolUse hook — split the `cd` into a separate Bash call first. Same advice when chaining `pushd`/`popd`, environment variables that change git/gh behavior, or anything else the hook subprocess won't inherit.
