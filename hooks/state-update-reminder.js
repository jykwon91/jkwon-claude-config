#!/usr/bin/env node
// PostToolUse hook on file-modifying tools (Edit, Write, MultiEdit,
// NotebookEdit). Reminds the agent to refresh the project's STATE.md when
// meaningful work has happened and the state file is stale.
//
// Triggers on: Edit | Write | MultiEdit | NotebookEdit tool calls
// Action: Advisory `additionalContext` reminder. Does NOT block tool calls.
// Silent when STATE.md doesn't exist (effectively opt-in by file presence).
//
// Resolves the STATE.md path via:
//   <home>/.claude/projects/<project-hash>/STATE.md
// where project-hash = cwd with `\` `/` `:` all replaced with `-`. This
// matches Claude Code's `~/.claude/projects/` directory naming convention.
//
// Session-tracking sidecar at:
//   $TMPDIR/claude-state-reminder-<session_id>.json
// tracks call count + last-reminder + last-seen STATE mtime so the hook can
// debounce reminders and recognise when STATE.md was touched this session.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Don't remind during the first N modifications — let the session warm up.
const REMIND_AFTER_CALLS = 10;
// After firing, suppress further reminders for N modifications.
const DEBOUNCE_AFTER_REMIND = 20;

function projectHash(cwd) {
  if (!cwd) return null;
  // Replace path separators and colon with dash. Matches Claude Code's
  // `~/.claude/projects/` directory naming convention. `C:\X\Y` -> `C--X-Y`;
  // `/a/b/c` -> `-a-b-c`.
  return cwd.replace(/[\\/:]/g, '-');
}

function sidecarPath(sessionId) {
  // Defensively reject session ids that contain path-traversal characters or
  // separators so a malicious id can't escape the tmpdir.
  if (!sessionId || /[\/\\.]/.test(sessionId)) return null;
  return path.join(os.tmpdir(), `claude-state-reminder-${sessionId}.json`);
}

function readSidecar(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    /* missing / unparseable — fall through */
  }
  return { call_count: 0, last_remind_at_call: 0, last_state_mtime: null };
}

function writeSidecar(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data));
  } catch (e) {
    /* best-effort; never block */
  }
}

function formatAge(mtimeMs) {
  const ageMs = Date.now() - mtimeMs;
  if (ageMs < 0) return 'just now';
  if (ageMs < 60_000) return 'less than a minute ago';
  if (ageMs < 3_600_000) return Math.floor(ageMs / 60_000) + ' minutes ago';
  if (ageMs < 86_400_000) return Math.floor(ageMs / 3_600_000) + ' hours ago';
  const days = Math.floor(ageMs / 86_400_000);
  return days + ' day' + (days === 1 ? '' : 's') + ' ago';
}

let inputBuf = '';
const stdinTimeout = setTimeout(() => process.exit(0), 5000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { inputBuf += c; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(inputBuf);
    if (!TOOLS.has(data.tool_name)) return process.exit(0);

    const cwd = data.cwd || '';
    const sessionId = data.session_id || '';
    const hash = projectHash(cwd);
    if (!hash) return process.exit(0);

    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) return process.exit(0);

    const stateFile = path.join(home, '.claude', 'projects', hash, 'STATE.md');
    if (!fs.existsSync(stateFile)) return process.exit(0);

    const sidecar = sidecarPath(sessionId);
    if (!sidecar) return process.exit(0);

    const meta = readSidecar(sidecar);
    meta.call_count = (meta.call_count || 0) + 1;

    const stateMtimeMs = fs.statSync(stateFile).mtimeMs;

    // STATE was touched this session — quiet, and remember the new mtime so
    // the next staleness check is anchored from now.
    if (meta.last_state_mtime != null && stateMtimeMs > meta.last_state_mtime) {
      meta.last_state_mtime = stateMtimeMs;
      meta.last_remind_at_call = meta.call_count;
      writeSidecar(sidecar, meta);
      return process.exit(0);
    }
    if (meta.last_state_mtime == null) {
      // First sighting this session — record baseline.
      meta.last_state_mtime = stateMtimeMs;
    }

    // Warm-up — don't remind during the first N modifications.
    if (meta.call_count < REMIND_AFTER_CALLS) {
      writeSidecar(sidecar, meta);
      return process.exit(0);
    }

    // Debounce — don't remind more than once per N modifications after firing.
    const callsSinceRemind = meta.call_count - (meta.last_remind_at_call || 0);
    if (meta.last_remind_at_call && callsSinceRemind < DEBOUNCE_AFTER_REMIND) {
      writeSidecar(sidecar, meta);
      return process.exit(0);
    }

    meta.last_remind_at_call = meta.call_count;
    writeSidecar(sidecar, meta);

    const age = formatAge(stateMtimeMs);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `STATE.md was last updated ${age} and has not been touched this session, ` +
          `but ${meta.call_count} file modifications have occurred. ` +
          `If your work has materially advanced, refresh STATE.md so the next session ` +
          `can pick up cold. Location: ${stateFile}`,
      },
    }));
  } catch (e) {
    process.exit(0);
  }
});
