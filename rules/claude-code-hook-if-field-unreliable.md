---
description: When authoring Claude Code hooks, do not rely on the inner `if` field to filter Bash matchers. Self-gate inside the hook body by reading `tool_input.command` from stdin.
---

# Claude Code Hook `if` Field Is Unreliable on Bash Matchers

In current Claude Code, the inner `if` field on `PreToolUse` / `PostToolUse` hooks with a `Bash` matcher does **not** reliably filter the inner command pattern. The outer matcher (`Bash`) fires on every Bash tool call, and the inner command runs regardless of `if`. Patterns using `:*` suffix (e.g. `"Bash(gh pr merge:*)"`) appear especially broken; `*` suffix may also misfire under conditions that haven't been fully characterized.

This is a real-incident pattern. On 2026-05-12, a destructive cleanup hook gated `"if": "Bash(gh pr merge:*)"` fired on a `git push -u`, destroying an open PR (branch deleted, PR auto-closed). The `if` field was not gating as intended.

## The rule

When you write any hook with side effects beyond emitting `{}`, **self-gate inside the hook body** rather than relying on the `if` field. Read the tool input from stdin and check the command yourself.

## Concrete shape — Node

```js
#!/usr/bin/env node
const { execSync } = require('child_process');

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const c of process.stdin) buf += c;
  return buf;
}

(async () => {
  let data;
  try { data = JSON.parse((await readStdin()) || '{}'); }
  catch (e) { process.stdout.write('{}'); return; }

  const cmd = (data?.tool_input?.command) || '';

  // Self-gate: only act when the command is actually what we expect.
  // Use `(?=\s|$)` after the command name, NOT `\b` — `\b` matches a hyphen
  // (e.g. `gh pr merge-with-suffix` would slip through).
  if (!/^\s*gh\s+pr\s+merge(?=\s|$)/.test(cmd)) {
    process.stdout.write('{}');
    return;
  }

  // ... do the actual work ...
})().catch(() => process.stdout.write('{}'));
```

## Concrete shape — bash (inline in settings.json)

```bash
bash -c '
INPUT="$(cat)"
CMD="$(echo "$INPUT" | py -c "import sys,json; print(json.load(sys.stdin).get(\"tool_input\",{}).get(\"command\",\"\"))" 2>/dev/null)"
case "$CMD" in
  "gh pr merge"*) ;;  # proceed
  *) echo "{}"; exit 0 ;;
esac
# ... do the actual work ...
'
```

## What this means for hook authors

- **Treat the `if` field as documentation only**, not as a gate. The hook MUST be safe to run on every Bash call.
- **Chain destructive operations with `&&`** so a failed earlier step short-circuits before destructive later steps. The earlier session's destructive hook had `git checkout main && git pull && git branch -d && git push origin --delete` — but the JS port that replaced it had dropped the `&&` semantics, so `push origin --delete` ran even after `branch -d` had failed.
- **Use `(?=\s|$)` not `\b`** when matching command names in regex. `\b` matches a hyphen (`gh pr merge-with-suffix` matches `gh pr merge` with `\b`), which is rarely what you want.
- **Test the gate explicitly** — write a smoke test that runs the hook with a non-matching command and asserts it produces `{}` and no side effects.

## When this might be fixed upstream

If a future Claude Code version honors `if` reliably, this rule remains a useful belt-and-suspenders pattern. Self-gating in the body costs ~5 lines and protects against both `if`-field bugs and future matcher-regex changes. Leave the gates in.

## Concrete examples in this repo

- `hooks/cleanup-after-merge.js` — Node self-gating
- `~/.claude/scripts/cleanup-after-merge.sh` — bash self-gating (user-local script that pre-dated the global fix)
- PR #118 — replaced the destructive inline-bash version with the self-gating Node version
