#!/usr/bin/env node
// Smoke tests for hooks/block-drop-database.js.
//
// Pure string-parsing hook — no git repo / DB needed. Verifies: executing
// DROP DATABASE / dropdb blocks; the reversible DROP SCHEMA alternative is
// NOT blocked; read/search mentions of the phrase are allowed; the gate
// returns `{}` for everything else.

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.join(__dirname, 'block-drop-database.js');

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

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runHook(command) {
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    timeout: 5000,
  });
  return (result.stdout || '').trim();
}

function expectAllow(command) {
  const out = runHook(command);
  expect(out === '{}', `expected "{}" for ${JSON.stringify(command)}, got ${JSON.stringify(out)}`);
}

function expectBlock(command) {
  const out = runHook(command);
  const parsed = JSON.parse(out || '{}');
  expect(parsed.decision === 'block', `expected block for ${JSON.stringify(command)}, got ${JSON.stringify(parsed)}`);
  expect(/DROP SCHEMA public CASCADE/.test(parsed.reason || ''),
    `block reason must point to the reversible alternative, got ${JSON.stringify(parsed.reason)}`);
}

console.log('Block-drop-database smoke tests\n');

// ---- 1. Allow: non-matching / read-only / the reversible alternative ----

const allow = [
  '',
  'ls -la',
  'git commit -m "feat: x"',
  'git commit -m "chore: drop database cleanup notes"',  // phrase in a commit msg, not executing
  'createdb -U postgres -O app app_test',
  'psql -c "DROP TABLE lineup"',                          // table, not database
  'psql -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"', // the prescribed reversible reset
  'grep -r "DROP DATABASE" .',                            // searching for the phrase
  'rg "drop database" migrations/',
  'echo "DROP DATABASE foo"',                             // printing, not executing
  'cat drop_database_notes.md',
];

for (const cmd of allow) {
  test(`allow: ${JSON.stringify(cmd).slice(0, 52)}`, () => expectAllow(cmd));
}

// ---- 2. Block: the `dropdb` CLI (incl. env-prefix / full-path forms) ----

const dropdbVariants = [
  'dropdb mygamingassistant_test',
  'PGPASSWORD=x dropdb -h 127.0.0.1 -p 5433 -U app app_test',
  '/usr/bin/dropdb app_test',
  'dropdb --if-exists app_test && createdb app_test',
];

for (const cmd of dropdbVariants) {
  test(`block dropdb: ${cmd.slice(0, 50)}`, () => expectBlock(cmd));
}

// ---- 3. Block: executing `DROP DATABASE` via a SQL client ----

const dropDatabaseSql = [
  'psql -c "DROP DATABASE app_test"',
  'psql -h 127.0.0.1 -p 5433 -U app -d postgres -c "DROP DATABASE IF EXISTS app_test WITH (FORCE);"',
  'mysql -e "drop database app_test"',                    // lowercase + mysql
  'psql postgres <<SQL\nDROP DATABASE app_test;\nSQL',     // heredoc body
  "psql -c 'DROP   DATABASE   app_test'",                 // extra whitespace
];

for (const cmd of dropDatabaseSql) {
  test(`block DROP DATABASE: ${cmd.slice(0, 50).replace(/\n/g, ' ')}`, () => expectBlock(cmd));
}

// ---- 4. Invalid JSON payload returns `{}` (defensive, fail-open) ----

test('invalid JSON payload returns {}', () => {
  const result = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8', timeout: 5000 });
  expect((result.stdout || '').trim() === '{}', `expected "{}" got ${JSON.stringify(result.stdout)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
