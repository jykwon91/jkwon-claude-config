#!/usr/bin/env node
// PreToolUse hook: blocks irreversible database-level destruction —
// `DROP DATABASE ...` (via any SQL client) and the `dropdb` CLI.
//
// Why this exists: on 2026-05-17 a session dropped the SHARED local
// `mygamingassistant_test` dev DB to get a clean base->head migrate. The
// app role lacked CREATEDB and all auth was scram, so only the operator
// (superuser) could recreate it — shared state destroyed with no
// assistant-side rollback path, session stalled. `DROP DATABASE`/`dropdb`
// is the rare irreversible op where the cost of a false block (rephrase
// the command) is trivial next to the cost of a false allow (unrecoverable
// loss of a resource another session may be using). See
// rules/no-drop-database-prefer-schema-reset.md.
//
// This does NOT block the reversible alternative the rule prescribes
// (`DROP SCHEMA ... CASCADE; CREATE SCHEMA ...`), nor DROP TABLE/INDEX/etc.
// Only database-level destruction.
//
// Self-gates inside the hook body (per
// claude-code-hook-if-field-unreliable.md the `if` field is documentation
// only — the outer Bash matcher fires on every Bash call). The hook is
// therefore safe to run on every Bash call: anything that is not an
// executing DROP DATABASE / dropdb returns `{}` unconditionally.

const path = require('path');
const { tokenize } = require(path.join(__dirname, 'lib', 'git-cmd.js'));

// Leading commands that only READ/PRINT text — a `DROP DATABASE` literal
// here is a search/echo, not an execution. Keeps grep/rg false positives
// from blocking.
const READ_ONLY_LEADERS = new Set([
  'grep', 'rg', 'egrep', 'fgrep', 'ag', 'ack', 'ripgrep',
  'cat', 'bat', 'less', 'more', 'head', 'tail',
  'echo', 'printf', 'true', ':',
]);

// SQL clients that would actually execute a `DROP DATABASE` statement.
const SQL_CLIENTS = new Set([
  'psql', 'mysql', 'mariadb', 'sqlite3', 'usql', 'cockroach',
  'pgcli', 'mycli', 'litecli',
]);

async function readStdin() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

// Walk tokens skipping VAR=VALUE env prefixes; return the basenames of the
// real command words (so `/usr/bin/dropdb` and `PGPASSWORD=x dropdb` both
// resolve to `dropdb`). Also returns the first real leader for the
// read-only check.
function commandBasenames(cmd) {
  const tokens = tokenize(cmd);
  const names = [];
  let sawLeader = false;
  let leader = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!sawLeader && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) continue; // env prefix
    const base = path.basename(t).toLowerCase();
    if (!sawLeader) {
      sawLeader = true;
      leader = base;
    }
    names.push(base);
  }
  return { names, leader };
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
  if (!cmd) {
    process.stdout.write('{}');
    return;
  }

  const { names, leader } = commandBasenames(cmd);
  const invokesDropdb = names.includes('dropdb');
  const hasDropDatabaseSql = /\bdrop\s+database\b/i.test(cmd);

  let block = false;
  let what = '';

  if (invokesDropdb) {
    block = true;
    what = 'the `dropdb` CLI';
  } else if (hasDropDatabaseSql) {
    // A bare `grep "DROP DATABASE" ...` / `echo` is a search, not an
    // execution — allow it. Only treat as executing when a SQL client is
    // invoked, a heredoc feeds a client, or an inline -c/-e/-f flag is used.
    const isReadOnly =
      READ_ONLY_LEADERS.has(leader) &&
      !names.some((n) => SQL_CLIENTS.has(n));
    const looksExecuting =
      names.some((n) => SQL_CLIENTS.has(n)) ||
      /<<-?\s*['"]?\w/.test(cmd) ||
      /(^|\s)(-c|--command|-e|--execute|-f|--file)(\s|=|$)/.test(cmd);
    if (!isReadOnly && looksExecuting) {
      block = true;
      what = 'a `DROP DATABASE` statement';
    }
  }

  if (!block) {
    process.stdout.write('{}');
    return;
  }

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Blocked ${what}. DROP DATABASE / dropdb is irreversible and a ` +
      `shared local dev/test DB usually can't be recreated by the app ` +
      `role (it lacks CREATEDB; only a superuser can) — dropping it ` +
      `destroys state another session may be using with no rollback ` +
      `path.\n\n` +
      `If you need a clean schema for a base->head migrate, use the ` +
      `REVERSIBLE alternative the app role CAN do: connect as the app ` +
      `role to the same DB and run ` +
      `\`DROP SCHEMA public CASCADE; CREATE SCHEMA public;\` then ` +
      `\`alembic upgrade head\`.\n\n` +
      `If a full database drop is genuinely required, the OPERATOR ` +
      `should perform it (human-in-the-loop for irreversible ` +
      `destruction of a shared resource). ` +
      `See rules/no-drop-database-prefer-schema-reset.md.`,
  }));
})().catch(() => process.stdout.write('{}'));
