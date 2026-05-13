// Shared library for context-monitor + context-statusline hooks.
// Estimates context usage from the transcript file and caches metrics
// in a sidecar JSON so both hooks see the same number.

const fs = require('fs');
const os = require('os');
const path = require('path');

// Known model id -> context window. Falls back to DEFAULT_WINDOW.
// Keys are lowercased at lookup time so casing in stdin payloads doesn't matter.
const CONTEXT_WINDOWS = {
  'claude-opus-4-7': 200_000,
  'claude-opus-4-7[1m]': 1_000_000,
  'claude-sonnet-4-6': 200_000,
  'claude-sonnet-4-6[1m]': 1_000_000,
  'claude-haiku-4-5': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
};
const DEFAULT_WINDOW = 200_000;

// Approximate fixed overhead for system prompt + tool definitions + injected
// CLAUDE.md content. Tuned for Claude Code with this config repo loaded.
const SYSTEM_OVERHEAD = 30_000;

// English markdown averages ~3.5 chars/token. Slightly conservative so we
// over-estimate usage rather than under-warn.
const CHARS_PER_TOKEN = 3.5;

function metricsPathFor(sessionId) {
  return path.join(os.tmpdir(), `claude-ctx-${safeSessionId(sessionId)}.json`);
}

function debouncePathFor(sessionId) {
  return path.join(os.tmpdir(), `claude-ctx-${safeSessionId(sessionId)}.debounce.json`);
}

// Reject session IDs containing path separators or traversal sequences —
// they end up in temp-file names and must not escape the temp dir.
function safeSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return null;
  if (/[\\/]|\.\./.test(sessionId)) return null;
  return sessionId;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeJson(p, obj) {
  try {
    fs.writeFileSync(p, JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function readFreshMetrics(sessionId, maxAgeSeconds) {
  if (!safeSessionId(sessionId)) return null;
  const m = readJson(metricsPathFor(sessionId));
  if (!m || typeof m.timestamp !== 'number') return null;
  if (nowSeconds() - m.timestamp > maxAgeSeconds) return null;
  return m;
}

function resolveContextWindow(modelId) {
  // Highest precedence: explicit user override. The PostToolUse hook payload
  // doesn't include model info, and even when it does (statusline), the model
  // id is the bare `claude-opus-4-7` regardless of whether the user is on the
  // 200K default or the 1M variant — the 1M tier is enabled via a beta
  // header, not the model id. So users on 1M MUST set this env var or the
  // hook will measure them against the 200K default and fire false CRITICAL.
  const envVal = parseInt(process.env.CLAUDE_CONTEXT_WINDOW, 10);
  if (Number.isFinite(envVal) && envVal > 0) return envVal;

  if (!modelId) return DEFAULT_WINDOW;
  const key = String(modelId).toLowerCase();
  return CONTEXT_WINDOWS[modelId] || CONTEXT_WINDOWS[key] || DEFAULT_WINDOW;
}

function computeMetrics(data) {
  if (!data || !safeSessionId(data.session_id)) return null;
  const transcriptPath = data.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

  let size = 0;
  try {
    size = fs.statSync(transcriptPath).size;
  } catch (e) {
    return null;
  }

  const modelId = (data.model && (data.model.id || data.model.display_name)) || '';
  const ctx = resolveContextWindow(modelId);
  const usedTokens = Math.round(size / CHARS_PER_TOKEN) + SYSTEM_OVERHEAD;
  const usedPct = Math.min(100, Math.max(0, Math.round((usedTokens / ctx) * 100)));

  return {
    session_id: data.session_id,
    used_tokens: usedTokens,
    context_window: ctx,
    used_pct: usedPct,
    remaining_pct: 100 - usedPct,
    timestamp: nowSeconds(),
    model: modelId,
  };
}

// Return cached metrics if fresh, otherwise compute and cache.
function getOrComputeMetrics(data, maxAgeSeconds) {
  const cached = readFreshMetrics(data.session_id, maxAgeSeconds);
  if (cached) return cached;
  const computed = computeMetrics(data);
  if (computed) writeJson(metricsPathFor(data.session_id), computed);
  return computed;
}

function formatTokens(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function readStdin(timeoutMs = 5000) {
  return new Promise((resolve) => {
    let buf = '';
    const t = setTimeout(() => resolve(buf), timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => {
      clearTimeout(t);
      resolve(buf);
    });
    process.stdin.on('error', () => {
      clearTimeout(t);
      resolve(buf);
    });
  });
}

module.exports = {
  CONTEXT_WINDOWS,
  DEFAULT_WINDOW,
  SYSTEM_OVERHEAD,
  CHARS_PER_TOKEN,
  metricsPathFor,
  debouncePathFor,
  safeSessionId,
  readJson,
  writeJson,
  nowSeconds,
  readFreshMetrics,
  resolveContextWindow,
  computeMetrics,
  getOrComputeMetrics,
  formatTokens,
  readStdin,
};
