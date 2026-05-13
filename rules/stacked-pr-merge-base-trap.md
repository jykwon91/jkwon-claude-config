---
description: When a stacked PR's base is another feature branch (not main), squash-merging the parent does NOT advance that branch's HEAD. The child's subsequent squash-merge silently goes into the now-orphaned parent branch instead of main, and the child's commits never reach production. Always retarget the child's base to main before merging, or use rebase-merge for stacks.
---

# Stacked PR Merge Base Trap — Squash-Merge Orphans the Child

Specific failure mode that orphaned PR #121 in this repo on 2026-05-13.

## The pattern

1. You open PR #A targeting `main` (parent).
2. You open PR #B with PR #A's branch as its base (child stacked on parent — a normal pattern when work logically depends on earlier work that isn't yet merged).
3. You **squash-merge PR #A**. GitHub creates a fresh squash commit on `main` and reports the PR as merged.
4. **PR #A's branch HEAD does NOT advance** — it still points at PR #A's pre-merge tip, which is no longer reachable from `main` (squash gave it a new commit hash).
5. PR #B's base is still pointing at PR #A's branch. GitHub does not auto-retarget.
6. You squash-merge PR #B. GitHub squashes PR #B's diff against its base (PR #A's stale branch tip) and creates a commit **on PR #A's branch**, not on `main`.
7. You delete the branches during cleanup.
8. The squash commit that "contains" PR #B's work is now orphaned — reachable from neither `main` nor any open branch. Git keeps it via reflog for 30 days, then it's gone.
9. Production never sees PR #B's changes.

## Why it happens

GitHub's auto-retarget only fires when the parent branch is **deleted** (or in some cases when the parent is merged via merge-commit and the parent's HEAD genuinely advances). With squash-merge, the parent commit still exists on the parent's branch — GitHub treats the branch as alive but unrelated, and leaves child PRs targeting it.

Combined with "Automatically delete head branches" being **off** for this config repo (verified via `gh api repos/<owner>/<repo>`), the parent branch lingers post-merge with a now-stale HEAD that becomes a trap for the child's merge.

## The fix

Three viable patterns, in order of preference:

### 1. Retarget child to main between parent merge and child merge

Best for one-off stacks where you can't change the merge strategy.

```bash
# After merging PR #A, before merging PR #B
gh pr edit <PR-B-number> --base main
```

GitHub will rebase the diff view and the next merge will land on `main`.

### 2. Rebase-merge the parent instead of squash-merge

Best if the parent's individual commits are clean enough to land on `main` as-is.

```bash
gh pr merge <PR-A-number> --rebase
```

Rebase-merge advances the parent branch's HEAD to the rebased commits on `main`. The child's base is now an ancestor of `main`, so child merges land correctly.

### 3. Avoid stacking entirely

Best when the work is small enough to do sequentially.

```bash
# Wait for PR #A to merge, then rebase the child branch onto fresh main
gh pr merge <PR-A-number> --squash
git fetch origin main
git rebase origin/main feature/child-branch
git push --force-with-lease origin feature/child-branch
gh pr create --head feature/child-branch --base main ...
```

## Recovery when you hit the trap

Symptoms: parent merged green, child also reports merged green, but `main`'s log doesn't contain the child's commits.

```bash
# 1. Verify the trap fired by checking the merge commit's parents
gh pr view <PR-B-number> --json mergeCommit,baseRefName
# If baseRefName is NOT main, the child merged into the parent branch.

# 2. The orphaned commit still exists in git's object store. Get its SHA:
gh pr view <PR-B-number> --json mergeCommit --jq '.mergeCommit.oid'

# 3. Cherry-pick it onto a fresh recovery branch:
git checkout main
git pull
git checkout -b fix/<original-feature-name>-recover
git cherry-pick <orphaned-merge-commit-sha>

# 4. Push and open a new PR against main:
git push -u origin fix/<original-feature-name>-recover
gh pr create --head fix/<original-feature-name>-recover --base main \
  --title "<original title> (re-target to main)" \
  --body "Recovery for orphaned <PR-B-number>; see commit history."
```

The recovery is straightforward IF you catch it before the 30-day reflog window expires. After that, the orphan is gone and the work must be reconstructed from the original branch (which may itself have been deleted during cleanup).

## How to spot the trap before merging

Before clicking "Squash and merge" on a stacked PR's parent, run:

```bash
gh pr list --base <parent-branch-name> --state open
```

If anything is returned, those PRs need their base retargeted to `main` (option 1) — or switch the merge strategy to rebase (option 2) — before you squash-merge the parent. The cost of the check is one CLI call; the cost of skipping it is a silent loss of merged work.

## Auto-capture trigger

About to call `gh pr merge --squash <number>` on a PR with open children targeting it. Before clicking, surface the children and ask: "PR #X has open children #Y, #Z. Retarget them to main first, switch to rebase-merge, or proceed anyway?" The default answer should be "retarget" — silent proceed is what produces orphans.
