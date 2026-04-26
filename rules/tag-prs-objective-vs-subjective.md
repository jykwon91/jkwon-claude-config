---
description: Tag every PR you open as objective or subjective so reviewers know how much scrutiny each needs
---

# Tag PRs Objective vs Subjective

Every PR you open MUST be tagged with one of two GitHub labels: `objective` or `subjective`. The label tells the reviewer how much scrutiny is needed.

## Definitions

### `objective`

The change is provably correct. A reasonable engineer with the same evidence would make the same change. Examples:
- CVE patch (the dep version with the fix is unambiguous)
- Bug fix with a failing test that now passes
- Removing dead code (verified unused via grep / static analysis)
- Stale-reference cleanup (PR is merged, branch is gone, file no longer exists)
- Deterministic detection rule (e.g., "PR #X is in MERGED state per gh API")
- Documentation that reflects existing code accurately
- Renaming an internal symbol (no behavior change, all call sites updated)

Lower review bar. The reviewer is checking that the diff matches the description, not relitigating the decision.

### `subjective`

The change encodes opinions, thresholds, workflow choices, or design preferences. Different reasonable engineers would make different choices. Examples:
- Adding a new agent or pipeline (the shape, scope, and triggers are opinions)
- New global preference (the rule itself is one valid cut among several)
- Changing a threshold (timeout, retry count, deletion cap, cadence)
- Workflow rules (e.g., "always do X before Y")
- Trigger conditions (e.g., "fire when N>5 and >5min elapsed")
- Hooks that shape future behavior

Higher review bar. The reviewer should evaluate the cuts, not just the diff.

## How to apply

When opening any PR (in any repo):

```bash
gh pr edit <pr-number> --repo <owner>/<repo> --add-label "objective"
# or
gh pr edit <pr-number> --repo <owner>/<repo> --add-label "subjective"
```

If the labels don't exist on the repo, create them first:

```bash
gh label create "objective" --repo <owner>/<repo> --color "0E8A16" \
  --description "Change is provably correct. Lower review bar."
gh label create "subjective" --repo <owner>/<repo> --color "FBCA04" \
  --description "Change encodes opinions/thresholds. Reviewer should evaluate the cuts."
```

In the PR body, also write the tag explicitly at the top so it survives label changes:

```
**Tag: objective** — <one-sentence reason>
```

## When a PR is mixed

Most PRs lean one way. If you genuinely have both:
- Tag the PR as `subjective` (the higher bar)
- In the body, list which parts are objective vs subjective so the reviewer knows where to focus

Example: a security PR that bumps a CVE (objective) AND introduces a new abstraction (subjective) — tag `subjective`, but the reviewer can fast-approve the dep bump and focus on the abstraction.

## Why this matters

Without tags, every PR feels like it deserves the same scrutiny. That's expensive — the user spends review effort on diffs that are unambiguous, and undertests diffs that genuinely encode opinions.

With tags:
- `objective` PRs get fast-merged after a quick diff scan
- `subjective` PRs get the careful read they deserve
- Reviewers can batch-process objective ones during low-energy windows and save subjective ones for fresh focus

## Scope — `jkwon-claude-config` ONLY

This rule applies to PRs against `jkwon-claude-config` and that repo only. The reasoning is asymmetric:

- **`jkwon-claude-config` changes affect every future Claude session across every project.** Even small additions ripple. The objective-vs-subjective lens helps the maintainer (you) decide whether to fast-approve or relitigate the cuts.
- **Project repos** (MyBookkeeper, MyFreeApps, MyJobHunter, etc.) have their own review processes — code review, CI gates, branch protection. The blast radius is the project, not the assistant's behavior. Tagging there adds ceremony without paying back.

Do NOT create `objective` / `subjective` labels on project repos. Do NOT tag PRs you open against them. If you find yourself wanting to, surface that decision to the user explicitly — they may want a different review process for that specific repo, but the default is "no tagging outside config repo."

## Self-honest check

Before tagging `objective`, sanity check: would I be willing to defend this change as the only-reasonable choice if the user pushed back? If no, it's `subjective`. When in doubt, tag `subjective` — over-flagging costs nothing; under-flagging costs review attention on the wrong PRs.
