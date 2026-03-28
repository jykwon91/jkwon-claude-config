---
name: session-start
description: Run all session-start checks and show a status dashboard
allowed-tools: Read, Grep, Glob, Bash
---

Run a full session startup check and show a status dashboard:

1. **Unmerged branches:** `git branch --no-merged main` — cross-reference with `gh pr list --state open` to show which have PRs and which don't
2. **Config sync:** `git -C "$HOME/Documents/Git/jkwon-claude-config" pull -q` — report if anything was updated
3. **Dev servers:** Check if the project's dev servers are running by reading CLAUDE.md for port numbers and curling localhost
4. **Tech debt:** Read TECH_DEBT.md if it exists — summarize count by severity (Critical/High/Medium/Low)
5. **System events:** If the project has a system_events table or error log, check for recent errors since last session

Present results as a compact dashboard:

```
## Session Status

| Check | Status |
|-------|--------|
| Branches | 2 unmerged (1 has PR, 1 needs PR) |
| Config | Up to date |
| Servers | Backend running, Frontend not running |
| Tech debt | 0 Critical, 1 High, 3 Medium |
| Errors | 2 new errors since last session |
```

Then offer actionable next steps: "Want me to create PRs for unmerged branches? Start the frontend server? Look at the new errors?"
