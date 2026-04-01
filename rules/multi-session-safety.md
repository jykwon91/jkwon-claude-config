---
description: Detect when another session is active in the same repo and guide toward worktree isolation
---

# Multi-Session Safety

When starting work that will modify code (features, bug fixes, refactoring), check if the working directory is already in use by another session.

## Detection

Before creating a branch or modifying files, run:

```bash
# Check for uncommitted changes (another session may be mid-work)
git status --porcelain 2>/dev/null

# Check if on a feature/fix branch (another session's active work)
CURRENT=$(git branch --show-current 2>/dev/null)

# Check for active worktrees
git worktree list 2>/dev/null
```

**If the repo has uncommitted changes or is on a non-main branch**, another session is likely active. Do NOT switch branches or start working in the same directory.

## When to use a worktree

Use a git worktree when **any** of these are true:
- The repo has uncommitted changes on the current branch
- The repo is checked out to a feature/fix branch (not main/master)
- The user explicitly asks to work on a second feature in parallel
- The user says they have another session running

## How to set up a worktree

```bash
# Determine worktree base directory (sibling to repo)
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
WORKTREE_BASE="$(dirname "$(git rev-parse --show-toplevel)")/${REPO_NAME}-worktrees"
mkdir -p "$WORKTREE_BASE"

# Determine developer identifier
DEV=$(git config user.name | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | cut -c1-15)

# Create the worktree with a new branch
BRANCH_NAME="feature/$DEV/<feature-name>"
WORKTREE_DIR="$WORKTREE_BASE/<feature-name>"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" main
```

Then work entirely within `$WORKTREE_DIR` for the rest of the session — all reads, edits, builds, and tests happen there.

## Dev server ports in worktrees

When starting dev servers in a worktree, use non-default ports to avoid collisions with the main repo's running servers. Read the project's CLAUDE.md for port configuration, then offset:

- **Main repo**: default ports (e.g., frontend :3000, backend :8000)
- **Worktree sessions**: offset ports (e.g., frontend :3001, backend :8001)

Set port overrides via environment variables before starting servers:
```bash
# Common patterns — adapt to the project's actual env vars
PORT=3001 npm run dev                    # Vite/Next.js
VITE_PORT=3001 npm run dev               # Vite
uvicorn app.main:app --port 8001         # FastAPI
```

If the project's CLAUDE.md has a `## Dev Server` section, check for documented port override env vars. If not, detect from package.json scripts or framework config.

## Test isolation in worktrees

When running tests in a worktree:

- **Unit tests**: safe to run in parallel — no shared state
- **E2E tests**: need their own server instances (see port offsets above)
- **Database tests**: if tests use a shared dev database, set a test-specific database name:
  ```bash
  TEST_DATABASE_URL="postgresql://localhost/myapp_test_worktree" pytest
  ```
  Or prefix test data with a session identifier to avoid collisions.

## Migration safety

**Only one session should create database migrations at a time.** Migrations are sequential and branch-dependent — two sessions creating migrations simultaneously will produce conflicting revision chains.

Before creating a migration:
```bash
# Check if any other worktree has uncommitted migration files
git worktree list --porcelain | grep worktree | while read _ dir; do
  find "$dir" -path "*/migrations/versions/*.py" -newer "$dir/.git" 2>/dev/null
done
```

If another worktree has uncommitted migrations, wait for them to merge first or coordinate with the other session.

## Worktree cleanup

After merging a feature that was developed in a worktree:

```bash
# Remove the worktree
git worktree remove "$WORKTREE_DIR"

# If the worktree directory persists (e.g., due to untracked files)
git worktree remove --force "$WORKTREE_DIR"

# Prune stale worktree references
git worktree prune
```

## What NOT to do in multi-session

- **Never `git checkout` in a directory where another session is working** — use a worktree instead
- **Never run `git stash`** to temporarily shelve another session's work — stashes are global and easy to lose
- **Never start a second session in the same directory** without checking for active work first
- **Never create migrations in parallel** across worktrees — coordinate or serialize
