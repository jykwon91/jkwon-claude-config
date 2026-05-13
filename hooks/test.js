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

// Run the hook with HOME/USERPROFILE pointed at an isolated empty temp dir so
// the hook never reads the developer's real ~/.claude/settings.json. If a
// settings object is supplied, write it to <isolatedHome>/.claude/settings.json
// so the hook picks it up via readContextWindowFromSettings().
function runHook(script, payload, { settings, env } = {}) {
  const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), `claude-test-home-${process.pid}-`));
  if (settings) {
    const claudeDir = path.join(isolatedHome, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings));
  }
  try {
    const result = spawnSync('node', [script], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        HOME: isolatedHome,
        USERPROFILE: isolatedHome,
        ...(env || {}),
      },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status,
    };
  } finally {
    fs.rmSync(isolatedHome, { recursive: true, force: true });
  }
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

// --- settings.json override: CLAUDE_CONTEXT_WINDOW=1000000 silences warning
// at the same byte count that would warn on a 200K window. This is the fix
// for users on the 1M-context variant of Opus / Sonnet — settings.json `env`
// block isn't forwarded to hook subprocesses, so the hook reads it from disk
// instead of process.env. ---
{
  const sid = uniqSession('8');
  const t = genTranscript(500_000);
  try {
    const out = runHook(
      MONITOR,
      {
        session_id: sid,
        transcript_path: t,
        cwd: HOOKS_DIR,
        tool_name: 'Bash',
        hook_event_name: 'PostToolUse',
        model: { id: 'claude-opus-4-7' },
      },
      { settings: { env: { CLAUDE_CONTEXT_WINDOW: '1000000' } } }
    );
    test('monitor: settings.json CLAUDE_CONTEXT_WINDOW=1000000 -> no warning at 500K bytes', () => {
      expect(!out.stdout.trim(), `expected empty stdout with 1M settings override, got: ${out.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- settings.json override: invalid value falls back to default 200K. ---
{
  const sid = uniqSession('9');
  const t = genTranscript(500_000);
  try {
    const out = runHook(
      MONITOR,
      {
        session_id: sid,
        transcript_path: t,
        cwd: HOOKS_DIR,
        tool_name: 'Bash',
        hook_event_name: 'PostToolUse',
        model: { id: 'claude-opus-4-7' },
      },
      { settings: { env: { CLAUDE_CONTEXT_WINDOW: 'not-a-number' } } }
    );
    test('monitor: invalid CLAUDE_CONTEXT_WINDOW falls back -> still warns at 500K bytes', () => {
      expect(/WARNING|CRITICAL/.test(out.stdout), `expected warning when settings override invalid, got: ${out.stdout.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// --- settings.json missing entirely: hook silently falls back to model lookup.
// Regression guard against an earlier draft that crashed when settings.json
// didn't exist. ---
{
  const sid = uniqSession('10');
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
    test('monitor: missing settings.json -> no warning at low usage, no crash', () => {
      expect(!out.stdout.trim(), `expected empty stdout, got: ${out.stdout.slice(0, 200)}`);
      expect(!out.stderr.match(/Error|throw|Cannot read/), `expected no error in stderr, got: ${out.stderr.slice(0, 200)}`);
    });
  } finally {
    fs.unlinkSync(t);
    clearSidecar(sid);
  }
}

// =====================================================================
// validate-commit hook tests
// =====================================================================

const VALIDATE_COMMIT = path.join(HOOKS_DIR, 'validate-commit.js');

function runValidateCommit(command) {
  return runHook(VALIDATE_COMMIT, {
    tool_name: 'Bash',
    hook_event_name: 'PreToolUse',
    tool_input: { command },
  });
}

// --- non-commit command: no-op ---
{
  const out = runValidateCommit('git status');
  test('validate-commit: non-commit bash command -> empty (allow)', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- git push: no-op ---
{
  const out = runValidateCommit('git push origin main');
  test('validate-commit: git push -> empty (allow)', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- valid feat commit ---
{
  const out = runValidateCommit('git commit -m "feat(hooks): add validate-commit"');
  test('validate-commit: valid feat -> allow', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- valid rule commit (jkwon-specific type extension) ---
{
  const out = runValidateCommit('git commit -m "rule: add stacked-pr trap rule"');
  test('validate-commit: rule: prefix -> allow (jkwon allowlist)', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- valid infra commit ---
{
  const out = runValidateCommit('git commit -m "infra: provision MinIO shared stack"');
  test('validate-commit: infra: prefix -> allow', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- valid breaking change (!) ---
{
  const out = runValidateCommit('git commit -m "feat(api)!: remove deprecated v1 endpoints"');
  test('validate-commit: breaking-change marker (!) -> allow', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- single-quoted message ---
{
  const out = runValidateCommit("git commit -m 'fix(deploy): retry on 503'");
  test('validate-commit: single-quoted -m -> allow', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- invalid: no type prefix ---
{
  const out = runValidateCommit('git commit -m "just a message without a prefix"');
  test('validate-commit: missing type prefix -> block', () => {
    expect(/decision":"block"/.test(out.stdout), `expected block, got: ${out.stdout.slice(0, 200)}`);
    expect(/CONVENTIONAL_COMMITS_VIOLATION/.test(out.stdout), `expected violation code, got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- invalid: unknown type ---
{
  const out = runValidateCommit('git commit -m "wibble(scope): bad type"');
  test('validate-commit: unknown type -> block', () => {
    expect(/decision":"block"/.test(out.stdout), `expected block, got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- invalid: subject too long (>100 chars) ---
{
  const longSubj = 'feat(hooks): ' + 'x'.repeat(105);
  const out = runValidateCommit(`git commit -m "${longSubj}"`);
  test('validate-commit: subject >100 chars -> block', () => {
    expect(/decision":"block"/.test(out.stdout), `expected block, got: ${out.stdout.slice(0, 200)}`);
    expect(/COMMIT_SUBJECT_TOO_LONG/.test(out.stdout), `expected length code, got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- env-prefix invocation: GIT_AUTHOR_NAME=x git commit -m "..." ---
{
  const out = runValidateCommit('GIT_AUTHOR_NAME=test git commit -m "feat: env-prefix invocation"');
  test('validate-commit: env-prefix git commit -> validated (allow on valid)', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- env-prefix with invalid message blocks ---
{
  const out = runValidateCommit('GIT_AUTHOR_NAME=test git commit -m "no prefix here"');
  test('validate-commit: env-prefix git commit with bad message -> block', () => {
    expect(/decision":"block"/.test(out.stdout), `expected block, got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- -C path: git -C /repo commit -m "..." ---
{
  const out = runValidateCommit('git -C /tmp/repo commit -m "fix(x): -C path form"');
  test('validate-commit: git -C path commit -> validated', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- full-path git ---
{
  const out = runValidateCommit('/usr/bin/git commit -m "chore: full-path git"');
  test('validate-commit: /usr/bin/git commit -> validated', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- no -m flag (interactive editor): allow ---
{
  const out = runValidateCommit('git commit --amend');
  test('validate-commit: git commit without -m (editor) -> allow', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- HEREDOC pattern (this repo's standard commit form) ---
{
  const heredocCmd =
    "git commit -m \"$(cat <<'EOF'\nfeat(hooks): add validate-commit\n\nLonger body explaining the change.\n\nCo-Authored-By: Claude\nEOF\n)\"";
  const out = runValidateCommit(heredocCmd);
  test('validate-commit: HEREDOC pattern with valid subject -> allow', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- HEREDOC pattern with invalid subject ---
{
  const heredocCmd =
    "git commit -m \"$(cat <<'EOF'\nbroken: not a real type\n\nBody.\nEOF\n)\"";
  const out = runValidateCommit(heredocCmd);
  test('validate-commit: HEREDOC pattern with invalid subject -> block', () => {
    expect(/decision":"block"/.test(out.stdout), `expected block, got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- Unrecognized command substitution: allow (don't false-block) ---
{
  const out = runValidateCommit('git commit -m "$(some-other-script)"');
  test('validate-commit: unknown command substitution -> allow (safe default)', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- empty message: allow (git itself will reject) ---
{
  const out = runValidateCommit('git commit -m ""');
  test('validate-commit: empty -m message -> allow (git handles)', () => {
    expect(out.stdout === '{}', `expected '{}', got: ${out.stdout.slice(0, 200)}`);
  });
}

// --- malformed JSON stdin: allow ---
{
  const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), `claude-test-home-${process.pid}-`));
  try {
    const result = spawnSync('node', [VALIDATE_COMMIT], {
      input: 'not json',
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome },
    });
    test('validate-commit: malformed stdin -> allow (silent-fail)', () => {
      expect(result.stdout === '{}', `expected '{}', got: ${(result.stdout || '').slice(0, 200)}`);
    });
  } finally {
    fs.rmSync(isolatedHome, { recursive: true, force: true });
  }
}

// =====================================================================
// git-cmd.js unit tests
// =====================================================================

const { isGitSubcommand, tokenize } = require(path.join(HOOKS_DIR, 'lib', 'git-cmd.js'));

test('git-cmd: bare git commit detected', () => {
  expect(isGitSubcommand('git commit -m "x"', 'commit'), 'bare commit not detected');
});

test('git-cmd: git status is not commit', () => {
  expect(!isGitSubcommand('git status', 'commit'), 'status falsely matched commit');
});

test('git-cmd: git -C /path commit detected', () => {
  expect(isGitSubcommand('git -C /tmp/repo commit -m "x"', 'commit'), '-C commit not detected');
});

test('git-cmd: GIT_AUTHOR_NAME=x git commit detected', () => {
  expect(
    isGitSubcommand('GIT_AUTHOR_NAME=test git commit -m "x"', 'commit'),
    'env-prefix commit not detected'
  );
});

test('git-cmd: /usr/bin/git commit detected', () => {
  expect(isGitSubcommand('/usr/bin/git commit -m "x"', 'commit'), 'full-path commit not detected');
});

test('git-cmd: --git-dir=path commit detected', () => {
  expect(
    isGitSubcommand('git --git-dir=.git commit -m "x"', 'commit'),
    '--git-dir= commit not detected'
  );
});

test('git-cmd: multiple env vars + global flag', () => {
  expect(
    isGitSubcommand('GIT_AUTHOR_NAME=a GIT_COMMITTER_EMAIL=b git -c color.ui=false commit', 'commit'),
    'complex prefix not handled'
  );
});

test('git-cmd: empty command returns false', () => {
  expect(!isGitSubcommand('', 'commit'), 'empty matched');
});

test('git-cmd: not-git returns false', () => {
  expect(!isGitSubcommand('npm commit', 'commit'), 'npm matched');
});

test('git-cmd: tokenize handles double-quoted strings', () => {
  const t = tokenize('git commit -m "hello world"');
  expect(t.length === 4 && t[3] === 'hello world', `bad tokenize: ${JSON.stringify(t)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
