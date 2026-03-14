---
name: delete-preference
description: Delete an existing global software engineering preference from jkwon-claude-config. Finds the best matching preference from plain-language input, confirms with the user, and opens a PR for team review.
argument-hint: "<plain language description of the preference to delete>"
---

The user wants to delete an existing preference from the shared Claude Code configuration.

## Steps

1. Read `~/Documents/Git/jkwon-claude-config/global-preferences.md` to get all current preferences.
2. From the user's plain-language input (`$ARGUMENTS`), identify which existing preference they most likely want to delete. Use semantic meaning, not just keyword matching.
3. Show the user the preference you identified and ask them to confirm before proceeding. If they say it's the wrong preference, ask them to clarify.
4. Once confirmed, in `~/Documents/Git/jkwon-claude-config`:
   - Create a new branch named `preference/delete-<short-slug>`
   - Remove the preference from `global-preferences.md`. If it was the only item in its category, remove the category heading too.
   - Commit with a short message describing what was removed
   - Push the branch
   - Open a PR to main with a clear title and the deleted preference in the description
5. Return the PR URL to the user.
