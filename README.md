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

Add the repo to `projects.txt`:

```
jykwon91/MyBookkeeper
jykwon91/your-new-project
```

On the next push to this repo, the GitHub Action will automatically sync agents and skills to the new project.

## Required Setup (One Time)

The GitHub Action needs a Personal Access Token (PAT) with write access to all registered repos.

**Step 1 — Create a PAT:**
1. Go to GitHub > avatar menu > **Settings**
2. Scroll to **Developer settings** > **Personal access tokens** > **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Name it `claude-config-sync`
5. Check the `repo` scope (full access)
6. Click **Generate token** and copy it — you only see it once

**Step 2 — Add it as a secret in this repo:**
1. Go to `github.com/jykwon91/jkwon-claude-config` > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `SYNC_TOKEN`
4. Value: paste the token
5. Click **Add secret**

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
