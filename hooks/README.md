# Hooks

Node-based hooks that ship with this config repo. Auto-installed via `install.sh` (symlinked into `~/.claude/hooks/`).

## What's here

| File | Type | Auto-installed? |
|---|---|---|
| `context-monitor.js` | `PostToolUse` hook | Yes — registered via `settings.json` merge |
| `context-statusline.js` | `statusLine` command | No — opt-in (see below) |
| `check-pr-not-merged.js` | `PreToolUse:Bash(git push:*)` hook | Yes |
| `cleanup-after-merge.js` | `PostToolUse:Bash` hook | Yes |
| `validate-commit.js` | `PreToolUse:Bash(git commit*)` hook | Yes |
| `block-commit-to-main.js` | `PreToolUse:Bash(git commit*)` hook | Yes |
| `block-drop-database.js` | `PreToolUse:Bash` hook (self-gates on `DROP DATABASE`/`dropdb`) | Yes |
| `pr-quality-gate.js` | `PreToolUse:Bash` hook (self-gates on `gh pr create`; runs a headless Haiku review) | Yes |
| `read-injection-scanner.js` | `PostToolUse:Read` hook | Yes |
| `state-update-reminder.js` | `PostToolUse` hook (self-gates on Edit/Write/MultiEdit/NotebookEdit) | Yes |
| `lib/context.js` | Shared library (transcript -> tokens estimate, sidecar I/O) | n/a |
| `lib/git-cmd.js` | Shared library (token-walk git-subcommand classifier) | n/a |
| `test.js` | Cross-platform smoke tests | Run with `node hooks/test.js` |

## context-monitor

After every tool call, estimates how much of the model's context window is used and injects a warning into the conversation when remaining context drops below thresholds:

| Severity | Remaining | Agent behavior |
|---|---|---|
| WARNING | <= 35% | Wrap up current task; avoid starting new work |
| CRITICAL | <= 25% | Stop immediately; summarize state, surface uncommitted work, end turn |

Warnings are debounced (5 tool calls between same-severity repeats). Escalation from WARNING to CRITICAL bypasses debounce.

The hook is **silent at <35% used and on any failure**. It will never block a tool call.

### How it works

1. Reads `transcript_path` from the hook stdin payload.
2. Estimates tokens as `transcript_bytes / 3.5 + ~30K fixed overhead`.
3. Resolves the context window — reads `~/.claude/settings.json` for an explicit override, falls back to model-id lookup, then 200K default (see Configuration).
4. Caches the result in `os.tmpdir()/claude-ctx-{session_id}.json` (sidecar reused by the statusline if you install it).
5. Emits `hookSpecificOutput.additionalContext` with the warning when thresholds trip.

### Configuration: telling the hook about a 1M-context model

The PostToolUse hook payload doesn't include model info, and even where it does (statusline), Claude Code passes the bare model id (`claude-opus-4-7`) regardless of whether you're on the 200K default or the 1M variant — the 1M tier is enabled via a beta header, not the model id. So users on 1M MUST tell the hook explicitly via `~/.claude/settings.json`:

```jsonc
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CONTEXT_WINDOW": "1000000"
  }
}
```

The hook reads this file from disk on every invocation. **The env var is NOT inherited from `process.env`** — Claude Code forwards the `env` block to Bash *tool* subprocesses but not to *hook* subprocesses, so reading `process.env.CLAUDE_CONTEXT_WINDOW` from inside a hook always returns `undefined`. File I/O is the workaround.

No restart needed after editing settings.json — the next tool call will pick up the new value. Verify via the sidecar:

```bash
cat "$(node -e 'console.log(require("os").tmpdir())')"/claude-ctx-*.json | python -m json.tool
```

Look for `"context_window": 1000000`. If you see `200000` instead, recheck the JSON syntax — a parse error in settings.json silently falls back to the model lookup.

Resolution order:
1. `~/.claude/settings.json` → `env.CLAUDE_CONTEXT_WINDOW` (positive integer)
2. Model-id lookup table in `lib/context.js`
3. 200K default

## context-statusline (opt-in)

Shows the same numbers to the user via Claude Code's statusLine. **Not auto-installed** because most users have a personal statusline they don't want overwritten.

