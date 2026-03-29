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
# Pull the shared Claude config repo after any git pull, then re-merge settings
_claude_config_dir="$HOME/Documents/Git/jkwon-claude-config"
if [ -d "$_claude_config_dir/.git" ]; then
  _before=$(git -C "$_claude_config_dir" rev-parse HEAD 2>/dev/null)
  git -C "$_claude_config_dir" pull -q 2>/dev/null
  _after=$(git -C "$_claude_config_dir" rev-parse HEAD 2>/dev/null)
  if [ "$_before" != "$_after" ]; then
    echo ""
    echo "[claude-config] Global config updated:"
    git -C "$_claude_config_dir" log --oneline "$_before..$_after" 2>/dev/null | sed 's/^/  /'
    # Re-merge settings.json if it changed
    if git -C "$_claude_config_dir" diff --name-only "$_before..$_after" 2>/dev/null | grep -q "settings.json"; then
      bash "$_claude_config_dir/install.sh" 2>/dev/null | grep -E "hooks|settings" | sed 's/^/  /'
    fi
    echo ""
  fi
fi
HOOK

  chmod +x "$hook_file"
  echo "  Global post-merge hook installed — config repo syncs on every git pull"
}

setup_global_git_hook

# --- Set up MCP servers ---
setup_mcp_servers() {
  local mcp_dir="$SCRIPT_DIR/mcp"
  [ -d "$mcp_dir" ] || return

  for server_dir in "$mcp_dir"/*/; do
    [ -d "$server_dir" ] || continue
    local server_name=$(basename "$server_dir")
    local server_script="$server_dir/server.py"
    local requirements="$server_dir/requirements.txt"

    [ -f "$server_script" ] || continue

    # Install dependencies if requirements.txt exists
    if [ -f "$requirements" ]; then
      pip install -q -r "$requirements" 2>/dev/null || {
        echo "  WARNING: Failed to install dependencies for $server_name"
        continue
      }
    fi

    # Register with Claude Code if not already registered
    if command -v claude &>/dev/null; then
      # Check if already registered by looking at output of claude mcp list
      if ! claude mcp list 2>/dev/null | grep -q "$server_name"; then
        claude mcp add "$server_name" -- python "$server_script" 2>/dev/null && \
          echo "  MCP server registered: $server_name" || \
          echo "  WARNING: Failed to register MCP server: $server_name"
      else
        echo "  MCP server $server_name — already registered"
      fi
    fi
  done
}

setup_mcp_servers

# --- Merge shared hooks into ~/.claude/settings.json ---
setup_shared_hooks() {
  local shared_settings="$SCRIPT_DIR/settings.json"
  local user_settings="$DEST/settings.json"

  [ -f "$shared_settings" ] || return

  if ! command -v py &>/dev/null && ! command -v python3 &>/dev/null; then
    echo "  WARNING: Python not found — cannot merge shared hooks into settings.json"
    return
  fi

  local py_cmd="py"
  command -v py &>/dev/null || py_cmd="python3"

  $py_cmd - "$shared_settings" "$user_settings" << 'PYMERGE'
import sys, json, os

shared_path, user_path = sys.argv[1], sys.argv[2]

with open(shared_path) as f:
    shared = json.load(f)

user = {}
if os.path.exists(user_path):
    with open(user_path) as f:
        user = json.load(f)

# Merge hooks: for each event+matcher, replace shared hooks by their "if" field.
# This ensures updated hooks replace old versions instead of duplicating.
shared_hooks = shared.get("hooks", {})
user_hooks = user.setdefault("hooks", {})

for event, entries in shared_hooks.items():
    existing = user_hooks.setdefault(event, [])
    for entry in entries:
        matcher = entry.get("matcher")
        # Find or create the entry with the same matcher
        matched_entry = next((e for e in existing if e.get("matcher") == matcher), None)
        if not matched_entry:
            existing.append(entry)
            continue

        # For each shared hook, replace any existing hook with the same "if" field
        for shared_hook in entry.get("hooks", []):
            if_field = shared_hook.get("if")
            if if_field:
                # Remove any existing hook with the same "if" trigger
                matched_entry["hooks"] = [
                    h for h in matched_entry["hooks"]
                    if h.get("if") != if_field
                ]
            else:
                # No "if" field — check by exact command match
                cmd = shared_hook.get("command", "")
                if any(cmd == h.get("command", "") for h in matched_entry["hooks"]):
                    continue
            matched_entry["hooks"].append(shared_hook)

with open(user_path, "w") as f:
    json.dump(user, f, indent=2)
    f.write("\n")

PYMERGE

  echo "  Shared hooks merged into settings.json"
}

setup_shared_hooks

echo ""
echo "Done. Restart Claude Code for changes to take effect."
echo ""
echo "Sync mechanism:"
echo "  - Junctions/symlinks: changes to the config repo are reflected immediately"
echo "  - Global git hook: pulls the config repo after any git pull"
