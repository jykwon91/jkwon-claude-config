# Onboarding: Repos You Own

Use this guide if you're working in a project repo that your team owns and has registered with jkwon-claude-config (i.e., it's listed in `projects.txt` and has `onboard.sh` in its root).

## Prerequisites

- **Claude Code** installed and working (`claude --version` should return a version)
- **Git** installed (`git --version`)
- **Git Bash** if on Windows (comes with Git for Windows — run all commands in Git Bash, not PowerShell or CMD)
- The project repo has been registered by an admin (see [Admin Setup](admin.md))

## Steps

```bash
git clone <project-repo>
cd <project>
bash onboard.sh
```

That's it. One command.

## What This Does

1. Installs a `post-merge` git hook in the project's `.git/hooks/`
2. Stores a SHA-256 checksum of the hook for integrity verification
3. Runs an **initial sync** — copies agents and skills from the project's `.claude/` to `~/.claude/` immediately

After setup, your machine will have:

```
~/.claude/
  ├── agents/              ← Global agent definitions (g-review-code.md, etc.)
  ├── skills/              ← Global slash commands (add-preference/, fix-issue/, etc.)
  └── rules/               ← Global rules (react.md, etc.)
```

These files are **additive** — they don't replace any existing personal config in `~/.claude/`.

## Verify It Worked

```bash
ls ~/.claude/agents/
ls ~/.claude/skills/
```

You should see `.md` files in `agents/` and subdirectories in `skills/`. If these directories are empty, the project may not have been synced from jkwon-claude-config yet — ask an admin to check.

## How Auto-Sync Works

Every `git pull` in this project will:

1. Verify the hook file hasn't been tampered with (checksum check)
2. Check if any `.claude/` files changed in the pull
3. If yes, copy updated agents and skills from the project's `.claude/` to `~/.claude/`
4. Print a message: `[claude-config] Sync complete. Restart Claude Code if it is running.`

If nothing in `.claude/` changed, the hook exits silently. No manual steps needed after onboarding.

## Important Notes

- Run `onboard.sh` **once per project per machine**. If you work on multiple registered projects, run it in each one.
- If you switch to a new machine, run `onboard.sh` again on the new machine.
- If you see `WARNING: post-merge hook checksum mismatch` after a pull, the hook template was updated. Re-run `bash onboard.sh` to install the new version.

## Uninstalling

To remove all shared config and the post-merge hook:

```bash
cd <project>
bash uninstall.sh
```

See [Uninstalling](uninstalling.md) for full details.

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
