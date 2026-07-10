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


class MergeCaseBase(unittest.TestCase):
    """Shared temp-file fixtures; holds no tests of its own."""

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


class MergeSettingsCase(MergeCaseBase):
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

    # --- First-run signature heuristic catches inline duplicates -----------

    def test_first_run_signature_catches_inline_mojibake_duplicate(self):
        # Pre-existing user settings simulate the bug seen in the wild:
        # a stale inline agent hook with mojibake bytes (UTF-8 round-tripped
        # through cp1252) sits alongside the canonical one. The path heuristic
        # cannot see it because there's no $HOME/.claude/hooks/ reference.
        # Same (event, matcher, if, type) as the current shared hook, so the
        # signature heuristic catches it.
        canonical_prompt = "Pipeline quality gate — do the thing"
        mojibake_prompt = "Pipeline quality gate â€” do the thing"
        self.write(
            self.user_path,
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "agent",
                                    "if": "Bash(gh pr create*)",
                                    "prompt": mojibake_prompt,
                                    "timeout": 120,
                                },
                                {
                                    "type": "command",
                                    "command": "echo my-own-hook",
                                },
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
                    "PreToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "agent",
                                    "if": "Bash(gh pr create*)",
                                    "prompt": canonical_prompt,
                                    "timeout": 120,
                                }
                            ],
                        }
                    ]
                }
            },
        )
        self.run_merge()
        user = self.read_user()
        hooks = user["hooks"]["PreToolUse"][0]["hooks"]
        # mojibake variant wiped; user-added preserved; canonical added.
        prompts = [h.get("prompt") for h in hooks if h.get("type") == "agent"]
        commands = [h.get("command") for h in hooks if h.get("type") == "command"]
        self.assertEqual(prompts, [canonical_prompt])
        self.assertIn("echo my-own-hook", commands)
        self.assertNotIn(mojibake_prompt, prompts)

    # --- Signature heuristic does NOT wipe truly user-only hooks ------------

    def test_first_run_signature_preserves_user_hooks_with_no_match(self):
        # User has a hook with an `if` field that doesn't exist in shared.
        # Must survive first-run cleanup.
        self.write(
            self.user_path,
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "command",
                                    "if": "Bash(rm -rf*)",
                                    "command": "echo dangerous-rm-blocker",
                                }
                            ],
                        }
                    ]
                }
            },
        )
        self.write(self.shared_path, {"hooks": {}})
        self.run_merge()
        user = self.read_user()
        # User's hook survives — no signature collision with shared
        hooks = user["hooks"]["PreToolUse"][0]["hooks"]
        self.assertEqual(len(hooks), 1)
        self.assertEqual(hooks[0]["command"], "echo dangerous-rm-blocker")

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


class ManagedDefaultsCase(MergeCaseBase):
    """Top-level managed defaults (every shared key except "hooks")."""

    SHARED = {
        "model": "opus",
        "effortLevel": "high",
        "hooks": {},
    }

    def test_defaults_set_when_absent(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"hooks": {}})
        stats = self.run_merge()
        user = self.read_user()
        self.assertEqual(user["model"], "opus")
        self.assertEqual(user["effortLevel"], "high")
        self.assertEqual(stats["defaults_set"], 2)
        self.assertEqual(
            self.read_sidecar()["managed_defaults"],
            {"model": "opus", "effortLevel": "high"},
        )

    def test_user_deviation_preserved(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"model": "fable", "hooks": {}})
        stats = self.run_merge()
        user = self.read_user()
        self.assertEqual(user["model"], "fable")  # user-owned, untouched
        self.assertEqual(user["effortLevel"], "high")  # absent -> set
        self.assertEqual(stats["defaults_set"], 1)
        # deviated key is not tracked
        self.assertNotIn("model", self.read_sidecar()["managed_defaults"])

    def test_repo_change_propagates_while_unchanged_by_user(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"hooks": {}})
        self.run_merge()
        # Repo bumps the default; user never touched the key
        changed = dict(self.SHARED, effortLevel="medium")
        self.write(self.shared_path, changed)
        stats = self.run_merge()
        self.assertEqual(self.read_user()["effortLevel"], "medium")
        self.assertEqual(stats["defaults_updated"], 1)

    def test_repo_change_does_not_stomp_user_deviation(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"hooks": {}})
        self.run_merge()
        # User deviates after the default was applied
        user = self.read_user()
        user["model"] = "sonnet"
        self.write(self.user_path, user)
        # Repo changes the default
        changed = dict(self.SHARED, model="haiku")
        self.write(self.shared_path, changed)
        self.run_merge()
        self.assertEqual(self.read_user()["model"], "sonnet")
        self.assertNotIn("model", self.read_sidecar()["managed_defaults"])

    def test_matching_user_value_is_adopted_and_follows_repo(self):
        # User already has the same value the repo ships -> adopt as managed,
        # so a later repo-side change propagates.
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"model": "opus", "hooks": {}})
        self.run_merge()
        self.assertEqual(self.read_sidecar()["managed_defaults"]["model"], "opus")
        changed = dict(self.SHARED, model="sonnet")
        self.write(self.shared_path, changed)
        stats = self.run_merge()
        self.assertEqual(self.read_user()["model"], "sonnet")
        self.assertEqual(stats["defaults_updated"], 1)

    def test_dropped_default_keeps_user_value(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"hooks": {}})
        self.run_merge()
        # Repo stops shipping the default entirely
        self.write(self.shared_path, {"hooks": {}})
        self.run_merge()
        user = self.read_user()
        self.assertEqual(user["model"], "opus")  # additive: never unset
        self.assertEqual(self.read_sidecar()["managed_defaults"], {})

    def test_defaults_idempotent(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"hooks": {}})
        self.run_merge()
        first = self.read_user()
        stats = self.run_merge()
        self.assertEqual(self.read_user(), first)
        self.assertEqual(stats["defaults_set"], 0)
        self.assertEqual(stats["defaults_updated"], 0)

    def test_deleted_key_reapplies_default(self):
        self.write(self.shared_path, self.SHARED)
        self.write(self.user_path, {"hooks": {}})
        self.run_merge()
        user = self.read_user()
        del user["model"]
        self.write(self.user_path, user)
        stats = self.run_merge()
        self.assertEqual(self.read_user()["model"], "opus")
        self.assertEqual(stats["defaults_set"], 1)

    def test_hooks_key_never_treated_as_default(self):
        self.write(self.shared_path, {"hooks": {}})
        self.write(self.user_path, {"hooks": {}})
        self.run_merge()
        self.assertNotIn("hooks", self.read_sidecar()["managed_defaults"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
