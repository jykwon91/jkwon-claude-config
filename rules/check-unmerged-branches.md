---
description: Check for unmerged feature branches at the start of each Claude session
---

# Check for Unmerged Branches

At the **start of every conversation** (before doing any other work), if the current directory is a git repository, silently run:

```bash
git branch --no-merged main 2>/dev/null
```

**If there are unmerged branches** (output is not empty), cross-reference with GitHub:

```bash
gh pr list --state open --json headRefName,number,title --jq '.[] | "  #\(.number) \(.headRefName) — \(.title)"' 2>/dev/null
```

Then tell the user:

> You have unmerged branches:
> - `branch-name` — has open PR #123
> - `other-branch` — no PR yet
>
> Consider merging existing work before starting new features.

**If no unmerged branches**, say nothing. Don't mention that you checked.

**If not in a git repo**, say nothing.
