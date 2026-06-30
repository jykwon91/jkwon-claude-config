#!/usr/bin/env node
// Smoke tests for hooks/pr-quality-gate.js.
//
// The critical safety property (per rules/claude-code-hook-if-field-unreliable.md):
// for ANY command that is not a real `gh pr create`, the hook must emit `{}`
// WITHOUT side effects — i.e. without spawning the nested `claude` review. These
// tests exercise the self-gate via subprocess and the pure helpers directly.
//
// The claude-invocation path is intentionally NOT exercised here (it would make
// a live, billed model call). Its correctness is covered by the `extractDecision`
// unit tests below plus manual verification — see the PR description.

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'pr-quality-gate.js');
const { PR_CREATE, extractDecision } = require('./pr-quality-gate.js');

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

// Runs the hook as a subprocess. Fast for non-matching commands because the
// self-gate returns before any claude spawn. A short timeout doubles as an
// assertion that the self-gate did NOT fall through to the review.
function runHook(command) {
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    timeout: 8000,
  });
  return (result.stdout || '').trim();
}

function expectAllow(command) {
  const out = runHook(command);
  expect(out === '{}', `expected "{}" for ${JSON.stringify(command)}, got ${JSON.stringify(out)}`);
}

console.log('PR quality-gate smoke tests\n');

// ---- 1. Self-gate: non-matching commands return {} (no review spawned) ----

const allow = [
  '',
  'ls -la',
  'git status',
  'git push origin feature/x',
  'git push -u origin HEAD',
  'git commit -m "feat: gh pr create helper"',   // phrase inside a commit message
  'gh pr view 42',
  'gh pr list --state open',
  'gh pr checks',
  'gh pr ready 42',
  'echo "gh pr create"',                         // mentioned, not executed at a boundary
  'cat notes_about_gh_pr_create.md',
  'gh pr create-stack --foo',                    // hyphenated lookalike (\b would match; (?=\\s|$) does not)
];

for (const cmd of allow) {
  test(`self-gate allow: ${JSON.stringify(cmd).slice(0, 52)}`, () => expectAllow(cmd));
}

// ---- 2. Invalid / empty stdin payloads fail open to {} ----

test('invalid JSON payload returns {}', () => {
  const result = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8', timeout: 8000 });
  expect((result.stdout || '').trim() === '{}', `expected "{}" got ${JSON.stringify(result.stdout)}`);
});

test('empty stdin returns {}', () => {
  const result = spawnSync('node', [HOOK], { input: '', encoding: 'utf8', timeout: 8000 });
  expect((result.stdout || '').trim() === '{}', `expected "{}" got ${JSON.stringify(result.stdout)}`);
});

// ---- 3. PR_CREATE regex matches real invocations, not lookalikes ----

const matches = [
  'gh pr create',
  'gh pr create --fill',
  'gh pr create --title "x" --body "y" --base main',
  'gh  pr   create --draft',                     // extra whitespace
  'git push -u origin HEAD && gh pr create --fill', // chained after &&
];
for (const cmd of matches) {
  test(`regex matches: ${cmd.slice(0, 50)}`, () => expect(PR_CREATE.test(cmd.trim()), 'should match'));
}

const nonMatches = [
  'gh pr view 1',
  'gh pr list',
  'gh pr create-stack',                          // hyphen boundary
  'echo "gh pr create"',                         // not at a command boundary
  'git commit -m "gh pr create"',
  'mygh pr create',                              // not the gh command
];
for (const cmd of nonMatches) {
  test(`regex rejects: ${cmd.slice(0, 50)}`, () => expect(!PR_CREATE.test(cmd.trim()), 'should NOT match'));
}

// ---- 4. extractDecision parses the model's reply shapes ----

test('extractDecision: bare {} -> pass object', () => {
  const d = extractDecision('{}');
  expect(d && typeof d === 'object' && d.decision === undefined, `got ${JSON.stringify(d)}`);
});

test('extractDecision: bare block object', () => {
  const d = extractDecision('{"decision":"block","reason":"foo.tsx has 2 components"}');
  expect(d && d.decision === 'block' && /foo\.tsx/.test(d.reason), `got ${JSON.stringify(d)}`);
});

test('extractDecision: block object embedded in prose', () => {
  const d = extractDecision('After review:\n{"decision":"block","reason":"no E2E"}\nDone.');
  expect(d && d.decision === 'block' && d.reason === 'no E2E', `got ${JSON.stringify(d)}`);
});

test('extractDecision: takes the LAST object when several appear', () => {
  const d = extractDecision('scratch {"a":1} then final {"decision":"block","reason":"last"}');
  expect(d && d.decision === 'block' && d.reason === 'last', `got ${JSON.stringify(d)}`);
});

test('extractDecision: no JSON -> null', () => {
  expect(extractDecision('looks good to me') === null, 'expected null');
});

test('extractDecision: empty -> null', () => {
  expect(extractDecision('') === null, 'expected null');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
