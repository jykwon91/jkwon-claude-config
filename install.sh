#!/bin/bash
# Installs shared Claude agents and skills to ~/.claude
# Works on Windows (Git Bash), macOS, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude"

echo "Installing Claude shared config to $DEST..."

# Create destination directories
mkdir -p "$DEST/agents" "$DEST/skills"

# Install agents
if [ -d "$SCRIPT_DIR/agents" ]; then
  cp "$SCRIPT_DIR/agents/"*.md "$DEST/agents/"
  echo "  Agents installed: $(ls "$SCRIPT_DIR/agents/"*.md | xargs -n1 basename | tr '\n' ' ')"
fi

# Install skills (each skill is a subdirectory with SKILL.md)
if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_dir in "$SCRIPT_DIR/skills"/*/; do
    skill_name=$(basename "$skill_dir")
    mkdir -p "$DEST/skills/$skill_name"
    cp "$skill_dir/SKILL.md" "$DEST/skills/$skill_name/SKILL.md"
    echo "  Skill installed: $skill_name"
  done
fi

echo ""
echo "Done. Restart Claude Code for changes to take effect."
