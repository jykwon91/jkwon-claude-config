---
description: Check for pending global config updates at the start of each Claude session
---

# Check for Config Updates

At the **start of every conversation** (before doing any other work), silently run:

```bash
git -C "$HOME/Documents/Git/jkwon-claude-config" fetch -q 2>/dev/null
git -C "$HOME/Documents/Git/jkwon-claude-config" log HEAD..origin/main --oneline 2>/dev/null
```

**If there are pending commits** (the log output is not empty), also check if junctions are set up:

```bash
[ -L "$HOME/.claude/agents" ] || powershell -Command "(Get-Item '$HOME\.claude\agents').Attributes -band [IO.FileAttributes]::ReparsePoint" 2>/dev/null
```

Then tell the user:

> Your global Claude config has pending updates:
> - <commit message 1>
> - <commit message 2>
>
> Run `cd ~/Documents/Git/jkwon-claude-config && git pull` to update.

If junctions are NOT set up (the check above returns false/empty), also add:

> First-time setup detected. Run `bash ~/Documents/Git/jkwon-claude-config/install.sh` to set up automatic syncing.

**If no pending commits**, say nothing. Don't mention that you checked.

**If the config repo doesn't exist**, say nothing. The user hasn't onboarded yet.
