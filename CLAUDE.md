# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repo is the shared Claude Code configuration for all projects. It contains global agents, skills, and an install script that populates `~/.claude/`.

## Structure

- `agents/` — Global subagent definitions (copied to `~/.claude/agents/`)
- `skills/` — Global slash command skills (copied to `~/.claude/skills/`)
- `install.sh` — Run this to sync agents/skills to `~/.claude/`

## Installing

```bash
bash install.sh
```

Re-run after pulling changes to update.

## Adding a new agent

Create `agents/<name>.md` with this frontmatter:

```yaml
---
name: agent-name
description: One sentence — when Claude should use this agent
tools: Read, Grep, Glob   # restrict to what the agent actually needs
model: sonnet
---
```

Run `bash install.sh` to deploy it.

## Adding a new skill

Create `skills/<name>/SKILL.md` with:

```yaml
---
name: skill-name
description: When this skill should be invoked
argument-hint: "[optional-arg]"
---
```

Invoke in Claude Code with `/<name>`.
