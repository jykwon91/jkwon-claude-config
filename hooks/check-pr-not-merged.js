#!/usr/bin/env node
// PreToolUse hook: blocks `git push` when the current branch's PR has already
// been merged. Pushing more commits to a merged-PR branch is a common mistake
// — the commits sit on a dead branch that's never going to be re-opened, and
// the next session is left to figure out why the work didn't reach prod.
//
// Gates:
//   - tool_input.command must start with `git push` (any args)
//   - Skip when args contain `--delete`, `-d ` (port-style), or `:` (refspec
//     deletion). Deleting a merged-branch IS the correct cleanup action and
//     must not be blocked.
//   - Skip when on main/master (no PR to check).
//
// Output: `{"decision":"block","reason":"..."}` to block, `{}` to allow.
//
// This is a PreToolUse hook, so any exit other than the JSON blocker emits
// no output and the tool call proceeds.

const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (e) {
    return '';
  }
}

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

function isDeletePush(command) {
  // `git push origin --delete <branch>` or `git push --delete origin <branch>`
  if (/(^|\s)--delete(\s|$)/.test(command)) return true;
  // `git push origin -d <branch>` (short form)
  if (/(^|\s)-d(\s|$)/.test(command)) return true;
  // `git push origin :<branch>` (refspec deletion — the leading colon)
  if (/\s:\S+/.test(command)) return true;
  return false;
}

(async () => {
  let data = {};
  try {
    data = JSON.parse((await readStdin()) || '{}');
  } catch (e) {
    process.stdout.write('{}');
    return;
  }

  const command = (data && data.tool_input && data.tool_input.command) || '';
  if (!/^\s*git\s+push(\s|$)/.test(command)) {
    process.stdout.write('{}');
    return;
  }

  if (isDeletePush(command)) {
    process.stdout.write('{}');
    return;
  }

  const branch = run('git rev-parse --abbrev-ref HEAD');
  if (!branch || branch === 'main' || branch === 'master' || branch === 'HEAD') {
    process.stdout.write('{}');
    return;
  }

  const state = run(`gh pr view ${branch} --json state --jq .state`);
  if (state === 'MERGED') {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          `PR for branch '${branch}' is already MERGED. ` +
          `Create a new branch and cherry-pick your commits — pushing to a merged-PR ` +
          `branch leaves the work stranded on a dead ref.`,
      })
    );
    return;
  }

  process.stdout.write('{}');
})();
