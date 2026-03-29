---
description: Clean up local branches after PRs are merged — no hanging branches
---

# Clean Up After Merge

After every `gh pr merge` or after confirming a PR has been merged:

1. **Delete the local and remote branch** that was just merged:

```bash
git checkout main && git pull && git branch -d <branch-name> && git push origin --delete <branch-name>
```

2. **Prune stale remote tracking branches**:

```bash
git remote prune origin
```

3. **Check for other merged branches** that should be cleaned up:

```bash
git branch --merged main | grep -v '^\*\|main\|master'
```

If any exist, delete them all (local and remote):

```bash
git branch --merged main | grep -v '^\*\|main\|master' | while read b; do git branch -d "$b" && git push origin --delete "$b" 2>/dev/null; done
git remote prune origin
```

**Never leave merged branches hanging — locally or on GitHub.** If a branch's PR is merged, both the local and remote branch should be deleted immediately.
