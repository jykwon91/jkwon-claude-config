# jkwon-claude-config

Shared Claude Code configuration for all projects. Contains global agents and skills that are automatically synced to registered project repos.

## How It Works

Agents and skills live here as the source of truth. When changes are pushed to this repo, a GitHub Action automatically pushes the updated files to `.claude/agents/` and `.claude/skills/` in every registered project. Developers get the latest agents with a normal `git pull` — no setup steps required.

## Structure

- `agents/` — Global subagent definitions
- `skills/` — Global slash command skills
- `projects.txt` — Registry of project repos that receive agent/skill syncs
- `install.sh` — Installs agents/skills to `~/.claude/` on your local machine (for personal use)
- `.github/workflows/sync.yml` — GitHub Action that syncs agents/skills to registered projects on push

## Registering a New Project

Add the repo to `projects.txt` and push. See [SETUP.md](SETUP.md) for PAT requirements and notes on external repos.

## Adding a New Agent

Create `agents/<name>.md` with this frontmatter:

```yaml
---
name: agent-name
description: One sentence — when Claude should use this agent
tools: Read, Grep, Glob
model: sonnet
---
```

Push to main — the GitHub Action will sync it to all registered projects automatically.

## Adding a New Skill

Create `skills/<name>/SKILL.md` with:

```yaml
---
name: skill-name
description: When this skill should be invoked
argument-hint: "[optional-arg]"
---
```

Push to main — the GitHub Action will sync it to all registered projects automatically.