To enable, add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node $HOME/.claude/hooks/context-statusline.js"
  }
}
```

Output looks like: `ctx 23% (350K/1.0M) | MyFreeApps | Opus 4.7`. Indicators `!` at >=65% used and `!!` at >=75% used.

## validate-commit

PreToolUse hook on `Bash(git commit*)`. Blocks `git commit -m "..."` when the inline message doesn't match the expected shape; silent on anything else (interactive editor, `git status`, etc).

Validation:
- **Subject format**: `<type>(<scope>)?<!>?: <description>` — Conventional Commits, optional scope, optional `!` for breaking change.
- **Allowed types** (constant at the top of `validate-commit.js`): `feat, fix, docs, style, refactor, perf, test, build, ci, chore, rule, infra`. The last two extend the standard set; they appear in this repo's commit history. Edit `ALLOWED_TYPES` to extend.
- **Max subject length**: 100 chars. Edit `MAX_SUBJECT_LEN` to change.

Self-gates inside the hook body via `lib/git-cmd.js` so the existing `if: "Bash(git commit*)"` matcher is treated as documentation — the hook still works correctly even when the matcher misfires (see [`rules/claude-code-hook-if-field-unreliable.md`](../rules/claude-code-hook-if-field-unreliable.md)).

Handles all four `git commit` invocation forms:
- bare: `git commit -m "..."`
- `-C` path: `git -C /repo commit -m "..."`
- env-prefix: `GIT_AUTHOR_NAME=x git commit -m "..."`
- full-path: `/usr/bin/git commit -m "..."`

Handles HEREDOC-style messages (this repo's standard form):
```bash
git commit -m "$(cat <<'EOF'
feat(hooks): add validate-commit
...
EOF
)"
```

If the message is wrapped in an unrecognized command substitution (`$(some-other-script)`), the hook **allows** the commit rather than risk a false-positive block.

Output:
- Valid commit / non-commit command: `{}` (allow)
- Invalid format: `{"decision":"block","code":"CONVENTIONAL_COMMITS_VIOLATION","reason":"..."}`
- Subject too long: `{"decision":"block","code":"COMMIT_SUBJECT_TOO_LONG","reason":"..."}`

## block-commit-to-main

PreToolUse hook on `Bash(git commit*)`. Blocks `git commit` when the current branch is `main` or `master` to prevent accidental direct commits to the default branch.

Replaces the previous inline-bash hook in `settings.json` that relied solely on the `if: "Bash(git commit*)"` matcher to gate execution. Per [`rules/claude-code-hook-if-field-unreliable.md`](../rules/claude-code-hook-if-field-unreliable.md), the `if` field misfires under the Bash matcher and the inline-bash version was effectively blocking ALL Bash tool calls (including `git log`, `gh pr view`, `ls`) whenever the persistent CWD happened to be on main.

Self-gates inside the hook body via `lib/git-cmd.js` so the same `if` field is now treated as documentation only.

Branch detection uses `git symbolic-ref --short HEAD` (not `git rev-parse --abbrev-ref HEAD`) so the hook also blocks correctly on an empty repo, where `rev-parse` returns the literal string `HEAD` instead of the configured initial branch name.

Caveat: the hook subprocess inherits Claude Code's persistent CWD, not any `cd <dir> &&` target chained into the same Bash call (see [`rules/claude-code-hook-runs-in-persistent-cwd.md`](../rules/claude-code-hook-runs-in-persistent-cwd.md)). If you intend to commit in a worktree from a session whose persistent CWD is the main repo on main, split the `cd` into its own Bash call so the persistent CWD updates before the commit fires.

Output:
- Non-commit command / commit on feature branch / detached HEAD / no git repo: `{}` (allow)
- Commit on `main` or `master`: `{"decision":"block","reason":"Cannot commit directly to <branch>. Create a feature branch first."}`

## pr-quality-gate

PreToolUse hook on `Bash(gh pr create*)`. Before a PR is opened, reviews the current branch against `main` and **blocks** `gh pr create` if quality standards are not met (missing/meaningless E2E tests, ORM in services/routes, multiple components per `.tsx` file, `: any` typing, magic-string state values, nested JSX ternaries). Allows the command (`{}`) otherwise.

**Why it's a `command` hook, not an `agent` hook.** This logic used to be a `type: "agent"` hook in `settings.json` gated only by `if: "Bash(gh pr create*)"`. Per [`rules/claude-code-hook-if-field-unreliable.md`](../rules/claude-code-hook-if-field-unreliable.md) the `if` field does not reliably filter a Bash-matcher hook, and an `agent` hook has no body in which to self-gate — so it fired a ~120s Haiku review on **every** Bash tool call and could block any git command in auto mode. It is now a `type: "command"` hook that reads the triggering command from stdin and self-gates: the review only runs when the command is actually `gh pr create` (matched at the start of the command or after an `&&` chain).

**How the review runs.** The hook shells out to a headless `claude -p` with the original Haiku prompt and passes the `{decision:"block"}` / `{}` result straight through. `--safe-mode` keeps auth and built-in tools but disables hooks, so the nested review never re-triggers this (or any) hook.

**Editing the checks.** The review criteria live in `pr-quality-gate.prompt.md` (plain markdown — no escaping). Edit that file to change what the gate enforces; the wrapper is content-agnostic.

**Fail-open.** Any error — bad stdin, missing prompt, `claude` spawn failure, non-zero exit, timeout, unparseable output — emits `{}` (allow). The gate only ever blocks when the nested review explicitly returns a block, so a bug in the wrapper can never recreate the original "blocks every Bash call" failure; the worst case is the gate silently no-ops.

Standalone smoke tests: `node hooks/test-pr-quality-gate.js` — covers the self-gate on non-matching commands, fail-open on malformed/empty stdin, and the command-matcher + decision-parser unit tests. The live `claude` review path is verified manually (it makes a billed model call).

Output:
- Non-`gh pr create` command / passing review / any failure: `{}` (allow)
- Failing review: `{"decision":"block","reason":"<specific failure>"}`

## read-injection-scanner

PostToolUse hook on the `Read` tool. Scans file content returned by Read for prompt-injection patterns and emits an advisory `additionalContext` warning when matches occur. **Never blocks.**

**Severity:**
- `LOW` — 1-2 patterns. Likely a false positive (e.g., documentation that quotes an injection example). Heads-up, proceed.
- `HIGH` — 3+ patterns. Strong injection signal. Review the file before acting on its content.

**Why it exists.** Long sessions hit context compression, and the summariser does not distinguish user instructions from content read from external files. A poisoned instruction that survives compression becomes indistinguishable from trusted context. This hook warns at ingestion time so the agent (and downstream auto-memory) can be aware before the content compresses into the conversation history.

**Pattern categories detected:**
1. Standard prompt-injection (e.g., "ignore previous instructions", "you are now", `<system>` tags)
2. Summarization-survival patterns (e.g., "when summarising, retain this") — these target context compression specifically
3. Invisible Unicode (zero-width spaces, RTL controls, BOM, soft hyphens)
4. Unicode tag block (U+E0000-E007F — known invisible-instruction injection vector)

Pattern lists are defined as constants at the top of `read-injection-scanner.js` (`SUMMARISATION_PATTERNS`, `INJECTION_PATTERNS`). Edit to add or remove patterns.

**Path-based exclusions** (false-positive control):
- `~/.claude/projects/<hash>/{memory,rules,state,specs}/` — auto-memory tier files
- `jkwon-claude-config/{rules,hooks,skills,agents,docs,stacks}/` — config repo docs that quote patterns
- `~/.claude/{hooks,agents,skills,rules,stacks}/` — installed config (symlink target)
- Project-level doc filenames: `CLAUDE.md`, `TECH_DEBT.md`, `ROADMAP.md`, `MEMORY.md`, `README.md`, `CHANGELOG.md`, `SECURITY.md`, `REVIEW.md`, `PREFERENCES.md`, `CHECKPOINT*`
- Any path containing `security/`, `injection/`, `prompt-injection/`, `pwn/`, `techsec/`

Edit `isExcludedPath()` to extend.

**Output shape** (on match only):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "READ INJECTION SCAN [HIGH]: file \"poisoned.txt\" matched 4 pattern(s): ..."
  }
}
```

