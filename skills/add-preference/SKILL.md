---
name: add-preference
description: Add a new global software engineering preference to jkwon-claude-config. Translates plain-language input into a well-written preference, adds it to global-preferences.md, commits, and pushes.
argument-hint: "<preference in plain language>"
---

The user wants to add a new global preference to the shared Claude Code configuration.

## Steps

1. Read `~/Documents/Git/jkwon-claude-config/global-preferences.md` to understand the existing preferences and categories.
2. Translate the user's plain-language input (`$ARGUMENTS`) into a concise, clear preference statement that matches the style of the existing ones.
3. Determine which existing category it belongs to, or create a new one if it doesn't fit.
4. Append it to the correct section in `~/Documents/Git/jkwon-claude-config/global-preferences.md`.
5. Confirm the change with the user before committing.
6. Commit and push from `~/Documents/Git/jkwon-claude-config` with a short commit message describing the preference added.

## Style guide for preference statements

- Start with an action verb (Always, Prefer, Avoid, Never, Don't)
- Be specific — say what to do, not just what to avoid
- One sentence per preference
- Match the tone of existing preferences
