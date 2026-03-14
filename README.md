# jkwon-claude-config

Shared Claude Code configuration for all projects. Contains global agents and skills that are automatically synced to registered project repos.

## How It Works

Agents and skills live here as the source of truth. When changes are pushed to this repo, a GitHub Action automatically pushes the updated files to `.claude/agents/` and `.claude/skills/` in every registered project. Developers get the latest agents with a normal `git pull` — no setup steps required.

## Structure

- `agents/` — Global subagent definitions
- `skills/` — Global slash command skills
- `hooks/` — Git hook templates synced to registered projects
- `projects.txt` — Registry of project repos that receive agent/skill syncs
- `onboard.sh` — One-time developer setup script (installs the post-merge hook)
- `install.sh` — Installs agents/skills to `~/.claude/` on your local machine (for personal use)
- `.github/workflows/sync.yml` — GitHub Action that syncs agents/skills to registered projects on push

## Initial Setup

### 1. Create a PAT

The GitHub Action needs a Personal Access Token with write access to all registered repos.

1. Go to GitHub > avatar menu > **Settings**
2. Scroll to **Developer settings** > **Personal access tokens** > **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Name it `claude-config-sync`, check the `repo` scope
5. Click **Generate token** and copy it — you only see it once

### 2. Add the PAT as a Secret

1. Go to `github.com/jykwon91/jkwon-claude-config` > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `SYNC_TOKEN`, Value: paste the token
4. Click **Add secret**

## Developer Onboarding (One Time Per Machine)

When a developer joins a project, they run `onboard.sh` once from the project directory:

```bash
git clone <project-repo>
cd <project>
bash onboard.sh
```

This installs a `post-merge` hook that automatically syncs Claude agents and skills to `~/.claude/` after every `git pull`. The hook verifies its own checksum before running — if it has been tampered with, it warns and skips.

## Registering a New Project

Add the repo to `projects.txt` and push:

```
jykwon91/MyBookkeeper
jykwon91/your-new-project
```

The GitHub Action will sync agents, skills, and `onboard.sh` to the new project automatically.

**PAT access notes:**
- Your own repos — covered by the `repo` scope
- Org repos — PAT owner needs write access; may need SSO authorization under GitHub > Settings > Personal access tokens > **Configure SSO**
- Others' repos — only works if the PAT owner has been granted write access

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

Push to main via PR — the GitHub Action will sync it to all registered projects automatically.

## Adding a New Skill

Create `skills/<name>/SKILL.md` with:

```yaml
---
name: skill-name
description: When this skill should be invoked
argument-hint: "[optional-arg]"
---
```

Push to main via PR — the GitHub Action will sync it to all registered projects automatically.
