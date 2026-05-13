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
3. Looks up the model's context window (1M for `claude-opus-4-7[1m]`, 200K for everything else; full table in `lib/context.js`).
4. Caches the result in `os.tmpdir()/claude-ctx-{session_id}.json` (sidecar reused by the statusline if you install it).
5. Emits `hookSpecificOutput.additionalContext` with the warning when thresholds trip.

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

Covers: low/high/critical usage, 1M window, debounce, path-traversal rejection in session IDs, statusline output, graceful degradation when no transcript exists.

## Tuning

If thresholds fire too often (or too late), edit the constants at the top of `context-monitor.js`:

- `WARNING_THRESHOLD` / `CRITICAL_THRESHOLD` — remaining-context percentages
- `STALE_SECONDS` — sidecar freshness window before re-reading the transcript
- `DEBOUNCE_CALLS` — minimum tool calls between same-severity warnings

To disable the monitor temporarily without uninstalling, remove the `context-monitor.js` entry from your `~/.claude/settings.json` `hooks.PostToolUse` block.

## Why this exists

Claude Code's statusline shows context % to the user, but the agent itself can't see it. It will happily start a 20-tool-call task at 95% context and crash mid-task. This hook surfaces the same number to the agent so it can wrap up cleanly. Pattern borrowed from [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)'s `gsd-context-monitor.js`.
