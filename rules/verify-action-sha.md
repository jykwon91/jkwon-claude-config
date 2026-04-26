---
description: Any new GitHub Actions SHA pin in a workflow file MUST be verified against the upstream repo before commit
---

# Verify Action SHA Before Commit

When you add or change a GitHub Actions SHA pin (`uses: <owner>/<repo>@<sha>`) in any workflow file, you MUST verify the SHA exists in the upstream repo before committing. SHAs are exactly the kind of long opaque strings models hallucinate — looks-like-a-SHA-but-isn't.

## The pattern

Hallucinated SHAs typically:
- Match the first 8–13 chars of a real SHA (often the SHA of an adjacent version)
- Diverge after that into plausible-looking hex
- Pass casual eyeball review
- Fail loudly at `Unable to resolve action <owner>/<repo>@<sha>` when the workflow runs

This has bitten this codebase TWICE in 2026:
- `gitleaks/gitleaks-action@e1bff3b...` — hallucinated, fixed by pulling the real SHA via `gh api`
- `appleboy/ssh-action@7eaf76671a0d7b0e8e43c4da68a9062720ab5174` — hallucinated, blocked every Deploy MyBookkeeper run after the migration until found and fixed

The cost of verification is one API call. The cost of NOT verifying is hours of debugging when CI breaks days later.

## The rule

Before committing any change that adds or modifies a line matching `uses:\s+\S+/\S+@[0-9a-f]{40}`:

1. Extract the SHA from the line
2. Verify it exists upstream:
   ```bash
   gh api repos/<owner>/<repo>/git/commits/<sha>
   ```
   Returns 200 + commit object → SHA is real, proceed
   Returns 404 → SHA is fake, STOP and fix
3. Cross-check the comment claim against reality. If the line says `# v1.2.0`, also confirm:
   ```bash
   gh api repos/<owner>/<repo>/tags --jq '.[] | select(.name=="v1.2.0").commit.sha'
   ```
   If this returns a different SHA than the one in the workflow, the SHA and the comment disagree — fix one of them.

## Quick verifier

For multiple SHAs in one workflow file, batch-verify:

```bash
grep -oE 'uses: \S+/\S+@[0-9a-f]{40}' .github/workflows/*.yml | while IFS= read -r line; do
  ref="${line##*: }"
  repo="${ref%%@*}"
  sha="${ref##*@}"
  status=$(gh api "repos/$repo/git/commits/$sha" --silent 2>&1 && echo "OK" || echo "MISSING")
  echo "$status  $ref"
done
```

Output any line ending in `MISSING` is a bug to fix before commit.

## Looking up real SHAs

When you need to pin to a specific version:

```bash
# By tag name
gh api repos/<owner>/<repo>/tags --jq '.[] | "\(.name)|\(.commit.sha)"'

# Latest stable release
gh api repos/<owner>/<repo>/releases/latest --jq '.tag_name + " " + .target_commitish'

# Tag-to-SHA for a specific tag (most reliable)
gh api repos/<owner>/<repo>/git/refs/tags/<tag-name> --jq '.object.sha'
```

Always use the SHA from `git/refs/tags/<tag>` rather than the SHA from `tags` list — annotated tags differ between the two endpoints, and `git/refs/tags` returns the underlying commit SHA which is what `uses:` actually resolves.

## When to skip verification

- The SHA was introduced by Dependabot in a `dependabot/...` branch — Dependabot generates real SHAs, not hallucinations
- You're updating only the version comment (`# v1.2.0` → `# v1.2.1`) and NOT the SHA — the SHA is unchanged
- The change removes a `uses:` line entirely

In all other cases, verify.

## What to do if the SHA is bad

1. Look up the real SHA for the version the comment claims via `gh api repos/<owner>/<repo>/git/refs/tags/<tag>`
2. If the version is significantly outdated (>2 minor versions behind latest stable), bump to latest stable while you're there — note the version bump in the commit message
3. Reference this rule in the commit message so the historical record explains why the SHA changed
4. If the same workflow has the bad SHA in multiple places, fix all of them in one commit (don't leave landmines)

## Why this rule exists

Verification cost: 1 API call (~200ms).
Skip cost: every CI run failing at `Unable to resolve action`, often discovered days/weeks later when someone needs the workflow to work and digs through logs to find the cause. Production deploys can sit broken for days because nobody notices a non-blocking-but-failing workflow.

This rule does NOT auto-fire — there's no pre-commit hook for it (yet). It's a checklist item you (or an agent) must do before proposing a workflow change. If you find this is being skipped repeatedly, encode it as a hook in `~/.claude/settings.json` `PreToolUse` for any Edit/Write touching `.github/workflows/`.
