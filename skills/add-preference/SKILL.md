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
4. **Classify: objective vs subjective.** Apply the objectivity test (see below). You must be 100% certain a preference is objective before treating it as such. If there is any doubt, it is subjective.
5. **Check for contradictions:** Compare the proposed preference against ALL existing preferences. If any existing preference contradicts or conflicts with the new one, flag the conflict to the user and ask which should win — update the existing preference, replace it, or abandon the new one. Never add a preference that contradicts an existing one.
6. **Route based on classification:**

   **If objective:** Confirm the statement with the user, then push to the global config.
   - Check for an existing open **objective** PR (title contains `[objective]`). If one exists, check out that branch, pull latest, and add the preference there.
   - If no objective PR exists, create a new branch `preference/<short-slug>` and open a PR with `[objective]` in the title.

   **If subjective:** Explain to the user casually, something like: "This one's more of a personal preference — not every developer would agree on it. I can add it to this project's config so it applies here. Or if you think it should apply across all your projects, I can put it up for review so other developers on the team can weigh in before it becomes a standard. What would you like to do?"
   - If the user chooses **local**: add it to the project's CLAUDE.md.
   - If the user chooses **global review**: push to a separate PR with `[discussion]` in the title so it's clear this needs team input before merging. Never combine these with the objective PR.

7. In `~/Documents/Git/jkwon-claude-config` (if pushing to global):
   - **Always pull before editing:** Run `git pull` on the branch before making changes to avoid overwriting another user's work.
   - Append the preference to the correct section in `global-preferences.md`
   - **Check for merge conflicts:** After editing, if the file has conflict markers, resolve them by keeping all preferences from both sides.
   - Commit with a short message describing the preference
   - Push the branch
   - If a new PR was needed, open one with a clear title and description
8. Return the PR URL (or confirm local addition) to the user.

## Objectivity test

A preference is 100% objective only if it passes ALL three checks:

1. **Violation causes measurable harm.** If a developer does the opposite, something concretely breaks — bugs, security holes, data loss, wasted work, false confidence, or broken workflows. Not "the code is less clean" but "something fails or degrades."

2. **No reasonable counterargument exists.** There is no legitimate scenario where doing the opposite is the better choice. "Don't hardcode secrets" has no counterargument. "Always write comments" does — sometimes code is self-evident.

3. **It applies to any project using that technology.** It doesn't have to be language-agnostic, but it must be universally true within its domain. "Never use `any` in TypeScript" is objective for all TypeScript projects. "Use Redux for state management" is subjective — plenty of TypeScript projects use other approaches. Stack-specific preferences are fine as long as they're universal within that stack.

**If it fails any one of the three → subjective.** When in doubt, default to subjective.

Examples:
- **Objective:** "Don't hardcode secrets" (violation leaks credentials, no counterargument, applies everywhere)
- **Objective:** "E2E tests must simulate real interactions" (violation = false confidence, no counterargument, applies to any project with E2E tests)
- **Objective:** "Never use `any` in TypeScript" (violation = type safety bugs, no counterargument for strict-typed projects, applies to all TS projects)
- **Subjective:** "Always write JSDoc on every function" (some codebases prefer self-documenting code)
- **Subjective:** "Use functional components over class components" (both work, it's a React convention preference)
- **Subjective:** "Prefer Tailwind over CSS modules" (framework choice, both produce correct styling)

## Contradiction handling

If a contradiction is found in step 5:
- Show the user the existing preference and the proposed one side by side
- Ask: "These conflict. Should I (a) update the existing one, (b) replace it with the new one, or (c) abandon this change?"
- Use the `update-preference` or `delete-preference` skill as needed based on the user's choice

## PR management

- There can be at most **two** open PRs at a time: one `[objective]` and one `[discussion]`.
- Never mix objective and subjective preferences in the same PR.
- Always check `gh pr list --state open` before creating a new PR.
- Always pull the branch before committing to avoid overwriting another user's changes.

## Autonomous mode

When working autonomously (no user available to prompt):
- If 100% certain the preference is objective, push directly to the `[objective]` PR — no prompt needed.
- If there is any doubt at all, add it to the project's local CLAUDE.md silently. Do not create a global PR without certainty.
- Never create a `[discussion]` PR autonomously — those require user input by definition.

## Style guide for preference statements

- Start with an action verb (Always, Prefer, Avoid, Never, Don't)
- Be specific — say what to do, not just what to avoid
- One sentence per preference
- Match the tone of existing preferences
