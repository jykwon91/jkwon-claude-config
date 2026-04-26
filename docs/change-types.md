# Change Types: Objective, Subjective, Personal

> **The framework itself is open to better proposals.** This document codifies one current cut of how to classify changes. If you encounter a different framework that fits the actual decision-making better — fewer tiers, more tiers, different boundaries, different review bars — open a PR replacing this doc. The framework is not load-bearing; the underlying need to distinguish "fast-merge fact" from "needs-debate opinion" from "don't-share-at-all" is what matters. See [Proposing a different framework](#proposing-a-different-framework) at the bottom.

Every change you consider making to your Claude Code setup falls into one of three categories. The category decides **whether the change belongs in this shared repo at all**, and if so, **how much review it deserves**.

| Type | Belongs in shared `jkwon-claude-config` repo? | Review bar | PR title prefix |
|---|---|---|---|
| **Objective** | Yes | Low (fast-merge after diff scan) | `[objective - no discussion required]` |
| **Subjective** | Yes | High (relitigate the cuts) | `[subjective - discussion required]` |
| **Personal** | **No** — lives in your local `~/.claude/` only | n/a (not shared) | n/a (no PR) |

---

## Objective change

**The change is provably correct.** Different reasonable engineers, given the same evidence, would make the same change. There is no judgment call.

### Examples

- CVE patch where the fix-version is unambiguous
- Bug fix with a failing test that now passes
- Removing dead code (verified unused via grep / static analysis)
- Stale-reference cleanup (PR is merged, branch is gone, file no longer exists)
- Deterministic detection rule (e.g., "this PR is in MERGED state per `gh` API")
- Documentation that reflects existing code accurately
- Renaming an internal symbol (no behavior change, all call sites updated)
- Typo fix
- Adding a missing entry to `MEMORY.md` for a memory file that already exists on disk

### Review bar

Low. The reviewer is checking that the diff matches the description, not relitigating the decision. Skim the diff, confirm it does what the title says, merge.

### PR title

```
[objective - no discussion required] <short summary>
```

---

## Subjective change

**The change encodes opinions, thresholds, workflow choices, or design preferences.** Different reasonable engineers would make different choices. The "right" answer depends on taste and trade-offs you accept.

### Examples

- New agent or pipeline (the shape, scope, and triggers are opinions)
- New global preference (the rule itself is one valid cut among several)
- Changing a threshold (timeout, retry count, deletion cap, cadence, age cutoff)
- Workflow rules ("always do X before Y")
- Trigger conditions for automated behavior ("fire when N>5 and >5min elapsed")
- Hooks that shape future behavior
- Choosing between multiple valid library options (FastAPI vs Flask, argon2 vs bcrypt)
- Memory-curation thresholds (how aggressive, how often)
- Promoting a memory from auto-memory to a global preference (does it generalize? you decide)

### Review bar

High. The reviewer evaluates the cuts, not just the diff. Questions worth asking:
- Is the threshold right? Would 30 minutes be better than 60?
- Does this fire too often? Not often enough?
- Are the examples in the rule the right ones?
- Does it conflict with anything else?
- Could a future-me undo this without breaking behavior elsewhere?

### PR title

```
[subjective - discussion required] <short summary>
```

---

## Personal change

**The change is only relevant to one person, one machine, or one workflow.** It would not benefit anyone else who uses this config repo, and might actively annoy or confuse them.

### These do NOT belong in `jkwon-claude-config`. They belong in:

- `~/.claude/CLAUDE.md` — your personal global instructions to the assistant (loaded by every session, not synced anywhere)
- `~/.claude/settings.local.json` — your personal Claude Code settings (theme, status line, key bindings)
- `~/.claude/settings.json` — your global Claude Code settings (shared across YOUR projects but not other developers')
- `<project>/.claude/settings.local.json` — per-project settings YOU only want active when you work on that project

### Examples

- "I prefer my prompts to use emojis" — personal taste
- "My status line shows X" — personal UI choice
- "My VPS is at 165.245.x.x with SSH key Y" — personal infrastructure / leaks credentials
- "I always work in worktrees rooted at `~/dev/wt/<project>`" — personal directory layout
- "My local IDE is JetBrains, configure tools accordingly" — personal tooling
- A scratch agent for experimenting privately
- Allowlisting commands you personally trust to skip permission prompts (`fewer-permission-prompts` skill output)
- Settings that include your name, email, machine identifier, or private API keys
- A rule that only makes sense given your own work patterns ("I review PRs Sunday mornings")

### Why these don't belong in the shared repo

1. **Other contributors don't share the preference.** Putting it in shared config means everyone sees a behavior change they didn't ask for.
2. **Privacy / security.** Paths, IPs, names, keys leak via Git history even if removed later.
3. **Noise.** Fills the diff history with one-person changes.
4. **Conflict surface.** Personal config that conflicts with someone else's personal config can't both live in the same shared file.

### What to do instead

1. Edit your local files directly:
   - Open `~/.claude/CLAUDE.md` in your editor and add the instruction
   - Or for settings: `claude` → `/config` (if it's a setting Claude Code's UI exposes)
2. Do NOT open a PR to this repo for personal config
3. If you're unsure whether a change is personal or subjective, ask yourself: "If I were a different developer using this same config repo, would I want this change applied to my Claude Code automatically?" If no → personal.

---

## Decision tree

```
Is the change provably the only-reasonable-choice?
├── YES → objective → PR with [objective - no discussion required] tag
└── NO →
    Would a different developer benefit from this change?
    ├── YES → subjective → PR with [subjective - discussion required] tag
    └── NO → personal → DO NOT PR. Edit your local ~/.claude/ files.
```

---

## When in doubt

- Tag `subjective` over `objective`. Over-flagging costs nothing; under-flagging wastes review attention on the wrong PRs.
- Choose `personal` over `subjective` if the change uniquely benefits you. Just because something is opinionated doesn't mean it should be shared — opinions belong in shared config only when they're useful to other developers.
- Ask if you genuinely can't tell. Better to spend a sentence checking than to spend cycles reverting a wrong-tier change later.

## Related rules

- `rules/never-auto-merge-config-repo.md` — even objective changes wait for human merge in this repo
- `rules/g-auto-capture.md` — automated stack-guide additions to `stacks/*.md` (still go through PR)

---

## Proposing a different framework

The 3-tier objective/subjective/personal split is one valid way to classify changes. There are others. If you (or anyone using this config repo) thinks a different framework would work better, propose it.

### Examples of frameworks that might be better

- **2 tiers** — drop the personal tier; assume everyone knows personal config doesn't belong here. (Pro: simpler. Con: drops the explicit boundary that protects the shared repo from one-person noise.)
- **4+ tiers** — split objective into "trivial" (typos) vs "verified objective" (CVE patches with cited evidence). Or split subjective into "low-stakes opinion" vs "load-bearing opinion." (Pro: finer review-bar calibration. Con: more decisions per PR.)
- **Severity-based** — tag by potential blast radius (low / medium / high) rather than by epistemic certainty. (Pro: focuses review attention on what could go wrong, not on whether the change is "correct." Con: most config-repo changes have low blast radius, so most PRs end up tagged the same way.)
- **Audience-based** — tag by who needs to read the change (everyone / agent-authors / no-one). (Pro: routes review to relevant people. Con: this repo has one maintainer right now.)
- **Skip tagging entirely** — trust commit messages + PR descriptions; let the maintainer decide review depth on the fly. (Pro: zero overhead. Con: returns to the failure mode that prompted tagging in the first place — every PR feels equally important.)

### How to propose one

1. Open a PR that REPLACES this doc with the alternative framework
2. In the PR body, explain:
   - What the new tiers / categories are
   - What problem the existing 3-tier framework fails to solve
   - How existing PRs would be re-classified under the new framework (sanity check that it covers the same ground)
3. If accepted, the new framework supersedes this one — update `feedback_pr_tags_config_repo` memory (or wherever the title-prefix process is canonically defined) to match.

### When NOT to propose a replacement

- The existing tiers cover the case but the EXAMPLES are wrong → don't replace the framework, just edit the examples (still PR'd, but tagged objective since the framework is unchanged)
- A specific PR doesn't fit cleanly into a tier → that's a tagging judgment call, not a framework problem; tag the higher bar and move on
- You disagree with where the boundary is between two tiers → adjust the boundary text in the existing definitions; don't replace the whole framework

### Bias check

If you're tempted to defend the current framework because it's already in place, that's status-quo bias. The 3-tier split exists because it was the first cut that worked, not because it's optimal. Treat alternatives on their merits.
