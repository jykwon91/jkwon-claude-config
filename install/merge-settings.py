"""Merge shared hooks from this config repo into the user's ~/.claude/settings.json.

This is invoked by install.sh on every run. It must be idempotent (running twice
produces the same result) and must handle the four failure modes the previous
inline-heredoc merge missed:

1. Renamed hook (foo.js -> bar.js): old entry must be removed, new entry added.
2. Hook command shape change (added flag, moved path): old entry must be removed.
3. Hook removed from shared settings.json: old entry must be removed.
4. Hook `if` field added/removed/changed: old entry must be removed.

The previous logic only added or replaced — it never removed. So whenever the
shape of a hook in shared/settings.json changed, the old version lingered in
the user's settings.json as a duplicate that kept firing.

How it works
------------

We track which hook entries were installed by THIS config by writing a sidecar
file at <DEST>/.jkwon-config-managed-hooks.json. The sidecar records a
content-hash of every hook entry the previous install wrote to user settings.

On each run:

1. Compute the hash set for the CURRENT shared hooks.
2. Read the sidecar to get the PREVIOUS hash set.
3. Walk the user's settings.json. For each hook entry:
     - If its hash is in PREVIOUS but NOT in CURRENT, it's a stale managed
       hook — drop it.
     - Otherwise leave it alone (either it's still current, or it's user-added).
4. Add CURRENT shared hooks that aren't already present (by hash).
5. Drop empty event entries / empty matcher buckets.
6. Write the new user settings AND update the sidecar to match CURRENT.

First-run migration: when no sidecar exists (existing installs upgrading to
this logic), we do a one-time path-based cleanup BEFORE the merge — any hook
whose command references `$HOME/.claude/hooks/` or `~/.claude/hooks/` is
assumed to be a stale config-owned hook and removed. This prevents the
upgrade from leaving duplicates for users who had the old buggy installer.

User-added hooks are preserved unless they exactly match a previously-managed
hash, which would only happen if the user copy-pasted a managed hook into
their own settings (in which case treating it as managed is reasonable).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys


SIDECAR_VERSION = 1
CONFIG_HOOKS_PATH_PATTERN = re.compile(
    r"(\$HOME|~|%USERPROFILE%)[\\/]\.claude[\\/]hooks[\\/]"
)


def hook_hash(event: str, matcher, hook: dict) -> str:
    """Stable content hash for a (event, matcher, hook) triple.

    Matcher None and matcher "" are normalized to the same value so a hook
    block written without a matcher matches one with matcher: null.
    """

    payload = {
        "event": event,
        "matcher": matcher if matcher else None,
        "hook": hook,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def is_path_owned_by_config(hook: dict) -> bool:
    """First-run migration helper.

    Treats any hook whose command references the config's hook directory as
    config-owned. Used only when the sidecar doesn't exist, to clean up
    duplicates left by the old installer.
    """

    command = hook.get("command")
    if not isinstance(command, str):
        return False
    return bool(CONFIG_HOOKS_PATH_PATTERN.search(command))


def collect_shared_hashes(shared_hooks: dict) -> tuple[set[str], dict]:
    """Return (set of all current hashes, hash -> (event, matcher, hook) map)."""

    hashes: set[str] = set()
    by_hash: dict[str, tuple[str, object, dict]] = {}
    for event, entries in shared_hooks.items():
        for entry in entries:
            matcher = entry.get("matcher")
            for hook in entry.get("hooks", []):
                h = hook_hash(event, matcher, hook)
                hashes.add(h)
                by_hash[h] = (event, matcher, hook)
    return hashes, by_hash


def drop_stale_managed_hooks(
    user_hooks: dict, previous_hashes: set[str], current_hashes: set[str]
) -> int:
    """Remove hooks whose hash was managed previously but is no longer current.

    Returns the count of hooks dropped.
    """

    dropped = 0
    for event in list(user_hooks.keys()):
        entries = user_hooks[event]
        new_entries = []
        for entry in entries:
            matcher = entry.get("matcher")
            kept_hooks = []
            for hook in entry.get("hooks", []):
                h = hook_hash(event, matcher, hook)
                if h in previous_hashes and h not in current_hashes:
                    dropped += 1
                    continue
                kept_hooks.append(hook)
            if kept_hooks:
                entry["hooks"] = kept_hooks
                new_entries.append(entry)
        if new_entries:
            user_hooks[event] = new_entries
        else:
            del user_hooks[event]
    return dropped


def first_run_path_cleanup(user_hooks: dict) -> int:
    """One-time cleanup when sidecar doesn't exist.

    Removes any hook whose command references the config hooks directory.
    Returns count dropped.
    """

    dropped = 0
    for event in list(user_hooks.keys()):
        entries = user_hooks[event]
        new_entries = []
        for entry in entries:
            kept_hooks = [h for h in entry.get("hooks", []) if not is_path_owned_by_config(h)]
            dropped += len(entry.get("hooks", [])) - len(kept_hooks)
            if kept_hooks:
                entry["hooks"] = kept_hooks
                new_entries.append(entry)
        if new_entries:
            user_hooks[event] = new_entries
        else:
            del user_hooks[event]
    return dropped


def add_current_shared_hooks(user_hooks: dict, shared_hooks: dict) -> int:
    """Append shared hooks into user hooks, dedup by hash. Returns count added."""

    added = 0
    for event, entries in shared_hooks.items():
        user_entries = user_hooks.setdefault(event, [])
        for entry in entries:
            matcher = entry.get("matcher")
            user_entry = next(
                (e for e in user_entries if e.get("matcher") == matcher), None
            )
            if user_entry is None:
                # Match the shape of shared entries: matcher first, hooks second
                if matcher is not None:
                    user_entry = {"matcher": matcher, "hooks": []}
                else:
                    user_entry = {"hooks": []}
                user_entries.append(user_entry)
            existing_hashes = {
                hook_hash(event, matcher, h) for h in user_entry.get("hooks", [])
            }
            for hook in entry.get("hooks", []):
                h = hook_hash(event, matcher, hook)
                if h in existing_hashes:
                    continue
                user_entry.setdefault("hooks", []).append(hook)
                existing_hashes.add(h)
                added += 1
    return added


def merge_settings(shared_path: str, user_path: str, sidecar_path: str) -> dict:
    """Run the merge. Returns a stats dict for the caller to print."""

    with open(shared_path, encoding="utf-8") as f:
        shared = json.load(f)

    user: dict = {}
    if os.path.exists(user_path):
        with open(user_path, encoding="utf-8") as f:
            user = json.load(f)

    sidecar: dict = {"version": SIDECAR_VERSION, "managed_hooks": []}
    sidecar_existed = os.path.exists(sidecar_path)
    if sidecar_existed:
        try:
            with open(sidecar_path, encoding="utf-8") as f:
                sidecar = json.load(f)
        except (json.JSONDecodeError, OSError):
            sidecar = {"version": SIDECAR_VERSION, "managed_hooks": []}

    previous_hashes = set(sidecar.get("managed_hooks", []))
    shared_hooks = shared.get("hooks", {})
    user_hooks = user.setdefault("hooks", {})
    current_hashes, _ = collect_shared_hashes(shared_hooks)

    migrated = 0
    if not sidecar_existed:
        migrated = first_run_path_cleanup(user_hooks)

    dropped = drop_stale_managed_hooks(user_hooks, previous_hashes, current_hashes)
    added = add_current_shared_hooks(user_hooks, shared_hooks)

    with open(user_path, "w", encoding="utf-8") as f:
        json.dump(user, f, indent=2)
        f.write("\n")

    sidecar = {"version": SIDECAR_VERSION, "managed_hooks": sorted(current_hashes)}
    with open(sidecar_path, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)
        f.write("\n")

    return {
        "migrated": migrated,
        "dropped": dropped,
        "added": added,
        "total_managed": len(current_hashes),
    }


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "usage: merge-settings.py <shared_settings.json> <user_settings.json> <sidecar.json>",
            file=sys.stderr,
        )
        return 2
    stats = merge_settings(sys.argv[1], sys.argv[2], sys.argv[3])
    parts = [f"{stats['total_managed']} managed"]
    if stats["added"]:
        parts.append(f"+{stats['added']} added")
    if stats["dropped"]:
        parts.append(f"-{stats['dropped']} stale removed")
    if stats["migrated"]:
        parts.append(f"-{stats['migrated']} first-run cleanup")
    print(", ".join(parts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
