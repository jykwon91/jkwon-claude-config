---
name: sync-copilot
description: Sync the Claude Code global config to GitHub Copilot CLI format. Generates copilot-compatible agents, skills, instructions, and install scripts from the current Claude Code config.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

Sync the Claude Code global config to GitHub Copilot CLI format. This generates/updates all files in the `copilot/` directory from the current source of truth in `agents/`, `skills/`, `global-preferences.md`, and `stacks/`.

## Source of truth → Copilot output

| Source (Claude Code) | Output (Copilot CLI) |
|---|---|
| `agents/*.md` | `copilot/agents/*.agent.md` |
| `skills/*/SKILL.md` | `copilot/skills/*/SKILL.md` |
| `global-preferences.md` | `copilot/copilot-instructions.md` (preferences section) |
| `stacks/*.md` | `copilot/copilot-instructions.md` (stack guides section) |

## Step 1: Read all sources

1. Read every file in `agents/` — these are the canonical agent definitions
2. Read `global-preferences.md` — engineering preferences
3. Read every file in `stacks/` — stack-specific guides (react.md, python.md, fastapi.md, etc.)
4. Read every `skills/*/SKILL.md` — skill definitions
5. Note which skills are Copilot-compatible (fix-issue, review-pr, session-start, cleanup-branches) vs config-repo-only (add-preference, update-preference, delete-preference, sync-copilot)

## Step 2: Convert agents

For each agent in `agents/`:

1. Read the Claude Code agent file (YAML frontmatter + markdown body)
2. Create a Copilot-compatible version at `copilot/agents/<name>.agent.md`:
   - **Frontmatter**: Convert to Copilot format:
     ```yaml
     ---
     description: "<same description>"
     tools: ["read", "search", "edit", "execute", "agent"]
     ---
     ```
   - **Tools mapping**: Claude Code tools → Copilot tools:
     - `Read, Grep, Glob` → `["read", "search"]`
     - `+ Bash` → add `"execute"`
     - `+ Edit, Write` → add `"edit"`
     - `+ WebSearch, WebFetch` → add `"web"`
     - Agent tool (ability to invoke sub-agents) → add `"agent"`
   - **Body**: Adapt the markdown body:
     - Remove `model:` from frontmatter (Copilot doesn't support model pinning)
     - Replace "Read `CLAUDE.md`" with "Read project instructions" (generic)
     - Replace `~/.claude/stacks/` with `~/.copilot/stacks/` or just "stack guides"
     - Keep all instructions, rules, and workflow steps intact
     - Keep the "(skip if project context provided)" annotation on Step 0

3. **Delete stale Copilot agents**: List all files in `copilot/agents/`. If any `.agent.md` file has no corresponding `agents/<name>.md` in the source, delete it.

## Step 3: Convert skills

For each skill in `skills/` that is Copilot-compatible:

1. Copy `skills/<name>/SKILL.md` to `copilot/skills/<name>/SKILL.md`
2. Adapt frontmatter: remove `allowed-tools:` (Copilot doesn't use this)
3. Replace any Claude Code-specific references with generic equivalents

**Skip these skills** (they depend on Claude Code infrastructure):
- `add-preference`, `update-preference`, `delete-preference` (manage config repo PRs)
- `sync-copilot` (this skill itself)

**Delete stale Copilot skills**: Remove any skill directory in `copilot/skills/` that no longer exists in the source (excluding the skipped ones above).

## Step 4: Generate copilot-instructions.md

Generate `copilot/copilot-instructions.md` by combining:

1. **Preferences section**: Read `global-preferences.md` and format as the "Software Engineering Preferences" section. Group by category (Code Quality, Typing & Structure, Architecture, Testing, Security, UX Patterns, Data Integrity, Refactoring, Workflow).

2. **Agents table**: Generate an "Available Agents" section listing all agents from Step 2, grouped by category (Pipeline & Orchestration, Design, Implementation, Review, Testing, Security & Debugging, Project Health). Format as markdown tables with Agent name and Purpose columns.

3. **Skills table**: Generate an "Available Skills" section listing all Copilot-compatible skills from Step 3.

4. **Stack guides**: For each file in `stacks/`, extract the key patterns and include as a condensed stack guide section. Group by severity (CRITICAL, HIGH, MEDIUM). Keep it concise — one-line summaries per pattern, not full paragraphs.

## Step 5: Generate install.sh

Generate `copilot/install.sh` — a local installer that:
1. Copies `copilot-instructions.md` to `~/.github/copilot-instructions.md`
2. Copies all agent files from `copilot/agents/` to `~/.copilot/agents/`
3. Copies all skill directories from `copilot/skills/` to `~/.copilot/skills/`
4. **Handles updates**: Deletes any agents in `~/.copilot/agents/` that no longer exist in the source (so removed agents get cleaned up on re-install)
5. Reports counts of agents and skills installed

## Step 6: Generate setup-copilot.sh

Generate `copilot/setup-copilot.sh` — a **standalone portable installer** that:
1. Embeds ALL agent definitions and skill definitions as heredocs inside the script
2. Can be transferred to any machine and run without the config repo
3. Creates directories, writes all files, reports results
4. Handles both fresh install and update (idempotent — overwrites existing files, removes stale ones)

This is the largest file — it contains the full content of every agent and skill embedded in the script.

## Step 7: Update README.md

Update `copilot/README.md` with:
- Current agent count and list
- Current skill count and list
- Installation instructions (both install.sh and setup-copilot.sh methods)
- What's NOT included (and why): preference management skills, auto-capture rule, memory system, model pinning, config sync

## Step 8: Commit and PR

1. Stage all changes in `copilot/`
2. Create branch: `chore/sync-copilot`
3. Commit with message: `chore: sync Copilot CLI config from Claude Code agents`
4. Push and create PR

## Important rules

- The `copilot/` directory is a GENERATED output — never edit it directly. Always edit the source files in `agents/`, `skills/`, `global-preferences.md`, or `stacks/`, then run this skill to regenerate.
- Keep Copilot agent descriptions identical to Claude Code agent descriptions for consistency.
- Copilot agents should be functionally equivalent to Claude Code agents — same workflow, same rules, same quality bar. The only differences are format (frontmatter) and references to Claude-specific paths.
