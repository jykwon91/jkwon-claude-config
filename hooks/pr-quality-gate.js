#!/usr/bin/env node
// hooks/pr-quality-gate.js
//
// Self-gating PR quality gate.
//
// History: this logic used to be a `type: agent` PreToolUse hook in
// settings.json gated by `if: "Bash(gh pr create*)"`. Per
// rules/claude-code-hook-if-field-unreliable.md the inner `if` field does NOT
// reliably filter a Bash-matcher hook, so the agent fired on EVERY Bash tool
// call — a ~120s Haiku review that could block any git command in auto mode.
// A `type: agent` hook has no body in which to self-gate, so it is converted
// here to a `type: command` hook that reads the triggering command from stdin
// and only runs the review when the command is actually `gh pr create`.
//
// The review itself is unchanged: it shells out to a headless `claude -p` with
// the original Haiku prompt (hooks/pr-quality-gate.prompt.md) and passes the
// {decision:"block"} / {} result straight through. `--safe-mode` keeps auth +
// built-in tools but disables hooks, so the nested review never re-triggers
// this (or any) hook.
//
// FAIL-OPEN by design: any error — bad stdin, missing prompt, claude spawn
// failure, non-zero exit, timeout, unparseable output — emits `{}` (allow).
// The gate only ever BLOCKS when the nested review explicitly returns a block
// decision. A bug in this script can therefore never recreate the original
// "blocks every Bash call" failure; the worst case is the gate silently no-ops.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PASS = '{}';

function emit(obj) {
  process.stdout.write(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

// Match `gh pr create` only at a command boundary: the start of the command, or
// immediately after an `&&` chain. Deliberately strict — a false positive here
// recreates the very "blocks every Bash call" bug we are fixing, whereas a
// false negative merely skips the gate on an unusual invocation. Use `(?=\s|$)`
// not `\b` — `\b` matches a hyphen, so `gh pr create-x` would slip through
// (rules/claude-code-hook-if-field-unreliable.md).
const PR_CREATE = /(?:^|&&\s*)gh\s+pr\s+create(?=\s|$)/;

// Pull a decision object out of the model's free-text reply. Tries a direct
// parse first (the prompt asks for bare JSON), then falls back to scanning for
// the last balanced top-level {...} object. Returns the parsed object or null.
function extractDecision(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch (e) { /* fall through to scan */ }
  let last = null;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < trimmed.length; j++) {
      const ch = trimmed[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { last = JSON.parse(trimmed.slice(i, j + 1)); } catch (e) { /* skip */ }
          i = j; // advance past this object
          break;
        }
      }
    }
  }
  return last;
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

// Run the headless review. Returns a decision object, or null to fail open.
function runReview() {
  let prompt;
  try {
    prompt = fs.readFileSync(path.join(__dirname, 'pr-quality-gate.prompt.md'), 'utf8');
  } catch (e) {
    return null; // prompt missing -> fail open
  }
  let res;
  try {
    res = spawnSync('claude', [
      '-p',
      '--model', 'claude-haiku-4-5-20251001',
      '--output-format', 'json',
      '--safe-mode',                              // keep auth + tools, disable hooks (no recursion)
      '--permission-mode', 'bypassPermissions',   // read-only review runs unattended
      '--tools', 'Bash,Read,Grep,Glob',
      '--no-session-persistence',
      '--max-budget-usd', '1.0',                  // generous ceiling; a Haiku review is cents
    ], {
      input: prompt,
      encoding: 'utf8',
      timeout: 110000,                            // finish before the hook's 120s budget
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      shell: true,                                // resolve claude.cmd / claude.exe on Windows
    });
  } catch (e) {
    return null;
  }
  if (!res || res.status !== 0 || !res.stdout) return null;
  let envelope;
  try { envelope = JSON.parse(res.stdout); } catch (e) { return null; }
  const resultText = (envelope && (envelope.result || envelope.text)) || '';
  return extractDecision(resultText);
}

async function main() {
  let data;
  try { data = JSON.parse((await readStdin()) || '{}'); }
  catch (e) { emit(PASS); return; }

  const cmd = ((data && data.tool_input && data.tool_input.command) || '').toString().trim();

  // Self-gate: only run the review for a real `gh pr create`.
  if (!PR_CREATE.test(cmd)) { emit(PASS); return; }

  const decision = runReview();
  if (decision && decision.decision === 'block' && decision.reason) {
    emit({ decision: 'block', reason: String(decision.reason) });
  } else {
    emit(PASS);
  }
}

if (require.main === module) {
  main().catch(() => emit(PASS));
} else {
  // Exported for unit tests; importing the module must not run the gate.
  module.exports = { PR_CREATE, extractDecision };
}
