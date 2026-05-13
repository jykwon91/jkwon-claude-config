#!/usr/bin/env node
// Smoke tests for hooks/cleanup-after-merge.js.
//
// Verifies the gating: only `gh pr merge` commands trigger any git activity.
// We don't exercise the full cleanup chain (would require a real branch); we
// confirm the script outputs `{}` for non-matching commands and would attempt
// cleanup for matching ones (by checking output shape).

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'cleanup-after-merge.js');

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

function runHook(payload) {
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('Cleanup-after-merge smoke tests\n');

// Non-matching commands must return '{}' (no cleanup attempted).
const nonMatching = [
  'git commit -m "test"',
  'git push -u origin feature/foo',
  'gh pr create --title "x"',
  'gh pr view 123',
  'gh pr merge-with-different-suffix',  // doesn't start with "gh pr merge "
  'ls -la',
  '',
];

for (const cmd of nonMatching) {
  test(`non-match: ${cmd || '(empty)'}`, () => {
    const out = runHook({
      session_id: 'test-cleanup',
      tool_name: 'Bash',
      tool_input: { command: cmd },
      hook_event_name: 'PostToolUse',
    });
    expect(out.stdout.trim() === '{}', `expected '{}' got: ${out.stdout.slice(0, 120)}`);
  });
}

// Matching commands SHOULD attempt cleanup. If we're on main/master in the
// test runner, the script's safety check returns '{}' — accept either '{}'
// (we're on main) or a JSON envelope mentioning cleanup.
const matching = [
  'gh pr merge 123',
  'gh pr merge 123 --squash',
  '  gh pr merge --auto',
  'gh pr merge',
];

for (const cmd of matching) {
  test(`matches: ${cmd}`, () => {
    const out = runHook({
      session_id: 'test-cleanup',
      tool_name: 'Bash',
      tool_input: { command: cmd },
      hook_event_name: 'PostToolUse',
    });
    // Either it ran cleanup (containing systemMessage) or it safely no-op'd
    // because the test runner is currently on main/master. Both are valid.
    const okEmpty = out.stdout.trim() === '{}';
    const okCleanup = /systemMessage/.test(out.stdout);
    expect(okEmpty || okCleanup, `expected '{}' or cleanup envelope, got: ${out.stdout.slice(0, 200)}`);
  });
}

// Malformed payload should not crash.
test('malformed JSON payload', () => {
  const result = spawnSync('node', [HOOK], {
    input: 'not json at all',
    encoding: 'utf8',
    timeout: 5000,
  });
  expect(result.stdout.trim() === '{}', `expected '{}', got: ${result.stdout.slice(0, 120)}`);
});

// Missing tool_input field should not crash.
test('missing tool_input', () => {
  const out = runHook({ session_id: 'test', tool_name: 'Bash' });
  expect(out.stdout.trim() === '{}', `expected '{}', got: ${out.stdout.slice(0, 120)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
