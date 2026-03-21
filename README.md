# jkwon-claude-config

Shared Claude Code configuration for all projects. Contains global agents, skills, rules, and preferences that are automatically synced to registered project repos.

## Quick Start

**If your project repo is registered** (has `onboard.sh` in its root):

```bash
cd <project>
bash onboard.sh
```

**If your project repo is NOT registered** (you don't own it, or it hasn't been set up):

```bash
git clone git@github.com:jykwon91/jkwon-claude-config.git
cd jkwon-claude-config
bash install.sh
```

Both methods install agents, skills, and rules to `~/.claude/` and set up auto-sync on future `git pull`s. See [Developer Onboarding](docs/onboarding.md) for full details.

**To uninstall:**

```bash
bash uninstall.sh
```

## How It Works

This repo is the **single source of truth** for Claude Code configuration. There are two distribution channels:

1. **GitHub Action → Project Repos** — When changes are pushed to `main`, a GitHub Action syncs agents, skills, preferences, and hooks to every repo listed in `projects.txt`. Requires write access to the target repos.
2. **Direct install → Developer Machine** — Developers who clone this config repo run `install.sh` once. A post-merge hook auto-syncs `~/.claude/` on future `git pull`s. Works for any project, including repos you don't own.

```
1. Developer edits agents/skills/preferences in this repo
2. Opens PR → merges to main
3. GitHub Action syncs changes to all registered project repos
4. Developers run `git pull` (in the project repo or this config repo)
5. post-merge hook detects changes and copies them to ~/.claude/
6. Claude Code picks up the new config on next session
```

## Structure

```
jkwon-claude-config/
  ├── agents/              — Global subagent definitions
  ├── skills/              — Global slash command skills
  ├── rules/               — Global rules files
  ├── hooks/post-merge     — Git hook template for registered project repos
  ├── global-preferences.md — Engineering preferences injected into project CLAUDE.md files
  ├── projects.txt         — Registry of repos that receive syncs (repos you own)
  ├── install.sh           — Install to ~/.claude/ + set up auto-sync (works for any repo)
  ├── uninstall.sh         — Remove all config installed by this repo
  ├── onboard.sh           — One-time setup for registered project repos
  └── .github/workflows/sync.yml
```

## Guides

| Guide | Audience | Description |
|-------|----------|-------------|
| [Onboarding: Owned Repos](docs/onboarding-owned-repos.md) | Developers | Setup for project repos your team owns |
| [Onboarding: External Repos](docs/onboarding-external-repos.md) | Developers | Setup for repos you don't own |
| [Uninstalling](docs/uninstalling.md) | Developers | Remove all config from your machine |
| [Admin Setup](docs/admin.md) | Repo admins | PAT creation, secrets, registering new projects |
| [Contributing](docs/contributing.md) | Everyone | Adding agents, skills, preferences, and rules |