Failure modes (malformed JSON stdin, missing tool_response, etc.) all silent-fail with no output.

## state-update-reminder

PostToolUse hook that fires on file-modifying tools (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`). Reminds the agent to refresh the project's `STATE.md` when meaningful work has happened and the state file is stale. **Never blocks.**

See `rules/working-state.md` for the full STATE.md convention. Summary: write `~/.claude/projects/<project-hash>/STATE.md` to capture in-flight work state across sessions; this hook nudges you to keep it current.

**Behavior:**
- Silent when STATE.md doesn't exist for this project (effectively opt-in by file presence)
- Silent during the first 10 file modifications in the session (warm-up)
- Silent when STATE.md has been touched in this session
- Emits an advisory reminder on the first qualifying call after warm-up
- Debounces reminders to once per 20 modifications

**Project-hash resolution:** `cwd` with `\`, `/`, `:` all replaced with `-`. Matches Claude Code's `~/.claude/projects/` naming. Example: `C:\Users\me\Documents\Git\X` -> `C--Users-me-Documents-Git-X`.

**Sidecar:** `$TMPDIR/claude-state-reminder-<session_id>.json` tracks call count, last reminder, last-seen STATE mtime per session.

Tuning constants at top of `state-update-reminder.js`:
- `REMIND_AFTER_CALLS` — warm-up threshold (default 10)
- `DEBOUNCE_AFTER_REMIND` — calls between reminders (default 20)

## Running the tests

```bash
node hooks/test.js
```

Covers: low/high/critical usage, 1M window, debounce, path-traversal rejection in session IDs, statusline output, graceful degradation when no transcript exists, settings.json override (valid + invalid + missing file), validate-commit (valid + invalid + HEREDOC + env-prefix + -C path + full-path + malformed stdin), git-cmd unit tests, read-injection-scanner (clean + LOW + HIGH + invisible Unicode + path exclusions + structured tool_response + malformed stdin), state-update-reminder (no STATE / warm-up / fires / touched-this-session / debounce / past-debounce / path-traversal / malformed stdin).

## Tuning

If thresholds fire too often (or too late), edit the constants at the top of `context-monitor.js`:

- `WARNING_THRESHOLD` / `CRITICAL_THRESHOLD` — remaining-context percentages
- `STALE_SECONDS` — sidecar freshness window before re-reading the transcript
- `DEBOUNCE_CALLS` — minimum tool calls between same-severity warnings

To disable the monitor temporarily without uninstalling, remove the `context-monitor.js` entry from your `~/.claude/settings.json` `hooks.PostToolUse` block.

## Why this exists

Claude Code's statusline shows context % to the user, but the agent itself can't see it. It will happily start a 20-tool-call task at 95% context and crash mid-task. This hook surfaces the same number to the agent so it can wrap up cleanly. Pattern borrowed from [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)'s `gsd-context-monitor.js`.
