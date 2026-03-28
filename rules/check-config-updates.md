---
description: Check for pending global config updates at the start of each Claude session
---

# Check for Config Updates

At the **start of every conversation** (before doing any other work), silently run:

```bash
git -C "$HOME/Documents/Git/jkwon-claude-config" pull -q 2>/dev/null
```

Then check if anything was updated:

```bash
git -C "$HOME/Documents/Git/jkwon-claude-config" log --oneline -5 2>/dev/null
```

**If the pull brought new commits** (compare before/after), check if junctions are set up:

```bash
[ -L "$HOME/.claude/agents" ] || powershell -Command "(Get-Item '$HOME\.claude\agents').Attributes -band [IO.FileAttributes]::ReparsePoint" 2>/dev/null
```

If junctions are set up, tell the user:

> Global Claude config updated automatically:
> - <commit message 1>
> - <commit message 2>

If junctions are NOT set up (the check above returns false/empty), tell the user:

> First-time setup detected. Run `bash ~/Documents/Git/jkwon-claude-config/install.sh` to set up automatic syncing.

**If no new commits were pulled**, say nothing. Don't mention that you checked.

**If the config repo doesn't exist**, say nothing. The user hasn't onboarded yet.
