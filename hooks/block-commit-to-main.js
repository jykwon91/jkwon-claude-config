#!/usr/bin/env node
// PreToolUse hook: blocks `git commit` when the current branch is main or
// master. Designed to prevent accidental direct commits to the default
// branch.
//
// Self-gates inside the hook body via hooks/lib/git-cmd.js so the existing
// `if: "Bash(git commit*)"` matcher in settings.json is treated as
// documentation only — per claude-code-hook-if-field-unreliable.md, the
// `if` field misfires (e.g. fires on `git config` or `git log` because the
// outer Bash matcher matches everything). Without self-gating, this hook
// would block ALL Bash tool calls whenever the persistent CWD is on main,
// not just `git commit`.
//
// Caveat documented in claude-code-hook-runs-in-persistent-cwd.md: the
// hook subprocess inherits Claude Code's PERSISTENT CWD, not any chained
// `cd <dir> && git commit ...` target. If the user `cd`s into a worktree
// in the same Bash call as the commit, this hook will see the OUTER
// directory's branch. Workaround: split the `cd` into its own Bash call.

const path = require('path');
const { execSync } = require('child_process');
const { isGitSubcommand } = require(path.join(__dirname, 'lib', 'git-cmd.js'));

const PROTECTED_BRANCHES = new Set(['main', 'master']);

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

(async () => {
  let data = {};
  try {
    data = JSON.parse((await readStdin()) || '{}');
  } catch (e) {
    process.stdout.write('{}');
    return;
  }

  const cmd = (data && data.tool_input && data.tool_input.command) || '';
  if (!isGitSubcommand(cmd, 'commit')) {
    process.stdout.write('{}');
    return;
  }

  let branch = '';
  try {
    // `symbolic-ref --short HEAD` works on empty repos (returns the
    // configured initial branch name like `main` before any commit exists);
    // `rev-parse --abbrev-ref HEAD` returns the literal string `HEAD` in
    // that case and would silently fail to block.
    branch = execSync('git symbolic-ref --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch (e) {
    // Not in a git repo, detached HEAD, or git unavailable — allow. The
    // actual `git commit` will error out on its own with a clearer message
    // in any of these cases.
    process.stdout.write('{}');
    return;
  }

  if (PROTECTED_BRANCHES.has(branch)) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Cannot commit directly to ${branch}. Create a feature branch first.`,
    }));
    return;
  }

  process.stdout.write('{}');
})().catch(() => process.stdout.write('{}'));
