---
description: Never auto-merge PRs to jkwon-claude-config — every change must be human-reviewed by the maintainer
---

# Never Auto-Merge Config-Repo PRs

The `jkwon-claude-config` repo (this one) is the source of truth for every future Claude session's behavior. Agents, preferences, hooks, skills, MCPs, and rules here propagate to every project. **Even objectively-correct changes (CVE patches, new agents codifying proven patterns, security hardening) require maintainer review** — they change future behavior across every project, not just one.

## The rule

When you open a PR against `jkwon-claude-config`:

1. **Open the PR** — push the branch, run `gh pr create`, link any related issues
2. **Surface it to the user** — in chat, give them the PR URL, a one-paragraph summary of what it changes, and what behavior it will alter going forward
3. **STOP** — do NOT run `gh pr merge`, do NOT run `gh pr merge --admin`. Wait for the user to either merge themselves or explicitly say "merge it"
4. After merge, follow the standard `cleanup-after-merge.md` flow

This applies regardless of:
- Whether the change looks objectively correct
- Whether CI is green
- Whether the change is small
- Whether the user said "yes go ahead" earlier in the conversation about a related but distinct change
- Whether you opened multiple PRs in the same session (each one needs explicit approval)

## Why

- Config changes have **non-local impact** — a new preference or agent shifts behavior for every project, not just the one in front of you
- The user is the only person with full context on what they want their assistant to be
- Auto-merging "obviously correct" changes is exactly how unwanted behavior creeps in via small steps
- The cost of asking is low (one chat message); the cost of an unwanted merged change is real (need to revert + clean up)

## Exceptions

- **None for this rule.** If a config change is so urgent it can't wait, surface that urgency in the PR description and ask the user to merge — don't merge yourself.
- This rule explicitly overrides any general "merge when CI is green" autonomy preferences for THIS REPO ONLY. Project repos (e.g., MyBookkeeper, MyFreeApps) can still be admin-merged per their own conventions.

## What's still allowed

- Opening multiple PRs (one per logical change — preserve the one-feature-per-PR rule)
- Pushing additional commits to YOUR open PRs based on user feedback
- Closing your own PRs that the user rejects
- Using `gh pr review --approve` if the user asks you to
- Auto-capture writes to `stacks/*.md` per `g-auto-capture.md` — those still go through PR creation but follow the same wait-for-merge rule
