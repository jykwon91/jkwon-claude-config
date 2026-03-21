# Admin Setup

This guide covers the one-time infrastructure setup, registering and removing projects, PAT management, and troubleshooting sync failures.

## Prerequisites

- Admin access to the `jykwon91/jkwon-claude-config` repo
- A GitHub Personal Access Token with `repo` scope (see below)
- Write access to every project repo you want to sync to

---

## Initial Setup

### 1. Create a PAT

The GitHub Action needs a Personal Access Token with write access to all registered repos.

1. Go to GitHub > avatar menu > **Settings**
2. Scroll to **Developer settings** > **Personal access tokens** > **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Name it `claude-config-sync`
5. Set an expiration (recommended: 90 days — set a calendar reminder to rotate)
6. Check the `repo` scope
7. Click **Generate token** and copy it — you only see it once

### 2. Add the PAT as a Repository Secret

1. Go to `github.com/jykwon91/jkwon-claude-config` > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `SYNC_TOKEN`, Value: paste the token
4. Click **Add secret**

### 3. Verify the workflow exists

Confirm `.github/workflows/sync.yml` is on the `main` branch. The Action triggers on pushes to `main` that touch `agents/`, `skills/`, `hooks/`, `global-preferences.md`, `onboard.sh`, or `projects.txt`.

---

## Registering a New Project

### Steps

1. Open `projects.txt` in this repo
2. Add the repo in `owner/repo` format (one per line):
   ```
   jykwon91/MyBookkeeper
   jykwon91/your-new-project
   ```
3. Commit and push to `main` (or open a PR)
4. The GitHub Action will sync to the new project automatically

### What gets synced to the project

```
agents/*.md          →  <project>/.claude/agents/*.md
skills/*/SKILL.md    →  <project>/.claude/skills/*/SKILL.md
hooks/post-merge     →  <project>/hooks/post-merge
onboard.sh           →  <project>/onboard.sh
uninstall.sh         →  <project>/uninstall.sh
global-preferences.md →  injected into <project>/CLAUDE.md
```

### After registering

1. **Verify the sync ran** — go to the Actions tab in this repo, check the latest workflow run, and confirm the project shows as "updated" in the job summary
2. **Verify the project received files** — check the project repo for a new commit from `claude-config-sync` containing `.claude/agents/`, `.claude/skills/`, `hooks/post-merge`, `onboard.sh`, and `uninstall.sh`
3. **Tell developers to onboard** — developers in the new project need to run `bash onboard.sh` once to set up auto-sync on their machines (see [Developer Onboarding](onboarding.md))

### PAT access notes

- **Your own repos** — covered by the `repo` scope
- **Org repos** — PAT owner needs write access to the repo; may need SSO authorization under GitHub > Settings > Personal access tokens > **Configure SSO**
- **Others' repos** — only works if the PAT owner has been granted write access

### Projects without a CLAUDE.md

If the target project has no `CLAUDE.md`, the sync creates one containing just the global preferences block. If it already has a `CLAUDE.md` without the preference markers, the sync prepends the block to the existing content.

---

## Removing a Project from Sync

### Steps

1. Remove the repo line from `projects.txt`
2. Commit and push to `main`

### What this does NOT do

Removing from `projects.txt` only stops future syncs. It does **not** clean up files already in the project repo. To fully remove:

1. In the project repo, delete:
   - `.claude/agents/` (the synced agent files)
   - `.claude/skills/` (the synced skill directories)
   - `hooks/post-merge`
   - `onboard.sh`
   - `uninstall.sh`
2. Remove the global preferences block from `CLAUDE.md` (everything between `<!-- BEGIN GLOBAL PREFERENCES -->` and `<!-- END GLOBAL PREFERENCES -->`)
3. Commit and push the cleanup
4. Tell developers to run `bash uninstall.sh` from the project directory to remove the post-merge hook and `~/.claude/` files from their machines

---

## PAT Rotation

GitHub classic PATs expire. When yours expires, the sync workflow will fail silently (clone step fails with auth error).

### How to rotate

1. Generate a new PAT following the same steps as initial setup (step 1 above)
2. Go to this repo's **Settings** > **Secrets and variables** > **Actions**
3. Click the pencil icon next to `SYNC_TOKEN`
4. Paste the new token and click **Update secret**
5. Trigger a manual sync to verify: go to **Actions** > **Sync agents, skills, and preferences to projects** > **Run workflow**

### How to know it expired

- The sync workflow will show a red X in the Actions tab
- The error log will contain an authentication failure on the `git clone` step
- Developers will stop receiving updates on `git pull` (no changes coming in)

Set a calendar reminder for a few days before expiration.

---

## How the Sync Works

When changes are pushed to `main` that touch any of the watched paths, the GitHub Action runs:

```
For each repo in projects.txt:
  1. Clone the target repo using SYNC_TOKEN
  2. Copy agents/*.md          →  .claude/agents/
  3. Copy skills/*/SKILL.md    →  .claude/skills/*/
  4. Copy hooks/post-merge     →  hooks/post-merge
  5. Copy onboard.sh           →  onboard.sh
  6. Copy uninstall.sh         →  uninstall.sh
  7. Inject global-preferences.md into CLAUDE.md between marker comments
  8. Commit and push if anything changed
```

The commit author is `claude-config-sync <claude-config-sync@users.noreply.github.com>`.

### Watched paths (triggers the workflow)

- `agents/**`
- `skills/**`
- `hooks/**`
- `global-preferences.md`
- `onboard.sh`
- `uninstall.sh`
- `projects.txt`

Changes to other files (README, docs, install.sh, etc.) do **not** trigger the sync.

### Manual trigger

The workflow supports `workflow_dispatch`. To trigger manually:

1. Go to **Actions** > **Sync agents, skills, and preferences to projects**
2. Click **Run workflow** > select `main` > **Run workflow**

Use this after rotating a PAT, fixing a failed sync, or when you want to force a re-sync without pushing a file change.

---

## Troubleshooting

### Sync workflow failed

1. Go to the Actions tab and click the failed run
2. Expand the "Sync to registered projects" step
3. Common causes:
   - **Auth failure** — PAT expired or lacks access to the target repo. Rotate the PAT.
   - **Merge conflict** — someone pushed to the project repo between the clone and push. Re-trigger the workflow.
   - **Repo not found** — typo in `projects.txt` or repo was deleted/renamed. Fix the entry.

### Sync ran but project didn't get updated

- Check the job log — if it says "No changes for repo, skipping", the project already has the latest files
- Confirm the correct files changed in the triggering commit (only watched paths trigger the workflow)

### Developer says agents aren't working after pull

1. Confirm the project is in `projects.txt`
2. Confirm the latest sync workflow succeeded
3. Ask the developer to verify:
   - `ls .claude/agents/` in the project repo (files should exist)
   - `ls ~/.claude/agents/` on their machine (files should exist)
   - If missing from `~/.claude/`, re-run `bash onboard.sh`
   - Restart Claude Code after syncing
