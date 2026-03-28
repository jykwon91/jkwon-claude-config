---
name: review-pr
description: Review a pull request for correctness, security, and quality
argument-hint: "[pr-number]"
allowed-tools: Read, Grep, Glob, Bash
---

Review pull request #$ARGUMENTS:

1. Fetch the diff: `gh pr diff $ARGUMENTS`
2. Read the PR description: `gh pr view $ARGUMENTS`
3. Categorize changed files:
   - Frontend files: `.tsx`, `.ts`, `.jsx`, `.js`, `.css` in frontend/client/src directories
   - Backend files: `.py`, `.go`, `.rs`, `.java` in backend/server/api directories
   - Auth/security files: anything touching auth, tokens, user data, API endpoints, permissions
4. Launch review agents **in parallel** based on what changed:
   - **Always:** `g-review-code` on all changed files
   - **If frontend files changed:** `g-review-frontend`
   - **If backend files changed:** `g-review-backend`
   - **If auth/security files changed:** `g-audit-security`
5. Consolidate findings from all agents into a single review
6. Post the review: `gh pr review $ARGUMENTS --comment --body "<your review>"`
