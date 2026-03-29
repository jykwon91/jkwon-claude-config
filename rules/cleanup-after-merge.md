---
description: Clean up local branches after PRs are merged — no hanging branches
---

# Clean Up After Merge

After every `gh pr merge` or after confirming a PR has been merged:

1. **Delete the local branch** that was just merged:

```bash
git checkout main && git pull && git branch -d <branch-name>
```

2. **Prune stale remote tracking branches**:

```bash
git remote prune origin
```

3. **Check for other merged branches** that should be cleaned up:

```bash
git branch --merged main | grep -v '^\*\|main\|master'
```

If any exist, delete them all:

```bash
git branch --merged main | grep -v '^\*\|main\|master' | xargs git branch -d
```

**Never leave merged branches hanging.** If a branch's PR is merged, the branch should be deleted immediately — not left for a future cleanup session.
