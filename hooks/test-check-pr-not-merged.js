#!/usr/bin/env node
// Tests for check-pr-not-merged.js — verifies the command-shape gating only.
// The PR-state check requires gh/git side effects, so we don't exercise it
// here; instead we cover the cases where the hook should ALLOW (output `{}`)
// because the command shape itself shouldn't trigger the check:
//
//   - Non-push commands
//   - Delete-pushes (`--delete`, `-d`, refspec `:branch`)
//
// These are the regressions we care about — false positives that block
// cleanup. The MERGED-state block path is exercised in the real installer.

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'check-pr-not-merged.js');

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

function runHook(command) {
  const payload = {
    session_id: 'test',
    tool_name: 'Bash',
    tool_input: { command },
    hook_event_name: 'PreToolUse',
  };
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return { stdout: (result.stdout || '').trim(), stderr: result.stderr || '' };
}

console.log('check-pr-not-merged smoke tests\n');

// --- Non-push commands always allow ---

for (const cmd of ['ls', 'git status', 'git commit -m foo', 'echo git push']) {
  test(`allow non-push: ${cmd}`, () => {
    const out = runHook(cmd);
    expect(out.stdout === '{}', `expected {}, got: ${out.stdout}`);
  });
}

// --- Delete pushes always allow ---

for (const cmd of [
  'git push origin --delete some-branch',
  'git push --delete origin some-branch',
  'git push origin -d some-branch',
  'git push -d origin some-branch',
  'git push origin :some-branch',
]) {
  test(`allow delete-push: ${cmd}`, () => {
    const out = runHook(cmd);
    expect(out.stdout === '{}', `expected {}, got: ${out.stdout}`);
  });
}

// --- A push from main/master skips the PR check (no PR to check) ---

test('allow plain push (regular push path runs gh; result depends on branch state, so this case is integration-only)', () => {
  // We can't deterministically assert here without mocking the git+gh chain.
  // Verify only that the hook produces VALID JSON output (not a crash).
  const out = runHook('git push origin some-branch');
  try {
    JSON.parse(out.stdout);
  } catch (e) {
    throw new Error(`hook emitted non-JSON: ${out.stdout}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
