---
description: Any new GitHub Actions SHA pin in a workflow file MUST be verified against the upstream repo before commit
---

# Verify Action SHA Before Commit

When adding or changing a GitHub Actions SHA pin (`uses: <owner>/<repo>@<sha>`) in any workflow file, verify the SHA exists in the upstream repo before committing. SHAs are exactly the kind of long opaque strings models hallucinate — looks-like-a-SHA-but-isn't.

Hallucinated SHAs typically match the first 8-13 chars of a real SHA (often an adjacent version's), diverge after into plausible-looking hex, pass casual eyeball review, and fail loudly at `Unable to resolve action <owner>/<repo>@<sha>` days later when nobody knows why CI broke.

## The rule

Before committing any change that adds or modifies `uses:\s+\S+/\S+@[0-9a-f]{40}`:

1. Extract the SHA from the line.
2. Verify it exists upstream:
   ```bash
   gh api repos/<owner>/<repo>/git/commits/<sha>
   ```
   200 + commit object → real, proceed. 404 → fake, STOP and fix.
3. Cross-check the comment claim. If the line says `# v1.2.0`, also confirm:
   ```bash
   gh api repos/<owner>/<repo>/tags --jq '.[] | select(.name=="v1.2.0").commit.sha'
   ```
   If this differs from the SHA in the workflow, SHA and comment disagree — fix one.

## Quick verifier

For multiple SHAs in one workflow:

```bash
grep -oE 'uses: \S+/\S+@[0-9a-f]{40}' .github/workflows/*.yml | while IFS= read -r line; do
  ref="${line##*: }"
  repo="${ref%%@*}"
  sha="${ref##*@}"
  status=$(gh api "repos/$repo/git/commits/$sha" --silent 2>&1 && echo "OK" || echo "MISSING")
  echo "$status  $ref"
done
```

Any line ending in `MISSING` is a bug to fix before commit.

## Looking up real SHAs

```bash
# By tag name
gh api repos/<owner>/<repo>/tags --jq '.[] | "\(.name)|\(.commit.sha)"'

# Latest stable release
gh api repos/<owner>/<repo>/releases/latest --jq '.tag_name + " " + .target_commitish'

# Tag-to-SHA for a specific tag (most reliable)
gh api repos/<owner>/<repo>/git/refs/tags/<tag-name> --jq '.object.sha'
```

Use the SHA from `git/refs/tags/<tag>` rather than `tags` list — annotated tags differ between the two endpoints, and `git/refs/tags` returns the underlying commit SHA which is what `uses:` resolves.

## When to skip verification

- SHA was introduced by Dependabot in a `dependabot/...` branch — Dependabot generates real SHAs
- Updating only the version comment (`# v1.2.0` → `# v1.2.1`), not the SHA — SHA unchanged
- Change removes a `uses:` line entirely

In all other cases, verify.

## What to do if the SHA is bad

1. Look up the real SHA for the version the comment claims via `gh api repos/<owner>/<repo>/git/refs/tags/<tag>`
2. If the version is significantly outdated (>2 minor versions behind latest stable), bump to latest stable; note the bump in the commit message
3. Reference this rule in the commit message so the historical record explains the SHA change
4. If the same workflow has the bad SHA in multiple places, fix all in one commit
