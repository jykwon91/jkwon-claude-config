#!/usr/bin/env node
// Context Statusline — optional companion to context-monitor.js.
//
// Reads cached metrics (or computes them) and prints a one-line status
// for Claude Code's statusLine. Opt-in: not auto-registered. Add to your
// ~/.claude/settings.json manually — see hooks/README.md.

const path = require('path');

const {
  computeMetrics,
  readFreshMetrics,
  writeJson,
  metricsPathFor,
  safeSessionId,
  formatTokens,
  readStdin,
} = require(path.join(__dirname, 'lib', 'context.js'));

// Statusline runs frequently; keep the cache window short so the displayed
// number tracks reality without re-reading the transcript every tick.
const STALE_SECONDS = 15;

async function main() {
  let data;
  try {
    data = JSON.parse((await readStdin(3000)) || '{}');
  } catch (e) {
    process.exit(0);
  }

  const sessionId = safeSessionId(data.session_id);
  const cwd = data.cwd || '';
  const cwdShort = cwd ? path.basename(cwd) : '';
  const modelDisplay =
    (data.model && (data.model.display_name || data.model.id)) || '';

  let metrics = null;
  if (sessionId) {
    metrics = readFreshMetrics(sessionId, STALE_SECONDS);
    if (!metrics) {
      metrics = computeMetrics(data);
      if (metrics) writeJson(metricsPathFor(sessionId), metrics);
    }
  }

  if (!metrics) {
    // No transcript yet — emit a minimal line so the statusline isn't blank.
    const fallback = [cwdShort, modelDisplay].filter(Boolean).join(' | ');
    if (fallback) process.stdout.write(fallback);
    return;
  }

  const used = metrics.used_pct;
  // Use plain ASCII indicators, not emojis (matches user's no-emoji preference).
  const indicator = used >= 75 ? ' !!' : used >= 65 ? ' !' : '';
  const ctxLine = `ctx ${used}%${indicator} (${formatTokens(metrics.used_tokens)}/${formatTokens(metrics.context_window)})`;
  const parts = [ctxLine];
  if (cwdShort) parts.push(cwdShort);
  if (modelDisplay) parts.push(modelDisplay);
  process.stdout.write(parts.join(' | '));
}

main().catch(() => process.exit(0));
