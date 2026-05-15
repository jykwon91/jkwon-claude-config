#!/usr/bin/env node
// Smoke tests for hooks/block-commit-to-main.js.
//
// Verifies the gating: only actual `git commit` commands cause the hook to
// run the branch check. Non-matching commands return `{}` unconditionally.
// Branch-dependent assertions run inside a throwaway git repo so they're
// independent of the developer's actual checkout.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, 'block-commit-to-main.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runHook(payload, { cwd } = {}) {
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 5000,
    cwd: cwd || process.cwd(),
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

// Create a throwaway git repo on a specific branch.
function makeRepo(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `test-block-commit-${process.pid}-`));
  spawnSync('git', ['init', '-q', '-b', branch, dir], { encoding: 'utf8' });
  // need at least one commit for rev-parse to resolve cleanly — actually
  // `git rev-parse --abbrev-ref HEAD` works on an empty repo too. Skip.
  return dir;
}

console.log('Block-commit-to-main smoke tests\n');

// ---- 1. Self-gating: non-`git commit` commands return `{}` regardless of branch ----

const nonMatching = [
  'git push -u origin feature/foo',
  'git log -1 --format=%s',
  'git config user.name',
  'git rev-parse HEAD',
  'gh pr create --title x',
  'ls -la',
  'echo "git commit"',                  // commit appears in a string, not as subcommand
  '',                                    // empty command
];

const mainRepo = makeRepo('main');

for (const cmd of nonMatching) {
  test(`non-matching: ${JSON.stringify(cmd).slice(0, 40)}`, () => {
    const out = runHook({ tool_input: { command: cmd } }, { cwd: mainRepo });
    expect(out.stdout.trim() === '{}', `expected "{}" got ${JSON.stringify(out.stdout)}`);
  });
}

// ---- 2. `git commit` ON main MUST block ----

const commitVariants = [
  'git commit -m "feat: x"',
  'git commit -am "fix: y"',
  'GIT_AUTHOR_NAME=foo git commit -m "z"',
  'git -C /other/path commit -m "w"',   // -C target may differ, but hook reads CWD
  '/usr/bin/git commit -m "abs path"',
];

for (const cmd of commitVariants) {
  test(`commit on main blocks: ${cmd.slice(0, 50)}`, () => {
    const out = runHook({ tool_input: { command: cmd } }, { cwd: mainRepo });
    const parsed = JSON.parse(out.stdout || '{}');
    expect(parsed.decision === 'block', `expected block, got ${JSON.stringify(parsed)}`);
    expect(/main/.test(parsed.reason || ''), `expected reason to mention main, got ${JSON.stringify(parsed.reason)}`);
  });
}

// ---- 3. `git commit` ON master MUST also block ----

const masterRepo = makeRepo('master');

test('commit on master blocks', () => {
  const out = runHook({ tool_input: { command: 'git commit -m "feat: x"' } }, { cwd: masterRepo });
  const parsed = JSON.parse(out.stdout || '{}');
  expect(parsed.decision === 'block', `expected block, got ${JSON.stringify(parsed)}`);
  expect(/master/.test(parsed.reason || ''), `expected reason to mention master, got ${JSON.stringify(parsed.reason)}`);
});

// ---- 4. `git commit` ON a feature branch MUST allow ----

const featureRepo = makeRepo('feature/jykwon91/test-branch');

test('commit on feature branch allows', () => {
  const out = runHook({ tool_input: { command: 'git commit -m "feat: x"' } }, { cwd: featureRepo });
  expect(out.stdout.trim() === '{}', `expected "{}" got ${JSON.stringify(out.stdout)}`);
});

// ---- 5. Outside a git repo: allow (real commit will error on its own) ----

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `test-block-commit-nonrepo-${process.pid}-`));

test('commit outside git repo allows', () => {
  const out = runHook({ tool_input: { command: 'git commit -m "x"' } }, { cwd: tmpDir });
  expect(out.stdout.trim() === '{}', `expected "{}" got ${JSON.stringify(out.stdout)}`);
});

// ---- 6. Invalid JSON payload returns `{}` (defensive) ----

test('invalid JSON payload returns {}', () => {
  const result = spawnSync('node', [HOOK], {
    input: 'not json',
    encoding: 'utf8',
    timeout: 5000,
    cwd: featureRepo,
  });
  expect((result.stdout || '').trim() === '{}', `expected "{}" got ${JSON.stringify(result.stdout)}`);
});

// ---- summary ----

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
