#!/usr/bin/env bash
# Install Copilot CLI global config — agents, skills, and instructions.
# Run: bash install.sh
# Re-run after updates to re-sync.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
GITHUB_HOME="$HOME/.github"

echo "Installing Copilot CLI global config..."
echo "  Source:  $SCRIPT_DIR"
echo "  Target:  $COPILOT_HOME"
echo ""

# --- Global instructions ---
mkdir -p "$GITHUB_HOME"
cp "$SCRIPT_DIR/copilot-instructions.md" "$GITHUB_HOME/copilot-instructions.md"
echo "[OK] Global instructions → $GITHUB_HOME/copilot-instructions.md"

# --- Agents ---
mkdir -p "$COPILOT_HOME/agents"

# Clean up stale agents that no longer exist in source
if [ -d "$COPILOT_HOME/agents" ]; then
  for installed_agent in "$COPILOT_HOME/agents"/*.agent.md; do
    [ -f "$installed_agent" ] || continue
    agent_basename="$(basename "$installed_agent")"
    if [ ! -f "$SCRIPT_DIR/agents/$agent_basename" ]; then
      rm "$installed_agent"
      echo "[CLEANUP] Removed stale agent: $agent_basename"
    fi
  done
fi

agent_count=0
for agent in "$SCRIPT_DIR"/agents/*.agent.md; do
  [ -f "$agent" ] || continue
  cp "$agent" "$COPILOT_HOME/agents/$(basename "$agent")"
  agent_count=$((agent_count + 1))
done
echo "[OK] $agent_count agents → $COPILOT_HOME/agents/"

# --- Skills ---
mkdir -p "$COPILOT_HOME/skills"

# Clean up stale skills that no longer exist in source
if [ -d "$COPILOT_HOME/skills" ]; then
  for installed_skill in "$COPILOT_HOME/skills"/*/; do
    [ -d "$installed_skill" ] || continue
    skill_name="$(basename "$installed_skill")"
    if [ ! -d "$SCRIPT_DIR/skills/$skill_name" ]; then
      rm -rf "$installed_skill"
      echo "[CLEANUP] Removed stale skill: $skill_name"
    fi
  done
fi

skill_count=0
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  mkdir -p "$COPILOT_HOME/skills/$skill_name"
  cp "$skill_dir"SKILL.md "$COPILOT_HOME/skills/$skill_name/SKILL.md"
  skill_count=$((skill_count + 1))
done
echo "[OK] $skill_count skills → $COPILOT_HOME/skills/"

echo ""
echo "Done! Installed:"
echo "  - $agent_count agents"
echo "  - $skill_count skills"
echo "  - Global instructions"
echo ""
echo "Restart Copilot CLI or run /skills reload to pick up changes."
