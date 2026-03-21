#!/bin/bash
# Removes Claude shared config installed by this repo from ~/.claude
# Also removes: post-merge hooks, daily sync job, and hidden config repo clone
# Works from both the config repo and project repos
# Works on Windows (Git Bash), macOS, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude"
CONFIG_REPO="$DEST/.config-repo"
SYNC_MARKER="claude-config-sync"
REMOVED=0

# Detect source directories — config repo uses agents/, project repos use .claude/agents/
if [ -d "$SCRIPT_DIR/agents" ]; then
  AGENTS_SRC="$SCRIPT_DIR/agents"
elif [ -d "$SCRIPT_DIR/.claude/agents" ]; then
  AGENTS_SRC="$SCRIPT_DIR/.claude/agents"
elif [ -d "$CONFIG_REPO/agents" ]; then
  AGENTS_SRC="$CONFIG_REPO/agents"
else
  AGENTS_SRC=""
fi

if [ -d "$SCRIPT_DIR/skills" ]; then
  SKILLS_SRC="$SCRIPT_DIR/skills"
elif [ -d "$SCRIPT_DIR/.claude/skills" ]; then
  SKILLS_SRC="$SCRIPT_DIR/.claude/skills"
elif [ -d "$CONFIG_REPO/skills" ]; then
  SKILLS_SRC="$CONFIG_REPO/skills"
else
  SKILLS_SRC=""
fi

if [ -d "$SCRIPT_DIR/rules" ]; then
  RULES_SRC="$SCRIPT_DIR/rules"
elif [ -d "$CONFIG_REPO/rules" ]; then
  RULES_SRC="$CONFIG_REPO/rules"
else
  RULES_SRC=""
fi

echo "Removing Claude shared config from $DEST..."
echo ""

# --- Remove agents ---
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

# --- Remove skills ---
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

# --- Remove rules ---
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

# --- Remove post-merge hook ---
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

# --- Remove daily auto-sync job ---
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if schtasks /query /tn "$SYNC_MARKER" > /dev/null 2>&1; then
      schtasks /delete /tn "$SYNC_MARKER" /f > /dev/null 2>&1
      echo "  Removed Windows scheduled task: $SYNC_MARKER"
      REMOVED=$((REMOVED + 1))
    fi
    ;;
  *)
    if crontab -l 2>/dev/null | grep -q "$SYNC_MARKER"; then
      crontab -l 2>/dev/null | grep -v "$SYNC_MARKER" | crontab -
      echo "  Removed cron job: $SYNC_MARKER"
      REMOVED=$((REMOVED + 1))
    fi
    ;;
esac

# --- Remove hidden config repo clone ---
if [ -d "$CONFIG_REPO" ]; then
  # Check if we're running from inside the config repo clone
  case "$SCRIPT_DIR" in
    "$CONFIG_REPO"*)
      # On Windows, can't delete a directory while a script inside it is running.
      # Schedule deletion after this script exits.
      case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
          # Use cmd /c start to delete after this process exits
          cmd //c "start /min cmd /c \"timeout /t 2 /nobreak >nul & rmdir /s /q \"${CONFIG_REPO//\//\\}\"\"" 2>/dev/null
          echo "  Config repo clone will be removed shortly: $CONFIG_REPO"
          REMOVED=$((REMOVED + 1))
          ;;
        *)
          # Unix: safe to delete while running — file handles keep working
          rm -rf "$CONFIG_REPO"
          echo "  Removed config repo clone: $CONFIG_REPO"
          REMOVED=$((REMOVED + 1))
          ;;
      esac
      ;;
    *)
      rm -rf "$CONFIG_REPO"
      echo "  Removed config repo clone: $CONFIG_REPO"
      REMOVED=$((REMOVED + 1))
      ;;
  esac
fi

echo ""
if [ "$REMOVED" -eq 0 ]; then
  echo "Nothing to remove — no shared config found."
else
  echo "Removed $REMOVED item(s). Restart Claude Code for changes to take effect."
fi
