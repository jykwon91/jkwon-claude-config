# Contributing Agents, Skills, Preferences, and Rules

This guide covers how to add or modify shared Claude Code configuration. All changes go through PRs to `main` — the GitHub Action handles distribution to all projects.

## Prerequisites

- This repo cloned locally
- Familiarity with Claude Code agent/skill markdown format
- For testing locally before pushing: run `bash install.sh` to install your changes to `~/.claude/`

---

## Adding a New Agent

### Steps

1. Create `agents/<name>.md` with this frontmatter:

   ```yaml
   ---
   name: agent-name
   description: One sentence — when Claude should use this agent
   tools: Read, Grep, Glob   # restrict to what the agent actually needs
   model: sonnet
   ---
   ```

2. Write the agent's system prompt in the body of the file

3. Test locally:
   ```bash
   bash install.sh
   ```
   Restart Claude Code and verify the agent appears and works as expected.

4. Open a PR to `main`. Once merged, the GitHub Action syncs it to all registered projects.

### Naming convention

Agent files are named `g-<category>-<name>.md`. Current categories:

- `g-audit-*` — project auditing (security, full project)
- `g-debug-*` — bug investigation
- `g-design-*` — design review (architecture, data, security, UX, libraries)
- `g-implement-*` — code implementation
- `g-pre-commit` — pre-commit checks
- `g-review-*` — code review (backend, frontend, general)
- `g-write-*` — test writing

### Tool restrictions

Only grant the tools the agent actually needs. Common sets:

- **Read-only agents** (reviewers, auditors): `Read, Grep, Glob`
- **Agents that run commands** (test runners, debuggers): `Read, Grep, Glob, Bash`
- **Agents that edit code** (implementers): `Read, Grep, Glob, Bash, Edit, Write`

---

## Adding a New Skill

### Steps

1. Create the directory `skills/<name>/`

2. Create `skills/<name>/SKILL.md` with this frontmatter:

   ```yaml
   ---
   name: skill-name
   description: When this skill should be invoked
   argument-hint: "[optional-arg]"
   ---
   ```

3. Write the skill's prompt template in the body of the file

4. Test locally:
   ```bash
   bash install.sh
   ```
   Restart Claude Code and invoke with `/<name>`.

5. Open a PR to `main`. Once merged, the GitHub Action syncs it to all registered projects.

### How skills work

Skills are slash commands. When a user types `/<name>` in Claude Code, the contents of `SKILL.md` are expanded into the conversation as a prompt. The `argument-hint` shows in the autocomplete to hint at expected arguments.

---

## Adding a New Rule

### Steps

1. Create `rules/<name>.md` with the rule content. Rules are plain markdown — no frontmatter required.

2. Test locally:
   ```bash
   bash install.sh
   ```
   Restart Claude Code to verify.

3. Open a PR to `main`.

### How rules work

Rules in `~/.claude/rules/` are loaded into every Claude Code conversation as system-level instructions. Use them for language-specific or framework-specific best practices that should apply across all projects.

---

## Managing Global Preferences

Global preferences live in `global-preferences.md`. They are injected into each project's `CLAUDE.md` between marker comments, so Claude Code reads them as project-level instructions.

### Adding a preference manually

1. Open `global-preferences.md`
2. Add a new bullet under the relevant section:
   ```markdown
   ## Global Software Engineering Preferences
   - Your new preference here
   ```
3. Open a PR to `main`. Once merged, the GitHub Action syncs it to all projects.

### Using the slash commands

You can manage preferences through Claude Code without editing files directly:

| Command | What it does |
|---------|-------------|
| `/add-preference` | Proposes a new preference and opens a PR |
| `/update-preference` | Finds and updates an existing preference via PR |
| `/delete-preference` | Finds and removes a preference via PR |

### Adding a new preference category

If your preference doesn't fit an existing section, add a new heading:

```markdown
## Global Testing Preferences
- Test behavior, not implementation.
```

There are no restrictions on categories — use a clear heading that describes the type.

### Overriding a global preference in a project

If a specific project disagrees with a global preference, add an override in the project's `CLAUDE.md` below the end marker:

```markdown
<!-- END GLOBAL PREFERENCES — To override any of the above for this project, add your instructions below this line. -->

## Project Overrides
- Always add JSDoc comments to all public functions.
```

Claude Code reads the full file top to bottom. Project-specific instructions placed after the global block take precedence. The global block itself is managed by the sync — developers should never edit content between the markers.

---

## Removing an Agent, Skill, or Rule

### Steps

1. Delete the file (or directory for skills) from this repo
2. Open a PR to `main`

### Important: deletion does not propagate automatically

The sync workflow **copies** files — it does not delete files that were removed from the source. After merging:

1. Manually delete the file from each project repo's `.claude/agents/` or `.claude/skills/` directory (or open a PR to do so)
2. Developers who already have the file in `~/.claude/` will keep it until they run `bash uninstall.sh` and then `bash onboard.sh` again, or manually delete the file

---

## Testing Changes Locally

Before opening a PR, verify your changes work:

```bash
# Install your changes to ~/.claude/
bash install.sh

# Restart Claude Code (close and reopen, or start a new session)

# Verify agents are loaded — check that your agent appears
# Verify skills work — type /<skill-name> in Claude Code
# Verify rules are active — they should influence Claude's responses
```

If something isn't working, check:
- Frontmatter syntax (YAML between `---` markers)
- File is in the correct directory (`agents/`, `skills/<name>/`, or `rules/`)
- Claude Code was restarted after installing
