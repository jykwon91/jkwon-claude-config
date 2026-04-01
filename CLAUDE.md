# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repo is the shared Claude Code configuration for all projects. It contains global agents, skills, rules, and preferences. Changes here are automatically synced to registered project repos via GitHub Action, and to developer machines via `install.sh` or the `post-merge` hook set up by `onboard.sh`.

## Ownership

**Maintainers:** @jykwon91 (primary), plus anyone listed in the `CODEOWNERS` file if it exists.

The following files are owned by maintainers and must not be modified by automated processes (auto-capture, agents, scripts) or other contributors without explicit approval:

- `CLAUDE.md` — repo rules and structure
- `global-preferences.md` — universal engineering preferences
- `install.sh`, `onboard.sh`, `uninstall.sh` — installation scripts
- `stacks.md` — stack profiles and discovery questions
- `projects.txt` — registered project registry

**Files that CAN be modified via automated PRs** (e.g., auto-capture from technical users):
- `stacks/*.md` — stack-specific guides (react.md, python.md, etc.)

When creating automated PRs to `stacks/*.md`, request review from a maintainer. If a `CODEOWNERS` file exists, GitHub will auto-assign the right reviewer.

## Workflow

- Never push directly to main — always create a feature branch and open a PR, even for single-file changes.
- Always check if a PR has been merged before pushing additional commits to a branch.
- Branch naming: `feature/<dev>/<name>`, `fix/<dev>/<name>`, `stack/<dev>-<name>` — where `<dev>` is a short developer identifier derived from `git config user.name` (e.g., lowercase, hyphenated, max 15 chars). This prevents branch collisions when multiple developers work on the same project.

## Structure

- `agents/` — Global subagent definitions (copied to `~/.claude/agents/`)
- `skills/` — Global slash command skills (copied to `~/.claude/skills/`)
- `rules/` — Global rules, auto-loaded for all projects (copied to `~/.claude/rules/`)
- `stacks/` — Stack-specific guides (react.md, python.md, fastapi.md) loaded conditionally by agents (copied to `~/.claude/stacks/`)
- `stacks.md` — Discovery questions and stack profiles for greenfield projects
- `global-preferences.md` — Universal engineering preferences injected into each project's `CLAUDE.md`
- `hooks/post-merge` — Git hook template that auto-syncs `~/.claude/` on `git pull`
- `onboard.sh` — One-time developer setup (installs the post-merge hook in a project repo)
- `install.sh` — Direct install of agents/skills/rules to `~/.claude/`
- `uninstall.sh` — Removes all config installed by this repo from `~/.claude/`
- `projects.txt` — Registry of project repos that receive syncs

## Installing

```bash
bash install.sh
```

Re-run after pulling changes to update.

## Uninstalling

```bash
bash uninstall.sh
```

Removes only the agents, skills, and rules that came from this repo. Also removes the post-merge hook if run from within a project repo. Does not touch personal config.

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
