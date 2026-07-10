# Installer subscripts

Helper scripts used by `../install.sh`. Each is testable on its own so the
top-level installer doesn't accumulate untested inline heredocs.

## `merge-settings.py`

Merges the shared `settings.json` into the user's `~/.claude/settings.json`:
the `hooks` block plus every other top-level key as a *managed default*
(e.g. `model`, `effortLevel`, `autoCompactWindow`). Tracks which hook entries
and default values were installed via a sidecar at
`~/.claude/.jkwon-config-managed-hooks.json` so subsequent runs can remove
stale hooks (renamed, removed, arg-changed, `if`-field-changed) and follow
repo-side default changes without stomping user deviations.

Usage (called by `install.sh` automatically):

```bash
python install/merge-settings.py settings.json ~/.claude/settings.json ~/.claude/.jkwon-config-managed-hooks.json
```

Prints a one-line summary like `5 managed, +2 added, -1 stale removed`.

### Contract

- **Idempotent**: running twice in a row produces the same user settings.
- **User-added hooks preserved**: anything the user wrote into their
  settings (and that wasn't previously installed by this config) is left
  untouched.
- **Stale managed hooks removed**: any hook entry whose hash matches the
  previous sidecar but not the current shared config is dropped.
- **First-run migration**: when no sidecar exists, two heuristics wipe
  stale hooks before the merge:
  - Any hook whose command references the config hooks directory
    (`$HOME/.claude/hooks/` or `~/.claude/hooks/`).
  - Any hook with an `if` field whose `(event, matcher, if, type)` matches
    a current shared hook (catches inline-script duplicates the path
    heuristic can't see — mojibake, whitespace drift, refactors). The
    `if` field is required for this match to fire; without it the
    coordinates would over-match legitimate user hooks.
- **Managed defaults** (top-level keys other than `hooks`): set when absent;
  a repo-side change follows through only while the user's value still equals
  the value this config last wrote (or adopted when it matched). A user who
  changes the value owns the key from then on; deleting the key re-applies
  the default on the next run. Dropping a key from the shared config stops
  managing it but never unsets it.

### What is NOT a user-editable file

Hooks installed by this config are config-owned. Editing them in
`~/.claude/settings.json` directly will not survive the next `install.sh`
run — the new managed version replaces the edited one. If you want to
customize a config hook, fork it under `~/.claude/scripts/` and add a
local hook entry (with a command that doesn't reference
`~/.claude/hooks/`) so the merger leaves it alone.

## Tests

```bash
python install/test_merge_settings.py
```

23 cases cover each failure mode the previous inline merge missed, plus
idempotency, user-added preservation, both first-run migration heuristics,
the signature heuristic's no-`if` carve-out that protects user hooks, and
the managed-defaults semantics (set-if-absent, follow-repo-while-unchanged,
deviation ownership, additive drops).
