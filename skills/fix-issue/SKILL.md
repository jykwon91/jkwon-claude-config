---
name: fix-issue
description: End-to-end workflow to investigate and fix a GitHub issue
argument-hint: "[issue-number]"
allowed-tools: Read, Edit, Grep, Glob, Bash
---

Fix GitHub issue #$ARGUMENTS end-to-end:

1. Read the issue: `gh issue view $ARGUMENTS`
2. Understand the reported behavior — do not assume, read the issue fully
3. Search the codebase for relevant files using Grep/Glob
4. Reproduce the problem if possible (run tests, trace code path)
5. Implement the fix with minimal scope — change only what's needed
6. Write or update tests that cover the fixed case
7. Commit: `git add -p && git commit -m "fix: <description> (closes #$ARGUMENTS)"`
8. Create a PR: `gh pr create --title "fix: <description>" --body "Closes #$ARGUMENTS\n\n## Changes\n- ..."`
