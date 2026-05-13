---
description: Hooks must read user-supplied config from `~/.claude/settings.json` on disk — the `env` block in that file is NOT forwarded to hook subprocesses, so `process.env` cannot be used to read it. Required for any hook that needs to distinguish 200K vs 1M context tiers.
---

# Claude Code Context Window — Read settings.json From Disk, Not process.env

Claude Code passes the bare model id (`claude-opus-4-7`) to hook payloads regardless of whether the user is on the 200K default or the 1M variant. The 1M tier is enabled via a beta API header, not via the model id string. There is no field in the PostToolUse hook payload (or even the statusline payload) that lets a hook tell the two tiers apart.

This matters when authoring any hook that estimates how much of the context window is used — token-budget warnings, auto-compaction nudges, "you should stop now" prompts. A naive model-id lookup will pick 200K for a user on 1M and fire false `CRITICAL` warnings as soon as their transcript exceeds ~70K tokens.

## The trap — env vars don't reach hooks

The instinctive fix is to read `process.env.CLAUDE_CONTEXT_WINDOW` and tell the user to set it in their settings.json `env` block. **This does not work.** Claude Code forwards the `env` block to **Bash tool** subprocesses but **not to hook subprocesses**. A `printenv CLAUDE_CONTEXT_WINDOW` from a Bash tool call returns `1000000` correctly, but `process.env.CLAUDE_CONTEXT_WINDOW` from inside a `PostToolUse` hook is `undefined`. The env-based approach silently falls back to the 200K default and fires false `CRITICAL` warnings forever.

This was tried in PR #119 and rolled back in the follow-up — see the commit history of `hooks/lib/context.js`. Do not propose the env-var approach for any new hook.

## The rule

Hooks that estimate context usage MUST read `~/.claude/settings.json` from disk on every invocation, with this resolution order:

1. **`~/.claude/settings.json` → `env.CLAUDE_CONTEXT_WINDOW`** (positive integer, e.g. `1000000`)
2. Model-id lookup table (best-effort, will be wrong for 1M users)
3. Conservative default (200K)

Users on 1M still configure it in `~/.claude/settings.json`:

```jsonc
{
  "env": {
    "CLAUDE_CONTEXT_WINDOW": "1000000"
  }
}
```

The hook reaches in and reads that file. No restart needed — next tool call picks up the new value.

Document this in the hook's README. Verify it took effect by reading the sidecar metrics:

```bash
cat "$(node -e 'console.log(require("os").tmpdir())')"/claude-ctx-*.json
# look for "context_window": 1000000
```

## Concrete example

```js
const fs = require('fs');
const os = require('os');
const path = require('path');

function readContextWindowFromSettings() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const raw = cfg && cfg.env && cfg.env.CLAUDE_CONTEXT_WINDOW;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {
    // missing file, parse error, permission error — fall through
  }
  return null;
}

function resolveContextWindow(modelId) {
  const fromSettings = readContextWindowFromSettings();
  if (fromSettings) return fromSettings;

  if (!modelId) return DEFAULT_WINDOW;
  return CONTEXT_WINDOWS[modelId] || DEFAULT_WINDOW;
}
```

See `hooks/lib/context.js`.

## What does NOT work

- **`process.env.CLAUDE_CONTEXT_WINDOW`** — settings.json `env` isn't forwarded to hook subprocesses (see "The trap" above)
- **Parsing the transcript JSONL for `context_window` field** — Claude Code doesn't record it
- **Heuristic on transcript size** ("if >300K bytes, assume 1M") — breaks for users on 200K with long sessions
- **Adding `claude-opus-4-7[1m]` to the lookup table** — that string never appears in any payload
- **Reading `data.model.display_name` for a `[1M]` suffix** — Claude Code passes the same display name for both tiers

File-read from `~/.claude/settings.json` is the smallest fix that gives the user explicit control. Until Claude Code either forwards `env` to hook subprocesses or surfaces the tier in the hook payload, this is the best available primitive.

## Testing isolation

Because the hook reads the developer's real `~/.claude/settings.json` by default, hook unit tests MUST point the subprocess at an isolated `HOME` (and `USERPROFILE` on Windows) to avoid leaking the developer's actual context-window override into tests. See `hooks/test.js` `runHook()` for the pattern: `fs.mkdtempSync()` an empty home, optionally write a settings.json into it, pass via `spawnSync`'s `env`.
