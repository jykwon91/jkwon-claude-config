# Developer Onboarding

This guide covers how to install the shared Claude Code config on your machine, how auto-sync works, and how to remove everything.

## Prerequisites

- **Claude Code** installed and working (`claude --version` should return a version)
- **Git** installed (`git --version`)
- **Git Bash** if on Windows (comes with Git for Windows — run all commands in Git Bash, not PowerShell or CMD)

## What Gets Installed

After setup, your machine will have:

```
~/.claude/
  ├── agents/              ← Global agent definitions (g-review-code.md, etc.)
  ├── skills/              ← Global slash commands (add-preference/, fix-issue/, etc.)
  └── rules/               ← Global rules (react.md, etc.)
```

These files are **additive** — they don't replace any existing personal config in `~/.claude/`. They only add or update files that match the names shipped from this repo.

---

## Option A: Automatic Sync via Post-Merge Hook (Recommended)

Use this if you're working in a project repo that's been registered with jkwon-claude-config.

### Steps

```bash
git clone <project-repo>
cd <project>
bash onboard.sh
```

### What this does

1. Installs a `post-merge` git hook in the project's `.git/hooks/`
2. Stores a SHA-256 checksum of the hook for integrity verification
3. Runs an **initial sync** — copies agents and skills from the project's `.claude/` to `~/.claude/` immediately

### Verify it worked

```bash
ls ~/.claude/agents/
ls ~/.claude/skills/
```

You should see `.md` files in `agents/` and subdirectories in `skills/`. If these directories are empty, the project may not have been synced from jkwon-claude-config yet — ask an admin to check.

### What happens on future git pulls

Every `git pull` in this project will:

1. Verify the hook file hasn't been tampered with (checksum check)
2. Check if any `.claude/` files changed in the pull
3. If yes, copy updated agents and skills from the project's `.claude/` to `~/.claude/`
4. Print a message: `[claude-config] Sync complete. Restart Claude Code if it is running.`

If nothing in `.claude/` changed, the hook exits silently.

### Important notes

- Run `onboard.sh` **once per project per machine**. If you work on multiple registered projects, run it in each one.
- If you switch to a new machine, run `onboard.sh` again on the new machine.
- If you see `WARNING: post-merge hook checksum mismatch` after a pull, the hook template was updated. Re-run `bash onboard.sh` to install the new version.

---

## Option B: Direct Install from This Repo

Use this if you just want the config without auto-sync, or if you're not working in a registered project.

### Steps

```bash
git clone git@github.com:jykwon91/jkwon-claude-config.git
cd jkwon-claude-config
bash install.sh
```

### What this does

1. Creates `~/.claude/agents/`, `~/.claude/skills/`, and `~/.claude/rules/` if they don't exist
2. Copies all `agents/*.md` files to `~/.claude/agents/`
3. Copies each `skills/<name>/SKILL.md` to `~/.claude/skills/<name>/SKILL.md`
4. Copies all `rules/*.md` files to `~/.claude/rules/`

### Verify it worked

```bash
ls ~/.claude/agents/
ls ~/.claude/skills/
ls ~/.claude/rules/
```

### Staying up to date

This method does **not** auto-update. To get the latest config:

```bash
cd jkwon-claude-config
git pull
bash install.sh
```

---

## Uninstalling / Rollback

To remove all shared config from your machine:

```bash
bash uninstall.sh
```

Run it from this repo or from any project repo that has the script.

### What it removes

- All agent files from `~/.claude/agents/` that match files in this repo's `agents/` directory
- All skill directories from `~/.claude/skills/` that match directories in this repo's `skills/` directory
- All rule files from `~/.claude/rules/` that match files in this repo's `rules/` directory
- The `post-merge` hook and its checksum from the current repo's `.git/hooks/` (if run from within a git repo)

### What it does NOT touch

- Any personal config files in `~/.claude/` that weren't installed by this repo
- Project-level `.claude/` directories (those are managed by git)
- The `~/.claude/` directory itself
- Global preferences already in project `CLAUDE.md` files (those are part of git history)

### If you have multiple onboarded projects

`uninstall.sh` only removes the hook from the repo you run it in. To remove hooks from all projects, run it in each one:

```bash
cd ~/projects/project-a && bash uninstall.sh
cd ~/projects/project-b && bash uninstall.sh
```

### Removing global preferences from a project's CLAUDE.md

Global preferences are injected between marker comments. To remove them, delete everything between (and including) these lines:

```
<!-- BEGIN GLOBAL PREFERENCES -->
...
<!-- END GLOBAL PREFERENCES — To override any of the above for this project, add your instructions below this line. -->
```

This is a manual edit — `uninstall.sh` does not modify project files.

### Verify uninstall worked

```bash
ls ~/.claude/agents/    # should be empty or missing the shared agents
ls ~/.claude/skills/    # should be empty or missing the shared skills
ls ~/.claude/rules/     # should be empty or missing the shared rules
```

---

## Troubleshooting

### "Error: must be run from within a git repository"

You ran `onboard.sh` outside a git repo. `cd` into the project directory first.

### "Error: hook template not found"

The project hasn't been synced from jkwon-claude-config yet. Ask an admin to add it to `projects.txt` and trigger a sync, or wait for the next push to `main`.

### Agents/skills not updating after git pull

1. Check the hook is installed: `ls -la .git/hooks/post-merge`
2. Check for a checksum mismatch warning in the pull output — re-run `bash onboard.sh` if you see one
3. Check that `.claude/` files actually changed in the pull: `git diff --name-only HEAD~1 HEAD | grep .claude`
4. The hook only runs on `git pull` (merge), not `git fetch` or `git rebase`

### Claude Code doesn't see the new agents/skills

Restart Claude Code after syncing. It reads `~/.claude/` at startup.
