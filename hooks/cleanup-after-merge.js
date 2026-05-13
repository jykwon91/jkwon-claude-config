#!/usr/bin/env node
// PostToolUse hook: cleans up a feature branch after a successful `gh pr merge`.
//
// Self-gates on tool_input.command starting with "gh pr merge" because the
// settings.json `if` field is unreliable in current Claude Code (or at least
// for matchers using `:*` syntax) — the destructive chain has fired on
// unrelated Bash calls and deleted live feature branches. Gating in the hook
// body means it doesn't matter what Claude Code's matcher logic does.
//
// Chain: checkout main, pull, delete local branch, delete remote branch,
// prune origin. Every step is best-effort; any failure ends the chain
// silently so the rest of the tool call isn't disrupted.

const { execSync } = require('child_process');

// Run a shell command. Return its stdout on success, or null on any failure.
// The chain below stops at the first step that returns null — matching the
// && semantics of the original bash hook so we never push a delete after a
// failed local delete.
function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return null;
  }
}

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

(async () => {
  let data;
  try {
    data = JSON.parse((await readStdin()) || '{}');
  } catch (e) {
    process.stdout.write('{}');
    return;
  }

  const cmd = (data && data.tool_input && data.tool_input.command) || '';

  // Strict gating: only act when the tool call was specifically `gh pr merge`.
  // `(?=\s|$)` after `merge` ensures the next character is whitespace or end —
  // `\b` would match `merge-` (hyphen is a non-word char), and that would let
  // any command starting with `gh pr merge-anything` trigger the chain.
  if (!/^\s*gh\s+pr\s+merge(?=\s|$)/.test(cmd)) {
    process.stdout.write('{}');
    return;
  }

  const branchResult = run('git rev-parse --abbrev-ref HEAD');
  const branch = branchResult ? branchResult.toString().trim() : '';
  if (!branch || branch === 'main' || branch === 'master') {
    process.stdout.write('{}');
    return;
  }

  // Shell-escape the branch name defensively. Branch names can contain
  // characters that need quoting; never interpolate raw into the shell.
  const quoted = "'" + branch.replace(/'/g, "'\\''") + "'";

  // Chain: each step must succeed before the next runs. Specifically, the
  // destructive `git push origin --delete` only fires AFTER the local
  // `git branch -d` proves the branch is fully merged. This is what the
  // original bash hook intended via `&&`, and what got short-circuited when
  // `branch -d` succeeded "merged with upstream" but not "merged to main".
  // Here we also require checkout + pull first, ensuring main is up to date.
  if (!run('git checkout main')) {
    process.stdout.write('{}');
    return;
  }
  if (!run('git pull -q')) {
    process.stdout.write('{}');
    return;
  }
  if (!run(`git branch -d ${quoted}`)) {
    // Local delete refused — branch isn't merged to main. Stop here; do not
    // delete the remote either. This is the critical correctness gate.
    process.stdout.write('{}');
    return;
  }

  // Local delete succeeded => safe to delete the remote and prune.
  run(`git push origin --delete ${quoted}`);
  run('git remote prune origin');

  process.stdout.write(
    JSON.stringify({
      systemMessage: `Cleaned up: deleted local and remote branch ${branch}`,
    })
  );
})().catch(() => {
  process.stdout.write('{}');
});
