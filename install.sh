#!/bin/bash
# Installs shared Claude agents, skills, and rules to ~/.claude
# Clones the config repo if needed and sets up daily auto-sync
# Tracks installed files in a manifest to avoid overwriting personal config
# Works on Windows (Git Bash), macOS, and Linux

set -e

REPO_URL="https://github.com/jykwon91/jkwon-claude-config.git"
DEST="$HOME/.claude"
CONFIG_REPO="$DEST/.config-repo"
MANIFEST="$DEST/.managed-files"
SYNC_MARKER="claude-config-sync"
SKIPPED=0

# If run from a local clone, use that as the source
# Otherwise, clone/pull the repo into ~/.claude/.config-repo
if [ -f "$(dirname "${BASH_SOURCE[0]}")/agents/g-review-code.md" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  SCRIPT_DIR="$CONFIG_REPO"
  echo "Fetching latest config..."
  if [ -d "$CONFIG_REPO/.git" ]; then
    git -C "$CONFIG_REPO" pull -q
  else
    git clone -q "$REPO_URL" "$CONFIG_REPO"
  fi
  echo ""
fi

echo "Installing Claude shared config to $DEST..."
echo ""

# Create destination directories
mkdir -p "$DEST/agents" "$DEST/skills" "$DEST/rules" "$DEST/stacks"

# Load existing manifest into a set for fast lookup
declare -A MANAGED
if [ -f "$MANIFEST" ]; then
  while IFS= read -r line; do
    MANAGED["$line"]=1
  done < "$MANIFEST"
fi

# Track newly installed files
NEW_MANIFEST=()

# Helper: install a file if safe to do so
install_file() {
  local src="$1"
  local dest="$2"
  local label="$3"
  local rel_dest="${dest#$DEST/}"

  if [ -f "$dest" ] && [ -z "${MANAGED[$rel_dest]}" ]; then
    echo "  SKIPPED $label (personal file exists — not overwriting)"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  cp "$src" "$dest"
  NEW_MANIFEST+=("$rel_dest")
  echo "  Installed: $label"
}

# Helper: install a directory (for skills)
install_skill_dir() {
  local src_dir="$1"
  local skill_name="$2"
  local dest_dir="$DEST/skills/$skill_name"
  local rel_dest="skills/$skill_name/SKILL.md"

  if [ -f "$dest_dir/SKILL.md" ] && [ -z "${MANAGED[$rel_dest]}" ]; then
    echo "  SKIPPED skill: $skill_name (personal skill exists — not overwriting)"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  mkdir -p "$dest_dir"
  cp "$src_dir/SKILL.md" "$dest_dir/SKILL.md"
  NEW_MANIFEST+=("$rel_dest")
  echo "  Installed: skill/$skill_name"
}

# Install agents
if [ -d "$SCRIPT_DIR/agents" ]; then
  for agent in "$SCRIPT_DIR/agents/"*.md; do
    [ -f "$agent" ] || continue
    name=$(basename "$agent")
    install_file "$agent" "$DEST/agents/$name" "agent/$name"
  done
fi

# Install skills
if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_dir in "$SCRIPT_DIR/skills"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    install_skill_dir "$skill_dir" "$skill_name"
  done
fi

# Install rules
if [ -d "$SCRIPT_DIR/rules" ]; then
  for rule in "$SCRIPT_DIR/rules/"*.md; do
    [ -f "$rule" ] || continue
    name=$(basename "$rule")
    install_file "$rule" "$DEST/rules/$name" "rule/$name"
  done
fi

# Install stack guides
if [ -d "$SCRIPT_DIR/stacks" ]; then
  for stack in "$SCRIPT_DIR/stacks/"*.md; do
    [ -f "$stack" ] || continue
    name=$(basename "$stack")
    install_file "$stack" "$DEST/stacks/$name" "stack/$name"
  done
fi

# Write updated manifest
printf '%s\n' "${NEW_MANIFEST[@]}" > "$MANIFEST"

if [ "$SKIPPED" -gt 0 ]; then
  echo ""
  echo "  $SKIPPED file(s) skipped to protect personal config."
  echo "  To force overwrite, delete the personal file and re-run install.sh."
fi

# --- Set up daily auto-sync ---

setup_cron() {
  # Skip if cron entry already exists
  if crontab -l 2>/dev/null | grep -q "$SYNC_MARKER"; then
    return
  fi

  SYNC_CMD="cd $CONFIG_REPO && git pull -q && bash install.sh > /dev/null 2>&1 # $SYNC_MARKER"
  (crontab -l 2>/dev/null; echo "0 9 * * * $SYNC_CMD") | crontab -
  echo ""
  echo "  Daily auto-sync scheduled (cron, 9:00 AM)."
}

setup_windows_task() {
  # Skip if task already exists
  if schtasks /query /tn "$SYNC_MARKER" > /dev/null 2>&1; then
    return
  fi

  # Get the full path to git bash
  GIT_BASH="$(command -v bash 2>/dev/null || echo "C:/Program Files/Git/bin/bash.exe")"
  SYNC_CMD="cd $CONFIG_REPO && git pull -q && bash install.sh"

  schtasks /create /tn "$SYNC_MARKER" \
    /tr "\"$GIT_BASH\" -c '$SYNC_CMD'" \
    /sc daily /st 09:00 /f > /dev/null 2>&1

  echo ""
  echo "  Daily auto-sync scheduled (Windows Task Scheduler, 9:00 AM)."
}

# Detect platform and set up scheduled sync
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    setup_windows_task
    ;;
  *)
    setup_cron
    ;;
esac

echo ""
echo "Done. Restart Claude Code for changes to take effect."
echo ""
echo "To verify, check that these directories have files:"
echo "  ls ~/.claude/agents/"
echo "  ls ~/.claude/skills/"
echo "  ls ~/.claude/rules/"
echo "  ls ~/.claude/stacks/"
