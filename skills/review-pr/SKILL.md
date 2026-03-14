---
name: review-pr
description: Review a pull request for correctness, security, and quality
argument-hint: "[pr-number]"
allowed-tools: Read, Grep, Glob, Bash
---

Review pull request #$ARGUMENTS:

1. Fetch the diff: `gh pr diff $ARGUMENTS`
2. Read the PR description: `gh pr view $ARGUMENTS`
3. Use the `code-reviewer` agent to review changed files for bugs and quality
4. Use the `security-auditor` agent if changes touch auth, user data, or API endpoints
5. Summarize findings and post a review comment:
   `gh pr review $ARGUMENTS --comment --body "<your review>"`
