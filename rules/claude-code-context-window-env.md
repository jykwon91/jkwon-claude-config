---
description: Any hook that estimates context usage must read user-supplied config to distinguish 200K vs 1M context tiers. The model id Claude Code passes to hooks does not encode the tier.
---

# Claude Code Context Window — Model ID Doesn't Distinguish Tiers

Claude Code passes the bare model id (`claude-opus-4-7`) to hook payloads regardless of whether the user is on the 200K default or the 1M variant. The 1M tier is enabled via a beta API header, not via the model id string. There is no field in the PostToolUse hook payload (or even the statusline payload) that lets a hook tell the two tiers apart.

This matters when authoring any hook that estimates how much of the context window is used — token-budget warnings, auto-compaction nudges, "you should stop now" prompts. A naive model-id lookup will pick 200K for a user on 1M and fire false `CRITICAL` warnings as soon as their transcript exceeds ~70K tokens.

## The rule

Hooks that estimate context usage MUST accept a user-supplied override via env var, with this resolution order:

1. **`CLAUDE_CONTEXT_WINDOW` env var** (positive integer, e.g. `1000000`)
2. Model-id lookup table (best-effort, will be wrong for 1M users)
3. Conservative default (200K)

Users on 1M set the env var in `~/.claude/settings.json`:

```jsonc
{
  "env": {
    "CLAUDE_CONTEXT_WINDOW": "1000000"
  }
}
```

Document this in the hook's README. Verify it took effect by reading the sidecar metrics:

```bash
cat "$(node -e 'console.log(require("os").tmpdir())')"/claude-ctx-*.json
# look for "context_window": 1000000
```

## Concrete example

```js
function resolveContextWindow(modelId) {
  const envVal = parseInt(process.env.CLAUDE_CONTEXT_WINDOW, 10);
  if (Number.isFinite(envVal) && envVal > 0) return envVal;

  // Fallback: model-id lookup. Will be wrong for 1M users; that's why the env
  // var takes precedence.
  if (!modelId) return DEFAULT_WINDOW;
  return CONTEXT_WINDOWS[modelId] || DEFAULT_WINDOW;
}
```

See `hooks/lib/context.js` and PR #119.

## What does NOT work

- **Parsing the transcript JSONL for `context_window` field** — Claude Code doesn't record it
- **Heuristic on transcript size** ("if >300K bytes, assume 1M") — breaks for users on 200K with long sessions
- **Adding `claude-opus-4-7[1m]` to the lookup table** — that string never appears in any payload
- **Reading `data.model.display_name` for a `[1M]` suffix** — Claude Code passes the same display name for both tiers

The env var is the smallest fix that gives the user explicit control. Until Claude Code surfaces the tier in the hook payload, this is the best available primitive.
