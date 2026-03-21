#!/bin/bash
# Installs shared Claude agents, skills, and rules to ~/.claude
# Also installs a post-merge hook so future git pulls auto-sync
# Works on Windows (Git Bash), macOS, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude"

echo "Installing Claude shared config to $DEST..."
echo ""

# Create destination directories
mkdir -p "$DEST/agents" "$DEST/skills" "$DEST/rules"

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

# Install rules
if [ -d "$SCRIPT_DIR/rules" ]; then
  cp "$SCRIPT_DIR/rules/"*.md "$DEST/rules/"
  echo "  Rules installed: $(ls "$SCRIPT_DIR/rules/"*.md | xargs -n1 basename | tr '\n' ' ')"
fi

# Install post-merge hook for auto-sync on git pull
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -n "$REPO_ROOT" ]; then
  HOOK_DEST="$REPO_ROOT/.git/hooks/post-merge"
  if [ ! -f "$HOOK_DEST" ]; then
    cat > "$HOOK_DEST" << 'HOOK'
#!/bin/bash
# Auto-syncs Claude config to ~/.claude after git pull
# Installed by install.sh — do not edit manually
SCRIPT_DIR="$(git rev-parse --show-toplevel)"
if git diff-tree --no-commit-id -r --name-only ORIG_HEAD HEAD 2>/dev/null | grep -qE "^(agents|skills|rules)/"; then
  echo "[claude-config] Changes detected, syncing to ~/.claude..."
  bash "$SCRIPT_DIR/install.sh"
fi
HOOK
    chmod +x "$HOOK_DEST"
    echo ""
    echo "  Auto-sync hook installed. Future git pulls will update ~/.claude automatically."
  fi
fi

echo ""
echo "Done. Restart Claude Code for changes to take effect."
echo ""
echo "To verify, check that these directories have files:"
echo "  ls ~/.claude/agents/"
echo "  ls ~/.claude/skills/"
echo "  ls ~/.claude/rules/"
