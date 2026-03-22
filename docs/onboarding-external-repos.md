# Onboarding: External Repos (Repos You Don't Own)

Use this guide if you work in repos that aren't registered with jkwon-claude-config — repos you don't own, open-source projects, client repos, or any repo where the sync workflow can't push to.

## Prerequisites

- **Claude Code** installed and working (`claude --version` should return a version)
- **Git** installed (`git --version`)
- **Git Bash** if on Windows (comes with Git for Windows — run all commands in Git Bash, not PowerShell or CMD)

## Steps

If you have a local clone of the config repo:

```bash
cd jkwon-claude-config
bash install.sh
```

If you don't have a local clone, you can run `install.sh` from anywhere — it will clone the repo for you:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jykwon91/jkwon-claude-config/main/install.sh)
```

That's it. One command.

## What This Does

1. Clones the config repo to `~/.claude/.config-repo/` (if you ran from a local clone, it uses that instead)
2. Copies all agents, skills, and rules to `~/.claude/`
3. Sets up a **daily auto-sync** that pulls the latest config and updates `~/.claude/` automatically
   - **macOS/Linux:** cron job at 9:00 AM
   - **Windows:** Scheduled Task at 9:00 AM

After setup, your machine will have:

```
~/.claude/
  ├── agents/              ← Global agent definitions (g-review-code.md, etc.)
  ├── skills/              ← Global slash commands (add-preference/, fix-issue/, etc.)
  ├── rules/               ← Global rules (g-react.md, etc.)
  └── .config-repo/        ← Hidden clone of jkwon-claude-config (used by auto-sync)
```

These files are **additive** — they don't replace any existing personal config in `~/.claude/`. They work across all projects on your machine, including repos you don't own.

## Verify It Worked

```bash
ls ~/.claude/agents/
ls ~/.claude/skills/
ls ~/.claude/rules/
```

You should see `.md` files in `agents/`, subdirectories in `skills/`, and `.md` files in `rules/`.

To verify auto-sync is set up:

```bash
# macOS/Linux
crontab -l | grep claude-config-sync

# Windows (Git Bash)
schtasks /query /tn claude-config-sync
```

## How Auto-Sync Works

A daily scheduled job (cron on macOS/Linux, Task Scheduler on Windows) runs at 9:00 AM:

1. Pulls the latest from the config repo (`~/.claude/.config-repo/`)
2. Re-runs `install.sh` to copy updated agents, skills, and rules to `~/.claude/`

No manual steps needed after the initial install.

## How This Differs from Owned Repos

| | Owned repos (`onboard.sh`) | External repos (`install.sh`) |
|-|---------------------------|-------------------------------|
| How updates arrive | `git pull` in the project triggers sync | Daily scheduled job pulls config repo |
| Gets global preferences in CLAUDE.md | Yes — injected by GitHub Action | No — no write access to the project |
| Agents/skills in `~/.claude/` | Yes | Yes |
| Needs a clone of the config repo | No | Yes, but hidden in `~/.claude/.config-repo/` |

## Important Notes

- You only run `install.sh` once — the daily sync handles everything after that.
- The config repo clone in `~/.claude/.config-repo/` is managed automatically. Don't modify it.
- Global preferences (the rules in `CLAUDE.md`) won't be in external repos — but agents, skills, and rules in `~/.claude/` still work everywhere.
- If you also work in owned repos, you can use both methods. They install to the same `~/.claude/` directory and won't conflict.

## Uninstalling

To remove all shared config, the auto-sync job, and the hidden repo clone:

```bash
bash ~/.claude/.config-repo/uninstall.sh
```

Or if you have a local clone:

```bash
cd jkwon-claude-config
bash uninstall.sh
```

See [Uninstalling](uninstalling.md) for full details.

## Troubleshooting

### `install.sh` fails to clone the repo

The config repo may be private. You need git credentials configured (SSH key or HTTPS token) with access to `jykwon91/jkwon-claude-config`.

### Agents not updating

1. Check auto-sync is scheduled:
   - macOS/Linux: `crontab -l | grep claude-config-sync`
   - Windows: `schtasks /query /tn claude-config-sync`
2. Check the hidden repo is up to date: `git -C ~/.claude/.config-repo log --oneline -1`
3. Run `install.sh` manually to force an update

### Claude Code doesn't see the new agents/skills

Restart Claude Code after syncing. It reads `~/.claude/` at startup.
