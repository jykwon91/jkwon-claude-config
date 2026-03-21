# Uninstalling / Rollback

This guide covers how to remove all shared Claude Code config from your machine.

## Steps

```bash
bash uninstall.sh
```

Run it from this config repo or from any project repo that has the script.

## What It Removes

- All agent files from `~/.claude/agents/` that match files in this repo
- All skill directories from `~/.claude/skills/` that match directories in this repo
- All rule files from `~/.claude/rules/` that match files in this repo
- The `post-merge` hook and its checksum from the current repo's `.git/hooks/`

## What It Does NOT Touch

- Any personal config files in `~/.claude/` that weren't installed by this repo
- Project-level `.claude/` directories (those are managed by git)
- The `~/.claude/` directory itself
- Global preferences already in project `CLAUDE.md` files (those are part of git history)

## If You Have Multiple Onboarded Projects

`uninstall.sh` only removes the hook from the repo you run it in. To remove hooks from all projects, run it in each one:

```bash
cd ~/projects/project-a && bash uninstall.sh
cd ~/projects/project-b && bash uninstall.sh
cd ~/jkwon-claude-config && bash uninstall.sh
```

## Removing Global Preferences from a Project's CLAUDE.md

Global preferences are injected between marker comments. To remove them, delete everything between (and including) these lines:

```
<!-- BEGIN GLOBAL PREFERENCES -->
...
<!-- END GLOBAL PREFERENCES — To override any of the above for this project, add your instructions below this line. -->
```

This is a manual edit — `uninstall.sh` does not modify project files.

## Verify Uninstall Worked

```bash
ls ~/.claude/agents/    # should be empty or missing the shared agents
ls ~/.claude/skills/    # should be empty or missing the shared skills
ls ~/.claude/rules/     # should be empty or missing the shared rules
ls .git/hooks/post-merge  # should say "No such file or directory"
```
