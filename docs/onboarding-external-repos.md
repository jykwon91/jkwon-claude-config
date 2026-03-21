# Onboarding: External Repos (Repos You Don't Own)

Use this guide if you work in repos that aren't registered with jkwon-claude-config — repos you don't own, open-source projects, client repos, or any repo where the sync workflow can't push to.

## Prerequisites

- **Claude Code** installed and working (`claude --version` should return a version)
- **Git** installed (`git --version`)
- **Git Bash** if on Windows (comes with Git for Windows — run all commands in Git Bash, not PowerShell or CMD)
- Access to clone `jykwon91/jkwon-claude-config` (this repo)

## Steps

```bash
git clone git@github.com:jykwon91/jkwon-claude-config.git
cd jkwon-claude-config
bash install.sh
```

That's it. One command after cloning.

## What This Does

1. Creates `~/.claude/agents/`, `~/.claude/skills/`, and `~/.claude/rules/` if they don't exist
2. Copies all agent, skill, and rule files to `~/.claude/`
3. Installs a `post-merge` hook **in this config repo** so future `git pull`s auto-sync

After setup, your machine will have:

```
~/.claude/
  ├── agents/              ← Global agent definitions (g-review-code.md, etc.)
  ├── skills/              ← Global slash commands (add-preference/, fix-issue/, etc.)
  └── rules/               ← Global rules (react.md, etc.)
```

These files are **additive** — they don't replace any existing personal config in `~/.claude/`. They work across all projects on your machine, including repos you don't own.

## Verify It Worked

```bash
ls ~/.claude/agents/
ls ~/.claude/skills/
ls ~/.claude/rules/
```

You should see `.md` files in `agents/`, subdirectories in `skills/`, and `.md` files in `rules/`.

## How Auto-Sync Works

After running `install.sh` once, pull this config repo to get updates:

```bash
cd jkwon-claude-config
git pull
```

The post-merge hook detects changes to `agents/`, `skills/`, or `rules/` and re-runs `install.sh` automatically. No manual steps needed.

## How This Differs from Owned Repos

| | Owned repos (`onboard.sh`) | External repos (`install.sh`) |
|-|---------------------------|-------------------------------|
| Where the hook lives | In the project repo's `.git/hooks/` | In this config repo's `.git/hooks/` |
| What triggers sync | `git pull` in the project repo | `git pull` in this config repo |
| Gets global preferences in CLAUDE.md | Yes — injected by GitHub Action | No — no write access to the project |
| Agents/skills in `~/.claude/` | Yes | Yes |
| Need to keep this config repo cloned | No | Yes — it's where the hook lives |

## Important Notes

- You only need to run `install.sh` once — the hook handles future updates.
- Keep this config repo cloned somewhere on your machine. The auto-sync depends on pulling it.
- If you re-clone this repo on a new machine, run `install.sh` again.
- The hook only triggers on `git pull` (merge), not `git fetch` or `git rebase`.
- Global preferences (the rules in `CLAUDE.md`) won't be in external repos — but agents, skills, and rules in `~/.claude/` still work everywhere.

## Uninstalling

To remove all shared config and the post-merge hook:

```bash
cd jkwon-claude-config
bash uninstall.sh
```

See [Uninstalling](uninstalling.md) for full details.

## Troubleshooting

### `install.sh` says agents were installed but I don't see them

Check the destination:

```bash
ls ~/.claude/agents/
```

If empty, check that this config repo has files in `agents/`:

```bash
ls agents/
```

If `agents/` is also empty, pull the latest from this config repo: `git pull`

### Auto-sync not working after git pull

1. Check the hook exists: `ls -la .git/hooks/post-merge`
2. If missing, re-run `bash install.sh`
3. Check that `agents/`, `skills/`, or `rules/` actually changed in the pull: `git diff --name-only HEAD~1 HEAD`

### Claude Code doesn't see the new agents/skills

Restart Claude Code after syncing. It reads `~/.claude/` at startup.
