---
name: update-preference
description: Update an existing global software engineering preference in jkwon-claude-config. Finds the best matching preference from plain-language input, proposes the update, and opens a PR for team review.
argument-hint: "<plain language description of the change>"
---

The user wants to update an existing preference in the shared Claude Code configuration.

## Steps

1. Read `~/Documents/Git/jkwon-claude-config/global-preferences.md` to get all current preferences.
2. From the user's plain-language input (`$ARGUMENTS`), identify which existing preference they most likely want to update. Use semantic meaning, not just keyword matching.
3. Show the user:
   - The preference you identified as the match
   - The proposed updated version
   Ask them to confirm before proceeding. If they say it's the wrong preference, ask them to clarify.
4. Once confirmed, in `~/Documents/Git/jkwon-claude-config`:
   - Create a new branch named `preference/update-<short-slug>`
   - Replace the old preference with the updated one in `global-preferences.md`
   - Commit with a short message describing what changed
   - Push the branch
   - Open a PR to main with a clear title, the old preference, and the updated preference in the description
5. Return the PR URL to the user.

## Style guide for preference statements

- Start with an action verb (Always, Prefer, Avoid, Never, Don't)
- Be specific — say what to do, not just what to avoid
- One sentence per preference
- Match the tone of existing preferences
