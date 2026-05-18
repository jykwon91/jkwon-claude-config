# Never DROP DATABASE a Shared DB — Prefer the Reversible Schema Reset

`DROP DATABASE` / `dropdb` is irreversible and, on a shared local dev/test
database, usually **cannot be undone by the assistant**: the application role
typically lacks `CREATEDB`, and local Postgres is `scram` (no trust), so only
the operator (a superuser) can recreate it. Dropping it destroys state that
another session / worktree / the operator's main checkout may be using, with
no assistant-side rollback path.

This is a real-incident pattern. On 2026-05-17, a session dropped the shared
`mygamingassistant_test` dev DB to get a clean base→head migrate. The `DROP`
succeeded; the `CREATE` failed (`permission denied to create database`). The
session stalled until the operator manually ran `createdb -U postgres`. A
reversible alternative the app role *could* perform existed and was skipped.

## The rule

**Never run `DROP DATABASE` or `dropdb` against a local/shared dev or test
database to "get a clean slate".** When you need an empty schema for a
base→head migrate or to clear corrupted state, use the reversible reset the
app role can do **inside the database it already owns**:

```bash
# Connect AS THE APP ROLE to the SAME database (no superuser needed):
psql "<app DATABASE_URL_SYNC>" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
alembic upgrade head
```

`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` clears every table,
sequence, and type — functionally equivalent to a fresh database for a
migrate — but the **database object survives**, so the app role (which owns
it) never needs `CREATEDB` or a superuser. It is fully reversible by
re-migrating; `DROP DATABASE` is not reversible by anyone but a superuser.

This is enforced by `hooks/block-drop-database.js` (PreToolUse Bash). The
hook blocks executing `DROP DATABASE` / `dropdb` and points back here. The
rule is the reasoning; the hook is the backstop — keep both.

## The general principle this is an instance of

Before any **hard-to-reverse operation on a shared or foreign resource**,
confirm a rollback path *you* can execute. If the only thing that can undo it
is a credential you don't (and shouldn't) have, you must not do it — surface
it to the operator instead. Same family as `no-bandaid-solutions.md` (taking
an irreversible shortcut over the clean reversible path) and
`multi-session-safety.md` (never destroy state another session may hold).

## If a full database drop is genuinely required

It sometimes legitimately is (a truly disposable scratch DB you created this
session, no other consumer). Even then:

1. Confirm nothing else uses it (`multi-session-safety.md`: other worktrees /
   the main checkout / a concurrent session frequently share one local
   `*_test` DB).
2. Confirm **you** can recreate it (the role has `CREATEDB`, or it's a
   container DB recreated by `docker compose down -v && up`).
3. If recreation needs a superuser, **the operator performs the drop** —
   human-in-the-loop for irreversible destruction of a shared resource.
   Hand them the exact command via the `!` prefix so any password prompt
   stays in their terminal (`never-paste-secrets-in-chat.md`); never request
   a superuser password in chat.

## Recovery when it already happened

1. The assistant cannot fix it without a superuser. Don't loop on
   `CREATE DATABASE` attempts that will keep failing `permission denied`.
2. Give the operator the one-off, to run via `!` (password prompt stays in
   their terminal):
   ```
   ! & 'C:\Program Files\PostgreSQL\<ver>\bin\createdb.exe' -h <host> -p <port> -U postgres -O <app_role> <db_name>
   ```
3. Optionally have them `ALTER ROLE <app_role> CREATEDB;` so the harness can
   self-recover next time (removes the recurrence from the "can't recreate"
   side).
4. After it exists, the app role can `alembic upgrade head` itself.
5. CI is unaffected — it builds its own fresh container DB and remains the
   authoritative gate; local-DB loss does not block a PR's verification.

## What this rule does NOT forbid

- `DROP SCHEMA ... CASCADE`, `DROP TABLE`, `DROP INDEX`, `TRUNCATE` — table-
  and schema-level ops the app role can do and re-create. Not blocked.
- `docker compose down -v` style volume resets for **containerized** DBs that
  the same compose file recreates — that's reversible by you.
- `createdb` / `CREATE DATABASE` — creating is not destroying.
- Searching for or printing the literal string (`grep "DROP DATABASE"`,
  `echo`) — the hook allows read/search leaders.

## Auto-capture trigger

About to issue `DROP DATABASE` / `dropdb` (or chain it with `createdb`) on a
local dev/test DB — stop. Use `DROP SCHEMA public CASCADE; CREATE SCHEMA
public;` + `alembic upgrade head` instead. If a true database drop is
unavoidable and you can't recreate it yourself, hand it to the operator. The
cost of the schema-reset alternative is one extra clause; the cost of a wrong
`DROP DATABASE` is a stalled session and destroyed shared state.

## Concrete examples in this repo

- `hooks/block-drop-database.js` — the PreToolUse enforcement (self-gating
  per `claude-code-hook-if-field-unreliable.md`; allows the reversible
  alternative and read/search; blocks `dropdb` + executing `DROP DATABASE`).
- `hooks/test-block-drop-database.js` — smoke tests, incl. "the prescribed
  `DROP SCHEMA` reset must NOT be blocked" and "the `createdb` recovery must
  NOT be blocked".
