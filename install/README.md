# Installer subscripts

Helper scripts used by `../install.sh`. Each is testable on its own so the
top-level installer doesn't accumulate untested inline heredocs.

## `merge-settings.py`

Merges the shared `settings.json` hooks block into the user's
`~/.claude/settings.json`. Tracks which hook entries were installed via a
sidecar at `~/.claude/.jkwon-config-managed-hooks.json` so subsequent runs
can remove stale ones (renamed, removed, arg-changed, `if`-field-changed).

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

14 cases cover each failure mode the previous inline merge missed, plus
idempotency, user-added preservation, both first-run migration heuristics,
and the signature heuristic's no-`if` carve-out that protects user hooks.
