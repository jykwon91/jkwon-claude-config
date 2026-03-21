#!/bin/bash
# onboard.sh — one-time setup per machine per project
# Installs the post-merge hook and runs an initial sync of agents/skills to ~/.claude
# Works on Windows (Git Bash), macOS, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
DEST="$HOME/.claude"

if [ -z "$REPO_ROOT" ]; then
  echo "Error: must be run from within a git repository."
  exit 1
fi

HOOK_SRC="$SCRIPT_DIR/hooks/post-merge"
HOOK_DEST="$REPO_ROOT/.git/hooks/post-merge"
CHECKSUM_DEST="$REPO_ROOT/.git/hooks/post-merge.sha256"

if [ ! -f "$HOOK_SRC" ]; then
  echo "Error: hook template not found at $HOOK_SRC"
  echo "Make sure the project has been synced from jkwon-claude-config (check that hooks/post-merge exists)."
  exit 1
fi

echo "Onboarding $(basename "$REPO_ROOT")..."
echo ""

# --- Step 1: Install post-merge hook ---
cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"

# Store checksum for integrity verification
sha256sum "$HOOK_DEST" 2>/dev/null | awk '{print $1}' > "$CHECKSUM_DEST" || \
  shasum -a 256 "$HOOK_DEST" | awk '{print $1}' > "$CHECKSUM_DEST"

echo "[1/2] Post-merge hook installed."
echo "      Future git pulls will auto-sync Claude config to ~/.claude."

# --- Step 2: Initial sync to ~/.claude ---
SYNCED=0

if [ -d "$REPO_ROOT/.claude/agents" ]; then
  mkdir -p "$DEST/agents"
  cp "$REPO_ROOT/.claude/agents/"*.md "$DEST/agents/" 2>/dev/null && SYNCED=1 || true
fi

if [ -d "$REPO_ROOT/.claude/skills" ]; then
  for skill_dir in "$REPO_ROOT/.claude/skills"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    mkdir -p "$DEST/skills/$skill_name"
    cp "$skill_dir/SKILL.md" "$DEST/skills/$skill_name/SKILL.md"
    SYNCED=1
  done
fi

if [ "$SYNCED" -eq 1 ]; then
  echo "[2/2] Agents and skills synced to ~/.claude."
else
  echo "[2/2] No agents or skills found in .claude/ — skipping initial sync."
  echo "      They will sync automatically on your next git pull after the config repo pushes updates."
fi

# --- Done ---
echo ""
echo "Done. Restart Claude Code for changes to take effect."
echo ""
echo "To verify, check that these directories have files:"
echo "  ls ~/.claude/agents/"
echo "  ls ~/.claude/skills/"
