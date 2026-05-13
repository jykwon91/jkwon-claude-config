#!/usr/bin/env node
// PreToolUse hook: validates `git commit -m "..."` messages against an
// allowlist of commit types and a max subject length. Blocks on violation;
// silent on anything that isn't a `git commit` with an inline message.
//
// Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci,
//   chore, rule, infra
//   (rule + infra extend standard Conventional Commits — they're observed in
//    this repo's history. Edit ALLOWED_TYPES below to extend.)
//
// Max subject length: 100 chars.
//
// Self-gates inside the hook body via hooks/lib/git-cmd.js so the existing
// `if: "Bash(git commit*)"` matcher in settings.json is treated as
// documentation only (per claude-code-hook-if-field-unreliable.md).
//
// HEREDOC-aware: `git commit -m "$(cat <<'EOF'\n<msg>\nEOF\n)"` extracts the
// message body before validating. If extraction fails for an unrecognized
// HEREDOC shape, the hook allows the commit rather than risk a false block.

const path = require('path');
const { isGitSubcommand } = require(path.join(__dirname, 'lib', 'git-cmd.js'));

const ALLOWED_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test',
  'build', 'ci', 'chore', 'rule', 'infra',
];

const MAX_SUBJECT_LEN = 100;

const FORMAT_RE = new RegExp(
  '^(' + ALLOWED_TYPES.join('|') + ')(\\([^)]+\\))?!?: .+'
);

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

// Extract the commit message body from the `-m` argument. Handles:
//   -m "<plain>"
//   -m '<plain>'
//   -m "$(cat <<'EOF'\n<body>\nEOF\n)"  (HEREDOC pattern used by this repo)
//   -m $'<ansi-c quoted>'
// Returns the message body, or null if it can't be extracted (the hook then
// allows the commit rather than risk a false-positive block).
function extractMessage(cmd) {
  // HEREDOC pattern first — distinguishable by the literal `$(cat <<` opener.
  // Capture group 1 = delimiter (EOF | END | etc.), group 2 = body.
  const heredoc = cmd.match(
    /-m\s+"\$\(\s*cat\s+<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1\s*\n?\s*\)\s*"/
  );
  if (heredoc) return heredoc[2];

  // Plain double-quoted. Skip if the content is a command substitution we
  // didn't recognize above — extracting that would yield the raw shell, not
  // the message body, and we'd produce nonsense errors.
  const dq = cmd.match(/-m\s+"((?:[^"\\]|\\.)*)"/);
  if (dq) {
    const inner = dq[1];
    if (/^\s*\$\(/.test(inner)) return null;
    return inner;
  }

  // Plain single-quoted.
  const sq = cmd.match(/-m\s+'((?:[^'\\]|\\.)*)'/);
  if (sq) return sq[1];

  // ANSI-C quoted (rare).
  const ansi = cmd.match(/-m\s+\$'((?:[^'\\]|\\.)*)'/);
  if (ansi) return ansi[1];

  return null;
}

(async () => {
  let data = {};
  try {
    data = JSON.parse((await readStdin()) || '{}');
  } catch (e) {
    process.stdout.write('{}');
    return;
  }

  const cmd = (data && data.tool_input && data.tool_input.command) || '';
  if (!isGitSubcommand(cmd, 'commit')) {
    process.stdout.write('{}');
    return;
  }

  const msg = extractMessage(cmd);
  if (msg === null) {
    // No -m flag, or unrecognized substitution shape — allow.
    process.stdout.write('{}');
    return;
  }

  const subject = msg.split('\n')[0].trim();
  if (!subject) {
    process.stdout.write('{}');
    return;
  }

  if (!FORMAT_RE.test(subject)) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      code: 'CONVENTIONAL_COMMITS_VIOLATION',
      reason:
        'Commit subject must match `<type>(<scope>): <description>`. ' +
        'Allowed types: ' + ALLOWED_TYPES.join(', ') + '. ' +
        'Got: ' + JSON.stringify(subject.slice(0, 80)),
    }));
    return;
  }

  if (subject.length > MAX_SUBJECT_LEN) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      code: 'COMMIT_SUBJECT_TOO_LONG',
      reason:
        `Commit subject is ${subject.length} chars; max ${MAX_SUBJECT_LEN}. ` +
        'Move detail to the commit body.',
    }));
    return;
  }

  process.stdout.write('{}');
})().catch(() => process.stdout.write('{}'));
