# Never `git clean -f` Untracked Files Without a Dry-Run First — Prefer Tracking/Stashing

`git clean -f{d,x}` permanently deletes untracked files. Unlike almost every
other destructive git operation, **there is no recovery path**: untracked files
were never in a commit, an index, or the reflog, so git keeps no object for them.
Once `git clean -fd` runs, the bytes are gone — no `git reflog`, no
`git fsck`, no `git checkout --` brings them back.

This is a real-incident pattern. On 2026-07-19 a session ran `git clean -fd` in
an MGA backend checkout that held ~180 **untracked** operator pipeline scripts
(ingest/recut/download/create/accept tooling, localizer instructions, spans
ledgers) — none had ever been committed. They were deleted instantly. Recovery
was possible **only by luck**: a `git stash -u` had at some earlier point staged
the untracked tree, so the blobs survived as an *unreachable* object that
`git fsck --unreachable` could still find. Had that stash never existed, ~180
durable scripts would have been unrecoverable.

## The rule

Before running any `git clean` with a force flag (`-f` / `--force`):

1. **Dry-run first, always.** `git clean -nd` lists exactly what would be
   deleted. Read the list. If it contains anything that isn't disposable build
   junk — source (`.py`, `.ts`, `.tsx`, `.js`, `.ps1`, `.go`, `.rs`, `.sql`,
   `.md`), config, data, notes — STOP.
2. **Prefer a reversible move over deletion.** If the goal is "get a clean
   tree", use `git stash -u` (recoverable via `git stash pop`), not
   `git clean`. If the untracked files are worth keeping at all, **track them**
   (`git add` + commit) so a future clean can never touch them.
3. **To remove only build junk, scope to ignored files with UPPERCASE `-X`.**
   `git clean -fdX` removes only gitignored files (`node_modules/`, `dist/`,
   `__pycache__/`, `*.pyc`) and **cannot** delete untracked source. Lowercase
   `-x` removes ignored *and* untracked — avoid it.
4. **If a force clean of untracked files is genuinely intended**, the operator
   runs it themselves (via the `!` prefix) after reviewing the dry-run —
   human-in-the-loop for an irreversible deletion, same posture as
   `no-drop-database-prefer-schema-reset.md`.

This is enforced by `hooks/block-git-clean.js` (PreToolUse Bash). The hook
blocks `git clean` force-variants that delete untracked files (`-f`, `-fd`,
`-fdx`, `--force`), and ALLOWS dry-runs (`-n`), non-force cleans (git refuses
those anyway), and ignored-only cleans (`-fdX`). The rule is the reasoning; the
hook is the backstop — keep both.

## The general principle this is an instance of

Before any **irreversible destruction with no rollback path you can execute**,
stop and confirm the rollback exists. Untracked-file deletion is the git
operation with the *weakest* safety net — weaker than `reset --hard` (reflog
survives), weaker than branch deletion (reflog + remote survive), weaker than
`DROP TABLE` (re-migratable). Treat it with the most caution, not the least.
Same family as `no-drop-database-prefer-schema-reset.md` (irreversible shortcut
over the clean reversible path), `no-bandaid-solutions.md`, and
`multi-session-safety.md` (never destroy state another session may hold — a
sibling worktree's untracked files are invisible to your `git status`).

## Durable-tooling corollary

If a project accumulates untracked scripts/tooling that matter across sessions,
that untracked state is itself the latent bug — one `git clean` from deletion.
**Track durable tooling** (commit it, with a `.gitignore` for the genuinely
disposable run artifacts it produces) rather than leaving it untracked. The MGA
recovery PR did exactly this: committed the ~80 pipeline scripts + durable docs,
gitignored the frame-strips / spans / run-ledgers / credentials.

## Recovery when it already happened

Untracked files have no reflog, but if they were EVER `git add`-staged or
`git stash`-ed (even in a since-dropped stash), the blobs may survive as
unreachable objects:

```bash
# 1. Look for an unreachable commit/tree that referenced the lost paths.
#    A dropped `git stash -u` shows as "untracked files on <branch>":
git fsck --unreachable --no-reflogs | grep commit | awk '{print $3}' |
  while read c; do
    n=$(git ls-tree -r --name-only "$c" 2>/dev/null | grep -c '<path-fragment>')
    [ "$n" -gt 0 ] && echo "commit $c -> $n files";
  done

# 2. Protect it from gc immediately, then restore:
git tag recovered-stash <commit>
git checkout recovered-stash -- <path>

# 3. If only loose BLOBS survive (no tree → no filenames), grep their content:
git fsck --unreachable | grep blob | awk '{print $3}' |
  while read b; do git cat-file -p "$b" | grep -ql '<signature>' && echo "$b"; done
```

If nothing was ever staged/stashed, the files are gone — reconstruct from any
compiled `.pyc` (bytecode disassembly is deterministic ground truth) or rebuild.
This is the expensive path the dry-run rule exists to avoid.

## Auto-capture trigger

About to run `git clean -f` / `-fd` / `-fdx` (or chain it after a `cd`) — stop.
Run `git clean -nd` first and read the list. If it's not pure build junk, stash
or track instead. If a force clean is truly needed, hand it to the operator via
`!`. The cost of the dry-run is one command; the cost of a wrong `git clean -fd`
is unrecoverable deletion of untracked work.

## Concrete examples in this repo

- `hooks/block-git-clean.js` — the PreToolUse enforcement (self-gating per
  `claude-code-hook-if-field-unreliable.md`; blocks force-clean of untracked
  files, allows dry-run / no-force / ignored-only `-X`).
- `hooks/test-block-git-clean.js` — smoke tests, incl. "the `-fd` incident case
  blocks" and "the `-fdX` ignored-only clean must NOT be blocked".
