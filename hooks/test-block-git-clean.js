#!/usr/bin/env node
// Smoke tests for hooks/block-git-clean.js.
//
// Pure string-parsing hook — no git repo needed. Verifies: force-cleaning
// untracked files blocks; dry-runs and ignored-only (-X) cleans are allowed;
// the gate returns `{}` for everything else. The self-gate must return `{}`
// for non-matching commands (no side effects on unrelated Bash calls).

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'block-git-clean.js');

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
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    timeout: 5000,
  });
  return (result.stdout || '').trim();
}

function expectAllow(command) {
  const out = runHook(command);
  expect(out === '{}', `expected "{}" (allow) for ${JSON.stringify(command)}, got ${JSON.stringify(out)}`);
}

function expectBlock(command) {
  const out = runHook(command);
  let parsed;
  try { parsed = JSON.parse(out); } catch (e) {
    throw new Error(`expected block JSON for ${JSON.stringify(command)}, got ${JSON.stringify(out)}`);
  }
  expect(parsed.decision === 'block', `expected decision=block for ${JSON.stringify(command)}, got ${JSON.stringify(out)}`);
}

console.log('block-git-clean.js smoke tests:');

// --- BLOCK: force-deleting untracked files (the incident) ---
test('blocks git clean -fd (the incident)', () => expectBlock('git clean -fd'));
test('blocks git clean -f', () => expectBlock('git clean -f'));
test('blocks git clean -fdx (untracked + ignored)', () => expectBlock('git clean -fdx'));
test('blocks git clean -xf (cluster order)', () => expectBlock('git clean -xf'));
test('blocks --force long form', () => expectBlock('git clean --force -d'));
test('blocks separate short flags -f -d', () => expectBlock('git clean -f -d'));
test('blocks force clean scoped to a path', () => expectBlock('git clean -fd -- apps/x/scripts'));
test('blocks when chained after &&', () => expectBlock('cd apps/x && git clean -fd'));
test('blocks when chained after ;', () => expectBlock('echo hi; git clean -fd'));
test('blocks with env prefix', () => expectBlock('GIT_PAGER=cat git clean -fd'));
test('blocks with git -C global option', () => expectBlock('git -C apps/x clean -fd'));

// --- ALLOW: dry-runs, no-force, ignored-only, unrelated ---
test('allows dry-run -nd', () => expectAllow('git clean -nd'));
test('allows --dry-run', () => expectAllow('git clean --dry-run -d'));
test('allows -fn (force + dry-run = still a preview)', () => expectAllow('git clean -fn'));
test('allows ignored-only -fdX (uppercase = build junk)', () => expectAllow('git clean -fdX'));
test('allows ignored-only -fX', () => expectAllow('git clean -fX'));
test('allows bare git clean (no force — git refuses anyway)', () => expectAllow('git clean'));
test('allows git clean -d without force', () => expectAllow('git clean -d'));
test('allows unrelated git command', () => expectAllow('git status'));
test('allows npm run clean (not git)', () => expectAllow('npm run clean'));
test('allows a clean-named branch checkout', () => expectAllow('git checkout feature/clean-up'));
test('allows grep for the phrase', () => expectAllow('grep -r "git clean -fd" .'));
test('allows empty command', () => expectAllow(''));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
