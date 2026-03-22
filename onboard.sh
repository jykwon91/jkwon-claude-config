#!/bin/bash
# onboard.sh — one-time setup per machine per project
# 1. Bootstraps global config (junctions + global git hook) if not already set up
# 2. Installs a per-project post-merge hook for config sync visibility
# Works on Windows (Git Bash), macOS, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"

if [ -z "$REPO_ROOT" ]; then
  echo "Error: must be run from within a git repository."
  exit 1
fi

echo "Onboarding $(basename "$REPO_ROOT")..."
echo ""

# --- Step 1: Bootstrap global config if needed ---
# Check if ~/.claude/agents is already a junction/symlink to the config repo
DEST="$HOME/.claude"
if [ -L "$DEST/agents" ] || [ "$(powershell -Command "(Get-Item '$DEST\agents').Attributes -band [IO.FileAttributes]::ReparsePoint" 2>/dev/null)" = "True" ]; then
  echo "[1/2] Global config already set up (junctions exist)."
else
  echo "[1/2] Setting up global config (first time on this machine)..."
  bash "$SCRIPT_DIR/install.sh"
fi

# --- Step 2: Install per-project post-merge hook ---
HOOK_SRC="$SCRIPT_DIR/hooks/post-merge"
HOOK_DEST="$REPO_ROOT/.git/hooks/post-merge"

if [ ! -f "$HOOK_SRC" ]; then
  echo "Error: hook template not found at $HOOK_SRC"
  exit 1
fi

cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"
echo "[2/2] Post-merge hook installed for $(basename "$REPO_ROOT")."

# --- Done ---
echo ""
echo "Done. Every git pull on this project will now:"
echo "  - Sync the global Claude config repo"
echo "  - Show what changed"
echo ""
echo "Restart Claude Code for changes to take effect."
