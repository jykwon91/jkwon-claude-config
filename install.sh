#!/bin/bash
# Installs shared Claude agents, skills, rules, and stacks to ~/.claude
# Uses symlinks so changes to the config repo are immediately reflected
# Clones the config repo if needed and sets up auto-sync
# Works on Windows (Git Bash), macOS, and Linux

set -e

REPO_URL="https://github.com/jykwon91/jkwon-claude-config.git"
DEST="$HOME/.claude"
CONFIG_REPO="$DEST/.config-repo"

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

# Symlink directories: agents, rules, stacks
# These are fully managed by the config repo — symlink the entire directory
for dir in agents rules stacks; do
  src="$SCRIPT_DIR/$dir"
  dest="$DEST/$dir"

  [ -d "$src" ] || continue

  # If dest is already a symlink pointing to the right place, skip
  if [ -L "$dest" ]; then
    current_target="$(readlink "$dest")"
    if [ "$current_target" = "$src" ]; then
      echo "  $dir/ — symlink OK"
      continue
    fi
    # Wrong target — remove and re-link
    rm "$dest"
  elif [ -d "$dest" ]; then
    # Real directory exists — back it up, then replace with symlink
    echo "  Backing up existing $dir/ to ${dir}.bak/"
    rm -rf "$DEST/${dir}.bak"
    mv "$dest" "$DEST/${dir}.bak"
  fi

  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      win_src="$(cygpath -w "$src")"
      win_dest="$(cygpath -w "$dest")"
      powershell -Command "New-Item -ItemType Junction -Path '$win_dest' -Target '$win_src'" > /dev/null 2>&1 || {
        echo "  WARNING: junction failed for $dir/. Falling back to copy."
        cp -r "$src" "$dest"
      }
      ;;
    *)
      ln -s "$src" "$dest"
      ;;
  esac
  echo "  Symlinked: $dir/ → $src"
done

# Skills need special handling: each skill is a subdirectory
# Symlink individual skill directories so personal skills coexist
mkdir -p "$DEST/skills"
if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_dir in "$SCRIPT_DIR/skills"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    dest_skill="$DEST/skills/$skill_name"

    if [ -L "$dest_skill" ]; then
      current_target="$(readlink "$dest_skill")"
      if [ "$current_target" = "$skill_dir" ] || [ "$current_target" = "${skill_dir%/}" ]; then
        echo "  skill/$skill_name — symlink OK"
        continue
      fi
      rm "$dest_skill"
    elif [ -d "$dest_skill" ]; then
      rm -rf "$dest_skill"
    fi

    case "$(uname -s)" in
      MINGW*|MSYS*|CYGWIN*)
        win_src="$(cygpath -w "${skill_dir%/}")"
        win_dest="$(cygpath -w "$dest_skill")"
        powershell -Command "New-Item -ItemType Junction -Path '$win_dest' -Target '$win_src'" > /dev/null 2>&1 || {
          echo "  WARNING: junction failed for skill/$skill_name. Falling back to copy."
          cp -r "${skill_dir%/}" "$dest_skill"
        }
        ;;
      *)
        ln -s "${skill_dir%/}" "$dest_skill"
        ;;
    esac
    echo "  Symlinked: skill/$skill_name"
  done
fi

# Clean up old manifest file (no longer needed with symlinks)
rm -f "$DEST/.managed-files"

# --- Set up global git hook for pull-time sync ---
# After any git pull on any repo, also pull the config repo
setup_global_git_hook() {
  local hooks_dir="$HOME/.config/git/hooks"
  local hook_file="$hooks_dir/post-merge"
  local hook_marker="# claude-config-auto-sync"

  mkdir -p "$hooks_dir"

  # Set global hooksPath if not already set
  current_hooks="$(git config --global core.hooksPath 2>/dev/null || true)"
  if [ -z "$current_hooks" ]; then
    git config --global core.hooksPath "$hooks_dir"
  fi

  # Skip if hook already has our sync line
  if [ -f "$hook_file" ] && grep -q "$hook_marker" "$hook_file"; then
    echo "  Global post-merge hook — already configured"
    return
  fi

  # Append our sync to the hook (preserving any existing content)
  if [ ! -f "$hook_file" ]; then
    echo "#!/bin/bash" > "$hook_file"
  fi

  cat >> "$hook_file" << 'HOOK'

# claude-config-auto-sync
# Pull the shared Claude config repo after any git pull
_claude_config_dir="$HOME/Documents/Git/jkwon-claude-config"
if [ -d "$_claude_config_dir/.git" ]; then
  _before=$(git -C "$_claude_config_dir" rev-parse HEAD 2>/dev/null)
  git -C "$_claude_config_dir" pull -q 2>/dev/null
  _after=$(git -C "$_claude_config_dir" rev-parse HEAD 2>/dev/null)
  if [ "$_before" != "$_after" ]; then
    echo ""
    echo "[claude-config] Global config updated:"
    git -C "$_claude_config_dir" log --oneline "$_before..$_after" 2>/dev/null | sed 's/^/  /'
    echo ""
  fi
fi
HOOK

  chmod +x "$hook_file"
  echo "  Global post-merge hook installed — config repo syncs on every git pull"
}

setup_global_git_hook

echo ""
echo "Done. Restart Claude Code for changes to take effect."
echo ""
echo "Sync mechanism:"
echo "  - Junctions/symlinks: changes to the config repo are reflected immediately"
echo "  - Global git hook: pulls the config repo after any git pull"
