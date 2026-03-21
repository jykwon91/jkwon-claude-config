#!/bin/bash
# Removes Claude shared config installed by this repo from ~/.claude
# Also removes the post-merge hook if run from within a project repo
# Works from both the config repo and project repos
# Works on Windows (Git Bash), macOS, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude"
REMOVED=0

# Detect source directories — config repo uses agents/, project repos use .claude/agents/
if [ -d "$SCRIPT_DIR/agents" ]; then
  AGENTS_SRC="$SCRIPT_DIR/agents"
elif [ -d "$SCRIPT_DIR/.claude/agents" ]; then
  AGENTS_SRC="$SCRIPT_DIR/.claude/agents"
else
  AGENTS_SRC=""
fi

if [ -d "$SCRIPT_DIR/skills" ]; then
  SKILLS_SRC="$SCRIPT_DIR/skills"
elif [ -d "$SCRIPT_DIR/.claude/skills" ]; then
  SKILLS_SRC="$SCRIPT_DIR/.claude/skills"
else
  SKILLS_SRC=""
fi

if [ -d "$SCRIPT_DIR/rules" ]; then
  RULES_SRC="$SCRIPT_DIR/rules"
else
  RULES_SRC=""
fi

echo "Removing Claude shared config from $DEST..."
echo ""

# Remove agents that came from this repo
if [ -n "$AGENTS_SRC" ] && [ -d "$DEST/agents" ]; then
  for agent in "$AGENTS_SRC/"*.md; do
    [ -f "$agent" ] || continue
    name=$(basename "$agent")
    if [ -f "$DEST/agents/$name" ]; then
      rm "$DEST/agents/$name"
      echo "  Removed agent: $name"
      REMOVED=$((REMOVED + 1))
    fi
  done
fi

# Remove skills that came from this repo
if [ -n "$SKILLS_SRC" ] && [ -d "$DEST/skills" ]; then
  for skill_dir in "$SKILLS_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    if [ -d "$DEST/skills/$skill_name" ]; then
      rm -rf "$DEST/skills/$skill_name"
      echo "  Removed skill: $skill_name"
      REMOVED=$((REMOVED + 1))
    fi
  done
fi

# Remove rules that came from this repo
if [ -n "$RULES_SRC" ] && [ -d "$DEST/rules" ]; then
  for rule in "$RULES_SRC/"*.md; do
    [ -f "$rule" ] || continue
    name=$(basename "$rule")
    if [ -f "$DEST/rules/$name" ]; then
      rm "$DEST/rules/$name"
      echo "  Removed rule: $name"
      REMOVED=$((REMOVED + 1))
    fi
  done
fi

# Remove post-merge hook if we're inside a git repo
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -n "$REPO_ROOT" ]; then
  HOOK="$REPO_ROOT/.git/hooks/post-merge"
  CHECKSUM="$REPO_ROOT/.git/hooks/post-merge.sha256"
  if [ -f "$HOOK" ]; then
    rm "$HOOK"
    echo "  Removed post-merge hook from $(basename "$REPO_ROOT")"
    REMOVED=$((REMOVED + 1))
  fi
  if [ -f "$CHECKSUM" ]; then
    rm "$CHECKSUM"
    echo "  Removed post-merge checksum from $(basename "$REPO_ROOT")"
  fi
fi

echo ""
if [ "$REMOVED" -eq 0 ]; then
  echo "Nothing to remove — no shared config found."
else
  echo "Removed $REMOVED item(s). Restart Claude Code for changes to take effect."
fi
