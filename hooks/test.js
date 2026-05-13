#!/usr/bin/env node
// Smoke tests for hooks/context-monitor.js and hooks/context-statusline.js.
// Cross-platform (no bash dependency).
//
// Usage: node hooks/test.js

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOKS_DIR = __dirname;
const MONITOR = path.join(HOOKS_DIR, 'context-monitor.js');
const STATUSLINE = path.join(HOOKS_DIR, 'context-statusline.js');

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

function uniqSession(tag) {
  return `test-${process.pid}-${Date.now()}-${tag}`;
}

function genTranscript(approxBytes) {
  const f = path.join(os.tmpdir(), `test-transcript-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jsonl`);
  const line = '{"role":"user","content":"' + 'x'.repeat(60) + '"}\n';
  const repeats = Math.ceil(approxBytes / line.length);
  fs.writeFileSync(f, line.repeat(repeats));
  return f;
}

function clearSidecar(sessionId) {
  for (const suf of ['.json', '.debounce.json']) {
    try {
      fs.unlinkSync(path.join(os.tmpdir(), `claude-ctx-${sessionId}${suf}`));
    } catch (e) {
      /* ignore */
    }
  }
}

function runHook(script, payload) {
  const result = spawnSync('node', [script], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 10000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('Context monitor + statusline smoke tests\n');

// --- Monitor: low usage -> no warning ---
{
  const sid = uniqSession('1');
  const t = genTranscript(10_000);
  try {
    const out = runHook(MONITOR, {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      tool_name: 'Bash',
      hook_event_name: 'PostToolUse',
      model: { id: 'claude-opus-4-7' },
    });
    test('monitor: 10K bytes / 200K window -> no warning', () => {
      expect(!out.stdout.trim(), `expected empty stdout, got: ${out.stdout.slice(0, 120)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- Monitor: high usage -> WARNING ---
{
  const sid = uniqSession('2');
  const t = genTranscript(500_000);
  try {
    const out = runHook(MONITOR, {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      tool_name: 'Bash',
      hook_event_name: 'PostToolUse',
      model: { id: 'claude-opus-4-7' },
    });
    test('monitor: 500K bytes / 200K window -> WARNING or CRITICAL', () => {
      expect(/WARNING|CRITICAL/.test(out.stdout), `expected warning, got: ${out.stdout.slice(0, 200)}`);
      expect(/additionalContext/.test(out.stdout), `expected JSON envelope, got: ${out.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- Monitor: critical usage -> CRITICAL specifically ---
{
  const sid = uniqSession('3');
  const t = genTranscript(700_000);
  try {
    const out = runHook(MONITOR, {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      tool_name: 'Bash',
      hook_event_name: 'PostToolUse',
      model: { id: 'claude-opus-4-7' },
    });
    test('monitor: 700K bytes / 200K window -> CRITICAL', () => {
      expect(/CRITICAL/.test(out.stdout), `expected CRITICAL, got: ${out.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- Monitor: 1M context with same bytes -> no warning ---
{
  const sid = uniqSession('4');
  const t = genTranscript(500_000);
  try {
    const out = runHook(MONITOR, {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      tool_name: 'Bash',
      hook_event_name: 'PostToolUse',
      model: { id: 'claude-opus-4-7[1m]' },
    });
    test('monitor: 500K bytes / 1M window -> no warning', () => {
      expect(!out.stdout.trim(), `expected empty stdout on 1M window, got: ${out.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- Monitor: debounce — second call at same severity within DEBOUNCE_CALLS should NOT fire ---
{
  const sid = uniqSession('5');
  const t = genTranscript(500_000);
  try {
    const payload = {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      tool_name: 'Bash',
      hook_event_name: 'PostToolUse',
      model: { id: 'claude-opus-4-7' },
    };
    const first = runHook(MONITOR, payload);
    const second = runHook(MONITOR, payload);
    test('monitor: debounce suppresses repeat warning', () => {
      expect(/WARNING|CRITICAL/.test(first.stdout), `expected first call to warn, got: ${first.stdout.slice(0, 200)}`);
      expect(!second.stdout.trim(), `expected second call silent (debounce), got: ${second.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- Monitor: malicious session ID is rejected (no sidecar written) ---
{
  const sid = '../escaped';
  const t = genTranscript(500_000);
  try {
    const out = runHook(MONITOR, {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      tool_name: 'Bash',
      hook_event_name: 'PostToolUse',
      model: { id: 'claude-opus-4-7' },
    });
    test('monitor: rejects session IDs with path traversal', () => {
      expect(!out.stdout.trim(), `expected empty stdout, got: ${out.stdout.slice(0, 200)}`);
      // Verify no sidecar got written outside tmpdir
      const evilPath = path.join(os.tmpdir(), '..', 'escaped.json');
      expect(!fs.existsSync(evilPath), `sidecar escaped tmpdir: ${evilPath}`);
    });
  } finally {
    fs.unlinkSync(t);
  }
}

// --- Statusline: emits a line with ctx % ---
{
  const sid = uniqSession('6');
  const t = genTranscript(300_000);
  try {
    const out = runHook(STATUSLINE, {
      session_id: sid,
      transcript_path: t,
      cwd: HOOKS_DIR,
      model: { id: 'claude-opus-4-7', display_name: 'Opus 4.7' },
    });
    test('statusline: emits ctx percentage', () => {
      expect(/ctx \d+%/.test(out.stdout), `expected 'ctx N%' in output, got: ${out.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- Statusline: missing transcript falls back to cwd/model line ---
{
  const out = runHook(STATUSLINE, {
    session_id: uniqSession('7'),
    transcript_path: '/nonexistent/path.jsonl',
    cwd: HOOKS_DIR,
    model: { id: 'claude-opus-4-7', display_name: 'Opus 4.7' },
  });
  test('statusline: degrades gracefully when no transcript', () => {
    expect(out.stdout.length > 0, `expected fallback line, got empty`);
    expect(!/ctx \d+%/.test(out.stdout), `expected no ctx % without transcript, got: ${out.stdout.slice(0, 200)}`);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
