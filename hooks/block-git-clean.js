#!/usr/bin/env node
// PreToolUse hook: blocks `git clean` invocations that force-delete UNTRACKED
// (non-ignored) files — the irreversible form that wipes source git never
// backed up.
//
// Why this exists: on 2026-07-19 a session ran `git clean -fd` in an MGA
// backend checkout that held ~180 UNTRACKED operator pipeline scripts (never
// committed). They were deleted instantly. Git keeps no reflog/object for
// untracked files, so there was no normal recovery path — the tooling was
// only recovered by luck (a dropped `git stash -u` had once staged them, so
// the blobs survived as an unreachable object found via `git fsck`). Had that
// stash never existed, ~180 durable scripts would have been gone for good.
//
// `git clean -f{d,x}` is the rare irreversible op where the cost of a false
// block (run the dry-run, then decide) is trivial next to the cost of a false
// allow (unrecoverable loss of untracked work). See
// rules/no-git-clean-force-without-dry-run.md.
//
// What is ALLOWED (returns `{}`):
//   - `git clean -n` / `--dry-run`      (previews, deletes nothing)
//   - `git clean` with no force flag    (git refuses to run without -f)
//   - `git clean -fdX` / `-fX`          (UPPERCASE X = remove ONLY ignored
//                                        files, i.e. build junk — cannot touch
//                                        untracked source)
//   - anything that is not a `git clean`
//
// What is BLOCKED:
//   - `git clean -f`, `-fd`, `-fdx`, `-xf`, `--force ...` (removes untracked,
//     and with lowercase -x also ignored, non-source-safe)
//
// Self-gates inside the hook body (per claude-code-hook-if-field-unreliable.md
// the `if` field is documentation only — the outer Bash matcher fires on every
// Bash call). Safe to run on every Bash call: anything that is not a
// force-removing `git clean` returns `{}` unconditionally.

const path = require('path');
const { isGitSubcommand, tokenize } = require(path.join(__dirname, 'lib', 'git-cmd.js'));

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

// Split a compound command into the segments a shell would run separately, so
// `foo && git clean -fd` and `a; git clean -fd` are each inspected. Splits on
// && || | ; and newlines. Coarse (doesn't parse quotes) but a `git clean` in a
// quoted string still only matters if it's actually the segment's command,
// which isGitSubcommand re-validates.
function shellSegments(cmd) {
  return cmd.split(/(?:&&|\|\||[;|\n])/).map((s) => s.trim()).filter(Boolean);
}

// For a segment already confirmed to be `git clean`, scan the flags that follow
// the `clean` subcommand and classify the removal scope.
function classifyClean(segment) {
  const tokens = tokenize(segment);
  const cleanIdx = tokens.indexOf('clean');
  const flags = cleanIdx === -1 ? [] : tokens.slice(cleanIdx + 1);

  let force = false;
  let dryRun = false;
  let lowerX = false; // remove untracked + ignored
  let upperX = false; // remove ONLY ignored

  for (const t of flags) {
    if (t === '--') break; // path separator — remaining tokens are paths
    if (t === '--force') { force = true; continue; }
    if (t === '--dry-run') { dryRun = true; continue; }
    if (t.startsWith('--')) continue; // --exclude=... etc. — irrelevant here
    if (t.startsWith('-') && t.length > 1) {
      // short cluster like -fd, -fdx, -xf (case-sensitive: x vs X)
      for (const ch of t.slice(1)) {
        if (ch === 'f') force = true;
        else if (ch === 'n') dryRun = true;
        else if (ch === 'x') lowerX = true;
        else if (ch === 'X') upperX = true;
      }
    }
  }

  // Dangerous = force-deletes untracked (non-ignored) source.
  //   - no force            -> git refuses; harmless
  //   - dry run             -> deletes nothing
  //   - upperX && !lowerX   -> ignored-only (build junk); safe
  const ignoredOnly = upperX && !lowerX;
  const dangerous = force && !dryRun && !ignoredOnly;
  return { dangerous };
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
  if (!cmd || !/\bclean\b/.test(cmd)) {
    process.stdout.write('{}');
    return;
  }

  const dangerous = shellSegments(cmd).some(
    (seg) => isGitSubcommand(seg, 'clean') && classifyClean(seg).dangerous,
  );

  if (!dangerous) {
    process.stdout.write('{}');
    return;
  }

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      'Blocked `git clean` with a force flag that deletes UNTRACKED files. ' +
      'Untracked files have no git reflog/object backup — `git clean -fd` ' +
      'deletes them instantly and irreversibly (this wiped ~180 untracked ' +
      'operator scripts on 2026-07-19, recovered only by luck).\n\n' +
      'Do this instead:\n' +
      '  1. PREVIEW first — `git clean -nd` lists exactly what would be ' +
      'deleted. Read it.\n' +
      '  2. If you want a clean tree, prefer `git stash -u` (recoverable) ' +
      'over deleting.\n' +
      '  3. If untracked files are worth keeping, TRACK them ' +
      '(`git add` + commit) so a future clean can\'t touch them.\n' +
      '  4. To remove only build junk, use UPPERCASE `-X` ' +
      '(`git clean -fdX`) — it removes only gitignored files, never ' +
      'untracked source.\n' +
      '  5. If a force clean of untracked files is genuinely intended, the ' +
      'operator should run it themselves (via the `!` prefix) after ' +
      'reviewing the dry-run.\n\n' +
      'See rules/no-git-clean-force-without-dry-run.md.',
  }));
})().catch(() => process.stdout.write('{}'));
