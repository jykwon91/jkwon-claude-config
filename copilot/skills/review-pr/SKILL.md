---
name: review-pr
description: "Review a pull request for correctness, security, and quality. Use when asked to review a specific PR by number."
---

Review pull request #$ARGUMENTS:

1. Fetch the diff: `gh pr diff $ARGUMENTS`
2. Read the PR description: `gh pr view $ARGUMENTS`
3. Categorize changed files (frontend vs backend vs auth/security)
4. Launch review agents based on what changed:
   - **Always:** `g-review-code` on all changed files
   - **If frontend files changed:** `g-review-frontend`
   - **If backend files changed:** `g-review-backend`
   - **If auth/security files changed:** `g-audit-security`
5. Consolidate findings and post a review comment:
   `gh pr review $ARGUMENTS --comment --body "<your review>"`
