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

3. **Check for other merged branches that belong to the current developer** that should be cleaned up:

```bash
ME=$(git config user.name)
git branch --merged main | grep -v '^\*\|main\|master' | while read b; do
  # Only delete if the branch's last commit is by the current developer
  AUTHOR=$(git log -1 --format='%an' "$b" 2>/dev/null)
  if [ "$AUTHOR" = "$ME" ]; then
    git branch -d "$b" && git push origin --delete "$b" 2>/dev/null
  fi
done
git remote prune origin
```

**Only delete branches you own.** Check the branch's last commit author against `git config user.name` before deleting. Never delete another developer's branches — even if they're merged. The branch owner is responsible for their own cleanup.

**If a merged branch belongs to another developer**, leave it. They will clean it up in their own session.

4. **Clean up worktrees** associated with the merged branch:

```bash
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
WORKTREE_BASE="$(dirname "$(git rev-parse --show-toplevel)")/${REPO_NAME}-worktrees"
# Remove any worktree that was on the merged branch
git worktree list --porcelain | grep -B2 "branch refs/heads/<branch-name>" | grep "^worktree " | cut -d' ' -f2 | while read wt; do
  git worktree remove "$wt" 2>/dev/null || git worktree remove --force "$wt" 2>/dev/null
done
git worktree prune
```
