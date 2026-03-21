#!/bin/bash
# Installs shared Claude agents, skills, and rules to ~/.claude
# Clones the config repo if needed and sets up daily auto-sync
# Works on Windows (Git Bash), macOS, and Linux

set -e

REPO_URL="https://github.com/jykwon91/jkwon-claude-config.git"
DEST="$HOME/.claude"
CONFIG_REPO="$DEST/.config-repo"
SYNC_MARKER="claude-config-sync"

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
