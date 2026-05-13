#!/usr/bin/env node
// Context Monitor — PostToolUse hook.
//
// After every tool call, estimate how much of the model's context window
// is used. When remaining context drops below thresholds, inject a
// warning into the conversation so the AGENT — not just the user — can
// react (wrap up the current task, summarize state, commit work) before
// auto-compaction or context-limit errors hit mid-task.
//
// This is the half of the GSD context-monitor pattern that surfaces
// context state to the model. The optional context-statusline.js shows
// the same numbers to the user; both reuse the cached sidecar metrics.

const path = require('path');
const fs = require('fs');

const {
  computeMetrics,
  readFreshMetrics,
  writeJson,
  metricsPathFor,
  debouncePathFor,
  safeSessionId,
  formatTokens,
  readStdin,
  nowSeconds,
} = require(path.join(__dirname, 'lib', 'context.js'));

// Remaining-context thresholds (percent of the model's context window).
const WARNING_THRESHOLD = 35;
const CRITICAL_THRESHOLD = 25;

// How long a cached sidecar is considered fresh enough to skip re-reading
// the transcript. Re-reads are cheap (a stat + size) so this is short.
const STALE_SECONDS = 60;

// Minimum tool calls between warnings of the same severity. Severity
// escalation (WARNING -> CRITICAL) bypasses the debounce.
const DEBOUNCE_CALLS = 5;

async function main() {
  let data;
  try {
    data = JSON.parse((await readStdin(5000)) || '{}');
  } catch (e) {
    // Silently exit — never let a hook failure break the tool call.
    process.exit(0);
  }

  const sessionId = safeSessionId(data.session_id);
  if (!sessionId) process.exit(0);

  // Refresh metrics from transcript if cache is stale or missing.
  let metrics = readFreshMetrics(sessionId, STALE_SECONDS);
  if (!metrics) {
    metrics = computeMetrics(data);
    if (metrics) writeJson(metricsPathFor(sessionId), metrics);
  }
  if (!metrics) process.exit(0);

  // Determine severity from remaining percentage.
  const remaining = metrics.remaining_pct;
  let severity = null;
  if (remaining <= CRITICAL_THRESHOLD) severity = 'CRITICAL';
  else if (remaining <= WARNING_THRESHOLD) severity = 'WARNING';
  if (!severity) process.exit(0);

  // Debounce: don't re-emit the same severity until DEBOUNCE_CALLS more tool
  // uses have happened, but always escalate WARNING -> CRITICAL immediately.
  const dbnPath = debouncePathFor(sessionId);
  let dbn = (function () {
    try {
      return JSON.parse(fs.readFileSync(dbnPath, 'utf8'));
    } catch (e) {
      return { last_severity: null, call_at_last_warn: 0, calls: 0 };
    }
  })();
  dbn.calls = (dbn.calls || 0) + 1;

  const escalated = dbn.last_severity === 'WARNING' && severity === 'CRITICAL';
  const callsSinceLast = dbn.calls - (dbn.call_at_last_warn || 0);
  const shouldFire =
    dbn.last_severity !== severity || escalated || callsSinceLast >= DEBOUNCE_CALLS;

  if (!shouldFire) {
    writeJson(dbnPath, dbn);
    process.exit(0);
  }

  dbn.last_severity = severity;
  dbn.call_at_last_warn = dbn.calls;
  writeJson(dbnPath, dbn);

  const used = 100 - remaining;
  const ctx = formatTokens(metrics.context_window);
  const usedAbs = formatTokens(metrics.used_tokens);

  const msg =
    severity === 'CRITICAL'
      ? `Context monitor: CRITICAL — ${used}% of the ${ctx} context window is used (~${usedAbs}). Stop starting new tasks. Summarize current state for the user, surface any uncommitted work (open branches, unpushed commits, in-flight PR URLs), and end the turn. Auto-compaction or context-limit errors may be imminent.`
      : `Context monitor: WARNING — ${used}% of the ${ctx} context window is used (~${usedAbs}). Finish what's already in flight; avoid starting unrelated new work. Consider summarizing the session and committing/pushing any in-flight changes before continuing.`;

  // PostToolUse hooks can inject additionalContext into the conversation
  // via hookSpecificOutput. The agent sees this on its next turn.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: msg,
      },
    })
  );
}

main().catch(() => process.exit(0));

// Reference unused variable to satisfy linters when nowSeconds isn't called
// here directly (it's used through the shared lib).
void nowSeconds;
