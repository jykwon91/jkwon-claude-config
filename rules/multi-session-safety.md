---
description: Detect when another session is active in the same repo and guide toward worktree isolation
---

# Multi-Session Safety

When starting work that will modify code, check if the working directory is already in use by another session.

## Detection

Before creating a branch or modifying files:

```bash
git status --porcelain 2>/dev/null
CURRENT=$(git branch --show-current 2>/dev/null)
git worktree list 2>/dev/null
```

**If the repo has uncommitted changes or is on a non-main branch**, another session is likely active. Do NOT switch branches or start working in the same directory.

## When to use a worktree

Use a git worktree when **any** of these are true:
- Repo has uncommitted changes on the current branch
- Repo is on a feature/fix branch (not main/master)
- User explicitly asks to work on a second feature in parallel
- User says they have another session running

## How to set up a worktree

```bash
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
WORKTREE_BASE="$(dirname "$(git rev-parse --show-toplevel)")/${REPO_NAME}-worktrees"
mkdir -p "$WORKTREE_BASE"

DEV=$(git config user.name | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | cut -c1-15)
BRANCH_NAME="feature/$DEV/<feature-name>"
WORKTREE_DIR="$WORKTREE_BASE/<feature-name>"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" main
```

Work entirely within `$WORKTREE_DIR` — all reads, edits, builds, tests happen there.

## Dev server ports in worktrees

Use non-default ports to avoid colliding with the main repo's servers. Read project CLAUDE.md for port config, then offset:

- **Main repo**: default ports (e.g., frontend :3000, backend :8000)
- **Worktree**: offset (e.g., frontend :3001, backend :8001)

```bash
PORT=3001 npm run dev                    # Vite/Next.js
VITE_PORT=3001 npm run dev               # Vite
uvicorn app.main:app --port 8001         # FastAPI
```

If project CLAUDE.md has a `## Dev Server` section, use the documented override env vars. Otherwise detect from `package.json` scripts or framework config.

## Test isolation in worktrees

- **Unit tests**: safe to run in parallel — no shared state
- **E2E tests**: need their own server instances (see port offsets)
- **Database tests**: if tests use shared dev DB, set test-specific DB name:
  ```bash
  TEST_DATABASE_URL="postgresql://localhost/myapp_test_worktree" pytest
  ```

## Migration safety

**Only one session should create database migrations at a time.** Migrations are sequential and branch-dependent — parallel creation produces conflicting revision chains.

```bash
# Check if any other worktree has uncommitted migration files
git worktree list --porcelain | grep worktree | while read _ dir; do
  find "$dir" -path "*/migrations/versions/*.py" -newer "$dir/.git" 2>/dev/null
done
```

If another worktree has uncommitted migrations, wait for merge or coordinate.

## What NOT to do

- **Never `git checkout` in a directory where another session is working** — use a worktree
- **Never run `git stash`** to shelve another session's work — stashes are global and easy to lose
- **Never start a second session in the same directory** without checking for active work first
- **Never create migrations in parallel** across worktrees — coordinate or serialize
