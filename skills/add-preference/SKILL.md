---
name: add-preference
description: Propose a new global software engineering preference to jkwon-claude-config. Translates plain-language input into a well-written preference, adds it to global-preferences.md, and opens a PR for team review.
argument-hint: "<preference in plain language>"
---

The user wants to propose a new global preference to the shared Claude Code configuration.

## Steps

1. Read `~/Documents/Git/jkwon-claude-config/global-preferences.md` to understand the existing preferences and categories.
2. Translate the user's plain-language input (`$ARGUMENTS`) into a concise, clear preference statement that matches the style of the existing ones.
3. Determine which existing category it belongs to, or create a new one if it doesn't fit.
4. Confirm the proposed preference statement with the user before making any changes.
5. In `~/Documents/Git/jkwon-claude-config`:
   - Create a new branch named `preference/<short-slug>` (e.g. `preference/strict-typing`)
   - Append the preference to the correct section in `global-preferences.md`
   - Commit with a short message describing the preference
   - Push the branch
   - Open a PR to main with a clear title and description explaining what the preference is and why it was proposed
6. Return the PR URL to the user.

## Style guide for preference statements

- Start with an action verb (Always, Prefer, Avoid, Never, Don't)
- Be specific — say what to do, not just what to avoid
- One sentence per preference
- Match the tone of existing preferences
