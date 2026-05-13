"""Unit tests for install/merge-settings.py.

Each test covers one of the four failure modes the previous inline merge
missed plus baseline correctness.

Run from repo root:
    python install/test_merge_settings.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import unittest


def _load_merge_module():
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "merge_settings", os.path.join(here, "merge-settings.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


merge_settings = _load_merge_module()


class MergeSettingsCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="merge-settings-test-")
        self.shared_path = os.path.join(self.tmp, "shared.json")
        self.user_path = os.path.join(self.tmp, "user.json")
        self.sidecar_path = os.path.join(self.tmp, "sidecar.json")

    def tearDown(self):
        for p in (self.shared_path, self.user_path, self.sidecar_path):
            if os.path.exists(p):
                os.unlink(p)
        os.rmdir(self.tmp)

    def write(self, path, obj):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f)

    def read_user(self):
        with open(self.user_path, encoding="utf-8") as f:
            return json.load(f)

    def read_sidecar(self):
        with open(self.sidecar_path, encoding="utf-8") as f:
            return json.load(f)

    def run_merge(self):
        return merge_settings.merge_settings(
            self.shared_path, self.user_path, self.sidecar_path
        )

    # --- Baseline: first run with no user settings ----------------------------

    def test_first_run_no_user_settings(self):
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "node $HOME/.claude/hooks/foo.js",
                                }
                            ],
                        }
                    ]
                }
            },
        )
        stats = self.run_merge()
        user = self.read_user()
        self.assertEqual(stats["added"], 1)
        self.assertEqual(stats["dropped"], 0)
        self.assertEqual(
            user["hooks"]["PostToolUse"][0]["hooks"][0]["command"],
            "node $HOME/.claude/hooks/foo.js",
        )
        # Sidecar records the new managed hash
        sidecar = self.read_sidecar()
        self.assertEqual(len(sidecar["managed_hooks"]), 1)

    # --- Idempotency: running merge twice produces same result ---------------

    def test_idempotent_on_rerun(self):
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/foo.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()
        first = self.read_user()
        stats = self.run_merge()
        second = self.read_user()
        self.assertEqual(first, second)
        self.assertEqual(stats["added"], 0)
        self.assertEqual(stats["dropped"], 0)

    # --- Failure mode 1: renamed hook ----------------------------------------

    def test_renamed_hook_removes_old_adds_new(self):
        # First install: shared has foo.js
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/foo.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()

        # Second install: shared now has bar.js (rename, no `if` field)
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/bar.js"}
                            ],
                        }
                    ]
                }
            },
        )
        stats = self.run_merge()
        user = self.read_user()
        commands = [h["command"] for h in user["hooks"]["PostToolUse"][0]["hooks"]]
        self.assertEqual(commands, ["node $HOME/.claude/hooks/bar.js"])
        self.assertEqual(stats["dropped"], 1)
        self.assertEqual(stats["added"], 1)

    # --- Failure mode 2: hook arg/path changes -------------------------------

    def test_arg_change_removes_old_adds_new(self):
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/x.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()

        # Add --verbose flag — new shape, old must be dropped
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "node $HOME/.claude/hooks/x.js --verbose",
                                }
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()
        user = self.read_user()
        commands = [h["command"] for h in user["hooks"]["PostToolUse"][0]["hooks"]]
        self.assertEqual(commands, ["node $HOME/.claude/hooks/x.js --verbose"])

    # --- Failure mode 3: hook removed from shared ----------------------------

    def test_removed_from_shared_is_dropped(self):
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/a.js"},
                                {"type": "command", "command": "node $HOME/.claude/hooks/b.js"},
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()

        # Remove b.js
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/a.js"}
                            ],
                        }
                    ]
                }
            },
        )
        stats = self.run_merge()
        user = self.read_user()
        commands = [h["command"] for h in user["hooks"]["PostToolUse"][0]["hooks"]]
        self.assertEqual(commands, ["node $HOME/.claude/hooks/a.js"])
        self.assertEqual(stats["dropped"], 1)

    # --- Failure mode 4: `if` field added/removed ---------------------------

    def test_if_field_removed_drops_old_adds_new(self):
        # First: shared has if-gated version
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "command",
                                    "if": "Bash(git*)",
                                    "command": "node $HOME/.claude/hooks/cleanup.js",
                                }
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()

        # Second: `if` field removed (hook now self-gates in the script)
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "node $HOME/.claude/hooks/cleanup.js",
                                }
                            ],
                        }
                    ]
                }
            },
        )
        stats = self.run_merge()
        user = self.read_user()
        hooks = user["hooks"]["PostToolUse"][0]["hooks"]
        self.assertEqual(len(hooks), 1)
        self.assertNotIn("if", hooks[0])
        self.assertEqual(stats["dropped"], 1)
        self.assertEqual(stats["added"], 1)

    # --- User-added hooks are preserved --------------------------------------

    def test_user_added_hooks_preserved(self):
        # Pre-existing user setting with a hook NOT from config
        self.write(
            self.user_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Edit",
                            "hooks": [
                                {"type": "command", "command": "echo user added"}
                            ],
                        }
                    ]
                }
            },
        )
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/foo.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()
        user = self.read_user()
        # Both should be present
        matchers = sorted(e["matcher"] for e in user["hooks"]["PostToolUse"])
        self.assertEqual(matchers, ["Bash", "Edit"])
        edit_entry = next(e for e in user["hooks"]["PostToolUse"] if e["matcher"] == "Edit")
        self.assertEqual(edit_entry["hooks"][0]["command"], "echo user added")

    # --- First-run migration: existing duplicates are wiped -----------------

    def test_first_run_migration_removes_path_owned_duplicates(self):
        # Simulate the state left by the old buggy installer:
        # user settings has BOTH an old path-owned hook AND a current one.
        self.write(
            self.user_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/old.js"},
                                {"type": "command", "command": "node $HOME/.claude/hooks/current.js"},
                                {"type": "command", "command": "echo my-own-hook"},
                            ],
                        }
                    ]
                }
            },
        )
        # No sidecar exists yet — this is the first run with the new logic
        self.assertFalse(os.path.exists(self.sidecar_path))

        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/current.js"}
                            ],
                        }
                    ]
                }
            },
        )
        stats = self.run_merge()
        user = self.read_user()
        commands = [h["command"] for h in user["hooks"]["PostToolUse"][0]["hooks"]]
        # User-added hook preserved; both path-owned hooks were wiped; current added back.
        self.assertIn("echo my-own-hook", commands)
        self.assertIn("node $HOME/.claude/hooks/current.js", commands)
        self.assertNotIn("node $HOME/.claude/hooks/old.js", commands)
        self.assertEqual(stats["migrated"], 2)
        # Sidecar now records the current managed hash
        sidecar = self.read_sidecar()
        self.assertEqual(len(sidecar["managed_hooks"]), 1)

    # --- Tilde-form path also matched in first-run migration ----------------

    def test_first_run_migration_matches_tilde_form(self):
        self.write(
            self.user_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node ~/.claude/hooks/legacy.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.write(self.shared_path, {"hooks": {}})
        self.run_merge()
        user = self.read_user()
        # The tilde-form hook should be wiped, leaving no PostToolUse entry
        self.assertNotIn("PostToolUse", user.get("hooks", {}))

    # --- Sidecar protects user-added hooks on subsequent runs ---------------

    def test_user_added_hook_survives_re_run(self):
        # Run 1: shared has foo.js, user adds their own hook afterwards
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/foo.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()

        # User edits settings.json to add their own hook on the same matcher
        with open(self.user_path, encoding="utf-8") as f:
            user = json.load(f)
        user["hooks"]["PostToolUse"][0]["hooks"].append(
            {"type": "command", "command": "echo i-added-this"}
        )
        with open(self.user_path, "w", encoding="utf-8") as f:
            json.dump(user, f)

        # Run 2: shared unchanged. User-added hook must survive.
        self.run_merge()
        user2 = self.read_user()
        commands = sorted(h["command"] for h in user2["hooks"]["PostToolUse"][0]["hooks"])
        self.assertEqual(
            commands,
            sorted(["echo i-added-this", "node $HOME/.claude/hooks/foo.js"]),
        )

    # --- Matcher None / matcher absent normalization ------------------------

    def test_no_matcher_entries_dedup_correctly(self):
        # Shared has a hook entry with no matcher (catch-all)
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/ctx.js"}
                            ]
                        }
                    ]
                }
            },
        )
        self.run_merge()
        self.run_merge()
        user = self.read_user()
        # Should NOT have duplicated
        catchall_entries = [e for e in user["hooks"]["PostToolUse"] if "matcher" not in e]
        self.assertEqual(len(catchall_entries), 1)
        self.assertEqual(len(catchall_entries[0]["hooks"]), 1)

    # --- Empty entries get pruned -------------------------------------------

    def test_empty_entries_pruned_after_drop(self):
        # Install foo.js
        self.write(
            self.shared_path,
            {
                "hooks": {
                    "PostToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {"type": "command", "command": "node $HOME/.claude/hooks/foo.js"}
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()

        # Remove entirely from shared
        self.write(self.shared_path, {"hooks": {}})
        self.run_merge()
        user = self.read_user()
        # PostToolUse should be pruned since its last hook was dropped
        self.assertNotIn("PostToolUse", user.get("hooks", {}))


if __name__ == "__main__":
    unittest.main(verbosity=2)
