# Copilot CLI Config

Portable version of the Claude Code global config, converted for GitHub Copilot CLI.

## What's included

```
copilot/
  copilot-instructions.md    # Global instructions (-> ~/.github/)
  install.sh                 # One-command installer (with stale cleanup)
  setup-copilot.sh           # Portable single-file installer (all content embedded)
  agents/                    # 24 custom agents (-> ~/.copilot/agents/)
    g-build-feature.agent.md   # End-to-end feature builder
    g-troubleshoot.agent.md    # End-to-end bug fix pipeline
    g-pipeline.agent.md        # Validation pipeline
    g-pre-commit.agent.md      # Pre-commit review orchestrator (with auto-fix)
    g-scaffold.agent.md        # Boilerplate file structure generator
    g-design-*.agent.md        # Design agents (data, architecture, UX, security, etc.)
    g-implement-*.agent.md     # Implementation agents (frontend, backend)
    g-review-*.agent.md        # Code review agents
    g-write-tests.agent.md     # Test writer
    g-diagnose-e2e.agent.md    # E2E failure diagnosis
    g-fix-e2e.agent.md         # E2E fix applicator
    g-audit-security.agent.md  # Security vulnerability audit
    g-debug-bug.agent.md       # Systematic bug debugger
    g-tech-debt-scan.agent.md  # Tech debt auditor
    g-qa.agent.md              # QA agent generator
  skills/                    # 5 skills (-> ~/.copilot/skills/)
    fix-issue/SKILL.md         # End-to-end issue fix
    review-pr/SKILL.md         # PR review workflow
    session-start/SKILL.md     # Session startup dashboard
    cleanup-branches/SKILL.md  # Merged branch cleanup
    codebase-brief/SKILL.md    # Compressed project context summary
```

## Quick setup

### Option 1: From the repo

```bash
bash copilot/install.sh
```

This copies everything to the right locations and cleans up stale agents/skills.

### Option 2: Portable single-file installer

```bash
bash copilot/setup-copilot.sh
```

Transfer `setup-copilot.sh` to any machine -- it has all agents, skills, and instructions embedded as heredocs.

Both options install to:
- `~/.github/copilot-instructions.md` -- global instructions
- `~/.copilot/agents/` -- all custom agents
- `~/.copilot/skills/` -- all skills

Re-run after pulling updates to re-sync.

## Usage

```bash
# Use an agent
copilot> /agent g-build-feature
copilot> "Use g-review-code to review the changes"

# Use fleet mode for parallel agents
copilot> /fleet "Run g-design-data, g-design-architecture, and g-design-ux on this feature"

# Use a skill
copilot> /fix-issue 42
copilot> /review-pr 123
copilot> /session-start
copilot> /cleanup-branches
copilot> /codebase-brief
```

## What didn't migrate from Claude Code

- **Preference management skills** (add/update/delete-preference) -- these manage a shared config repo via PRs
- **Sync-copilot skill** -- this skill itself (generates the copilot/ directory)
- **Auto-capture rule** -- automatically PRs stack practices to the config repo
- **Config sync rule** -- checks for pending config updates at conversation start
- **Memory system** -- persistent cross-conversation context
- **Model pinning** -- `model: opus` / `model: sonnet` in agent frontmatter (not yet supported in Copilot CLI)
  - In Claude Code: g-build-feature, g-troubleshoot, g-pre-commit, g-audit-security, g-debug-bug, g-design-architecture, g-design-data, g-design-security, g-qa, g-tech-debt-scan use opus; all others use sonnet
