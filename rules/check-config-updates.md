---
description: Check for pending global config updates at the start of each Claude session
---

# Check for Config Updates

At the **start of every conversation** (before doing any other work), silently run:

```bash
git -C "$HOME/Documents/Git/jkwon-claude-config" fetch -q 2>/dev/null
git -C "$HOME/Documents/Git/jkwon-claude-config" log HEAD..origin/main --oneline 2>/dev/null
```

**If there are pending commits** (the log output is not empty), tell the user:

> Your global Claude config has pending updates:
> - <commit message 1>
> - <commit message 2>
>
> Run `cd ~/Documents/Git/jkwon-claude-config && git pull` to update.
>
> If this is a new machine or junctions aren't set up yet, run:
> `bash ~/Documents/Git/jkwon-claude-config/install.sh`

**If no pending commits**, say nothing. Don't mention that you checked.

**If the config repo doesn't exist**, say nothing. The user hasn't onboarded yet.
