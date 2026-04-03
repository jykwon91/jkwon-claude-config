---
name: cleanup-branches
description: "Find and delete local branches that have already been merged to main"
---

Clean up local branches that have been merged:

1. Find merged branches: `git branch --merged main | grep -v '^\*\|main\|master'`
2. Cross-reference with GitHub: `gh pr list --state merged --json headRefName --jq '.[].headRefName'`
3. Show the user a list of branches that are safe to delete (merged both locally and on GitHub)
4. Ask for confirmation before deleting
5. Delete confirmed branches: `git branch -d <branch>` for each
6. Prune remote tracking branches: `git remote prune origin`
7. Report what was cleaned up
