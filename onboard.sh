#!/bin/bash
# onboard.sh — one-time setup per machine per project
# Installs the post-merge hook so Claude agents and skills sync automatically on git pull

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"

if [ -z "$REPO_ROOT" ]; then
  echo "Error: must be run from within a git repository."
  exit 1
fi

HOOK_SRC="$SCRIPT_DIR/hooks/post-merge"
HOOK_DEST="$REPO_ROOT/.git/hooks/post-merge"
CHECKSUM_DEST="$REPO_ROOT/.git/hooks/post-merge.sha256"

if [ ! -f "$HOOK_SRC" ]; then
  echo "Error: hook template not found at $HOOK_SRC"
  exit 1
fi

# Install hook
cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"

# Store checksum for integrity verification
sha256sum "$HOOK_DEST" 2>/dev/null | awk '{print $1}' > "$CHECKSUM_DEST" || \
  shasum -a 256 "$HOOK_DEST" | awk '{print $1}' > "$CHECKSUM_DEST"

echo "post-merge hook installed for $(basename "$REPO_ROOT")."
echo "Claude agents and skills will now sync automatically on git pull."
