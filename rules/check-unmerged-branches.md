---
description: Check for unmerged feature branches at the start of each Claude session
---

# Check for Unmerged Branches

At the **start of every conversation** (before doing any other work), if the current directory is a git repository, silently run:

```bash
ME=$(git config user.name)
git branch --no-merged main 2>/dev/null
```

**If there are unmerged branches** (output is not empty), determine which belong to the current developer by checking the last commit author, then cross-reference with GitHub:

```bash
gh pr list --state open --json headRefName,number,title,author --jq '.[] | "  #\(.number) \(.headRefName) — \(.title) [\(.author.login)]"' 2>/dev/null
```

Separate branches into **yours** (last commit author matches `$ME` or PR author matches your GitHub login) and **others'**:

> **Your unmerged branches:**
> - `feature/add-export` — has open PR #123
> - `fix/date-parsing` — no PR yet
>
> Consider merging your existing work before starting new features.
>
> **Other developers' branches** (for awareness, not action):
> - `feature/auth-flow` — PR #125 by @teammate

**If you have no unmerged branches**, say nothing — even if other developers do. Don't mention that you checked.

**If not in a git repo**, say nothing.
