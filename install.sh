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
    _count=$(git -C "$_claude_config_dir" log --oneline "$_before..$_after" 2>/dev/null | wc -l | tr -d ' ')
    echo ""
    echo "Global Claude config updated and applied ($_count change(s)):"
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

# --- Set up shell profile for git pull config sync ---
setup_shell_profile_sync() {
  local config_dir_escaped

  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]] || command -v powershell &>/dev/null; then
    # Windows — PowerShell profile
    local ps_profile_dir="$HOME/Documents/WindowsPowerShell"
    local ps_profile="$ps_profile_dir/Microsoft.PowerShell_profile.ps1"
    local marker="# claude-config-git-sync"

    if [ -f "$ps_profile" ] && grep -q "$marker" "$ps_profile"; then
      echo "  PowerShell git sync — already configured"
      return
    fi

    mkdir -p "$ps_profile_dir"

    cat >> "$ps_profile" << 'PSPROFILE'

# claude-config-git-sync
# Wraps git so every "git pull" also checks the global Claude config repo for updates
function Invoke-GitWithConfigSync {
    & git.exe @args
    if ($args -and $args[0] -eq 'pull') {
        $configDir = "$HOME\Documents\Git\jkwon-claude-config"
        if (Test-Path "$configDir\.git") {
            # Skip if config repo has uncommitted changes
            $dirty = & git.exe -C $configDir status --porcelain 2>$null
            if ($dirty) { return }
            # Fetch latest from remote
            & git.exe -C $configDir fetch -q 2>$null
            # Compare local main to remote main (regardless of current branch)
            $localMain = & git.exe -C $configDir rev-parse main 2>$null
            $remoteMain = & git.exe -C $configDir rev-parse origin/main 2>$null
            if ($localMain -eq $remoteMain) { return }
            # Store current branch to restore later
            $currentBranch = & git.exe -C $configDir rev-parse --abbrev-ref HEAD 2>$null
            $wasOnMain = $currentBranch -eq "main"
            if (-not $wasOnMain) {
                & git.exe -C $configDir checkout main -q 2>$null
            }
            & git.exe -C $configDir pull --ff-only -q 2>$null
            $after = & git.exe -C $configDir rev-parse main 2>$null
            if ($localMain -ne $after) {
                $logs = & git.exe -C $configDir log --oneline "$localMain..$after" 2>$null
                $count = ($logs | Measure-Object).Count
                Write-Host ""
                Write-Host "Global Claude config updated and applied ($count change(s)):" -ForegroundColor Green
                $logs | ForEach-Object { Write-Host "  $_" }
                $changed = & git.exe -C $configDir diff --name-only "$localMain..$after" 2>$null
                if ($changed -match "settings\.json|install\.sh|skills/") {
                    Write-Host "  Applying config changes..." -ForegroundColor DarkGray
                    & bash "$configDir/install.sh" 2>$null | Select-String "Symlinked|hooks|settings|MCP" | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
                }
                Write-Host ""
            }
            if (-not $wasOnMain) {
                & git.exe -C $configDir checkout $currentBranch -q 2>$null
            }
        }
    }
}
Set-Alias -Name git -Value Invoke-GitWithConfigSync -Scope Global
PSPROFILE

    echo "  PowerShell git sync installed — config repo checks on every git pull"

  else
    # macOS/Linux — bash or zsh profile
    local shell_name=$(basename "$SHELL")
    local profile_file

    case "$shell_name" in
      zsh)  profile_file="$HOME/.zshrc" ;;
      bash) profile_file="$HOME/.bashrc" ;;
      *)    profile_file="$HOME/.profile" ;;
    esac

    local marker="# claude-config-git-sync"

    if [ -f "$profile_file" ] && grep -q "$marker" "$profile_file"; then
      echo "  Shell git sync — already configured in $profile_file"
      return
    fi

    cat >> "$profile_file" << 'SHPROFILE'

# claude-config-git-sync
# Wraps git so every "git pull" also checks the global Claude config repo for updates
git() {
  command git "$@"
  if [ "$1" = "pull" ]; then
    _claude_config_dir="$HOME/Documents/Git/jkwon-claude-config"
    if [ -d "$_claude_config_dir/.git" ]; then
      # Skip if config repo has uncommitted changes
      _dirty=$(command git -C "$_claude_config_dir" status --porcelain 2>/dev/null)
      if [ -n "$_dirty" ]; then return; fi
      # Fetch latest from remote
      command git -C "$_claude_config_dir" fetch -q 2>/dev/null
      # Compare local main to remote main (regardless of current branch)
      _local_main=$(command git -C "$_claude_config_dir" rev-parse main 2>/dev/null)
      _remote_main=$(command git -C "$_claude_config_dir" rev-parse origin/main 2>/dev/null)
      if [ "$_local_main" = "$_remote_main" ]; then return; fi
      # Store current branch to restore later
      _current_branch=$(command git -C "$_claude_config_dir" rev-parse --abbrev-ref HEAD 2>/dev/null)
      if [ "$_current_branch" != "main" ]; then
        command git -C "$_claude_config_dir" checkout main -q 2>/dev/null
      fi
      command git -C "$_claude_config_dir" pull --ff-only -q 2>/dev/null
      _after=$(command git -C "$_claude_config_dir" rev-parse main 2>/dev/null)
      if [ "$_local_main" != "$_after" ]; then
        _count=$(command git -C "$_claude_config_dir" log --oneline "$_local_main..$_after" 2>/dev/null | wc -l | tr -d ' ')
        echo ""
        echo "Global Claude config updated and applied ($_count change(s)):"
        command git -C "$_claude_config_dir" log --oneline "$_local_main..$_after" 2>/dev/null | sed 's/^/  /'
        _changed=$(command git -C "$_claude_config_dir" diff --name-only "$_local_main..$_after" 2>/dev/null)
        if echo "$_changed" | grep -qE "settings\.json|install\.sh|skills/"; then
          echo "  Applying config changes..."
          bash "$_claude_config_dir/install.sh" 2>/dev/null | grep -E "Symlinked|hooks|settings|MCP" | sed 's/^/  /'
        fi
        echo ""
      fi
      if [ "$_current_branch" != "main" ]; then
        command git -C "$_claude_config_dir" checkout "$_current_branch" -q 2>/dev/null
      fi
    fi
  fi
}
SHPROFILE

    echo "  Shell git sync installed in $profile_file — config repo checks on every git pull"
  fi
}

setup_shell_profile_sync

echo ""
echo "Done. Restart Claude Code for changes to take effect."
echo ""
echo "Sync mechanism:"
echo "  - Junctions/symlinks: changes to the config repo are reflected immediately"
echo "  - Global git hook: pulls the config repo after any git pull (when changes exist)"
echo "  - Shell git sync: checks config repo on every git pull (even when pulled repo is up to date)"
