# Hooks

Node-based hooks that ship with this config repo. Auto-installed via `install.sh` (symlinked into `~/.claude/hooks/`).

## What's here

| File | Type | Auto-installed? |
|---|---|---|
| `context-monitor.js` | `PostToolUse` hook | Yes — registered via `settings.json` merge |
| `context-statusline.js` | `statusLine` command | No — opt-in (see below) |
| `lib/context.js` | Shared library (transcript -> tokens estimate, sidecar I/O) | n/a |
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

## Running the tests

```bash
node hooks/test.js
```

Covers: low/high/critical usage, 1M window, debounce, path-traversal rejection in session IDs, statusline output, graceful degradation when no transcript exists, settings.json override (valid + invalid + missing file).

## Tuning

If thresholds fire too often (or too late), edit the constants at the top of `context-monitor.js`:

- `WARNING_THRESHOLD` / `CRITICAL_THRESHOLD` — remaining-context percentages
- `STALE_SECONDS` — sidecar freshness window before re-reading the transcript
- `DEBOUNCE_CALLS` — minimum tool calls between same-severity warnings

To disable the monitor temporarily without uninstalling, remove the `context-monitor.js` entry from your `~/.claude/settings.json` `hooks.PostToolUse` block.

## Why this exists

Claude Code's statusline shows context % to the user, but the agent itself can't see it. It will happily start a 20-tool-call task at 95% context and crash mid-task. This hook surfaces the same number to the agent so it can wrap up cleanly. Pattern borrowed from [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)'s `gsd-context-monitor.js`.
