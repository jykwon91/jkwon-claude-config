# jkwon-claude-config

Shared Claude Code configuration for all projects. Contains global agents, skills, rules, and preferences that are automatically synced to registered project repos.

## How It Works

This repo is the **single source of truth** for Claude Code configuration. There are two distribution channels:

1. **GitHub Action → Project Repos** — When changes are pushed to `main`, a GitHub Action syncs agents, skills, preferences, and hooks to every repo listed in `projects.txt`.
2. **Developer Machine** — Config is copied to `~/.claude/` either manually (`install.sh`) or automatically on every `git pull` via a post-merge hook (`onboard.sh`).

```
1. Developer edits agents/skills/preferences in this repo
2. Opens PR → merges to main
3. GitHub Action syncs changes to all project repos
4. Developers run `git pull` in their project
5. post-merge hook detects .claude/ changes and copies them to ~/.claude/
6. Claude Code picks up the new config on next session
```

## Structure

```
jkwon-claude-config/
  ├── agents/              — Global subagent definitions
  ├── skills/              — Global slash command skills
  ├── rules/               — Global rules files
  ├── hooks/post-merge     — Git hook template for auto-sync
  ├── global-preferences.md — Engineering preferences injected into project CLAUDE.md files
  ├── projects.txt         — Registry of repos that receive syncs
  ├── install.sh           — Direct install to ~/.claude/
  ├── uninstall.sh         — Remove all config installed by this repo
  ├── onboard.sh           — One-time post-merge hook setup
  └── .github/workflows/sync.yml
```

## Guides

| Guide | Audience | Description |
|-------|----------|-------------|
| [Developer Onboarding](docs/onboarding.md) | Developers | Install config, set up auto-sync, uninstall |
| [Admin Setup](docs/admin.md) | Repo admins | PAT creation, secrets, registering new projects |
| [Contributing](docs/contributing.md) | Everyone | Adding agents, skills, preferences, and rules |
