# No Bandaid Solutions

Never propose a "quick workaround" / "use the running container" / "point env at the existing thing" / "store it in postgres BYTEA for now" hack — even with caveats, even when the user is in a hurry. The user has explicitly said: "never suggest bandaid solutions. always do the right solution."

## What counts as a bandaid

The pattern: a proposed solution that LOOKS pragmatic but accumulates hidden cost. Common shapes:

- **Cross-stack coupling** — "App B reaches into App A's docker network for now" → silent dependency on A's container being up; redeploy of A breaks B with no clean error
- **Manual prod surgery** — "Skip the migration; just run this SQL once on prod" → code and DB drift apart; future migrations land on an unexpected state
- **Hardcoded "temporary" values** — always become permanent; the FIXME comment outlives the codebase
- **Silent-fail catches** — `try: ...; except: pass` to "gracefully degrade" → caused MBK's #201–#205 outage trail
- **"For now, store it in postgres BYTEA instead of MinIO"** — when the proper storage exists and just needs wiring; caught in MJH resume upload on 2026-05-04
- **"We can fix this properly later"** — later never comes; the bandaid becomes the architecture
- **Auth bypasses for testing** — `if request.headers.get("X-Skip-Auth"): ...` → a debug surface that ships to prod

## How to spot the bandaid in your own draft

- Words "for now", "temporarily", "as a workaround", "just", "quick fix" — all flag bandaid thinking. Reread the proposal.
- An explicit follow-up TODO to "do it properly later" → it's a bandaid.
- A solution that couples two systems that shouldn't be coupled → bandaid.
- A solution that requires the operator to remember a hidden invariant ("don't redeploy A while B is up") → bandaid.
- The user asks "is this a bandaid?" → it almost certainly is. Don't argue. Pivot to the clean solution.
- A proposal that asks the user to take a manual one-off action that won't be reproducible on the next deploy/VPS → bandaid.

## The correct posture

1. **Identify the architecturally clean answer first.** Don't lead with the workaround.
2. **Estimate scope honestly.** Don't undersell because you want to "ship today."
3. **Surface choices only when there are LEGITIMATE clean alternatives.** "Per-app MinIO" vs "shared MinIO" are both real architectures — present those. "Per-app MinIO" vs "use App A's container" is NOT a real choice — the second option is a bandaid masquerading as a tradeoff.
4. **If the user is in a hurry, cut SCOPE, not corners.** Drop one of the four features and ship the remaining three properly. Don't bandaid all four to fit the time budget.
5. **If the user has a hard deadline that genuinely doesn't fit any clean option**, say so explicitly. "The clean approach takes ~4 hours and I don't think I can finish today; do you want to defer or do you want to extend?" — never silently swap in a bandaid.

## When a workaround IS legitimate

There's a narrow case: when an EXTERNAL system is broken and you need a tactical fix. Example: "GitHub Actions is down, push manually so the deploy can happen." That's not bandaid — it's responding to an external failure with the correct interim action, and the right long-term answer is "wait for GitHub". The distinction: a real workaround is forced by external state; a bandaid is taking a shortcut that's avoidable.

Another legitimate case: when the user EXPLICITLY asks for a one-off temporary fix and acknowledges the tradeoff ("I know this is a hack, just patch this one row"). Then comply, but make sure the request is actually explicit and not just "ship something fast."

## Why the rule exists

The user runs production VPS apps with real users. Bandaids accumulate, become load-bearing, and turn into outages months later. The MBK silent-fail audit (project memory: `silent-fail audit follow-up`) is the active example. Better to ship one feature correctly than three features with hidden coupling.

## Relationship to other rules

- **`g-auto-capture.md`** — auto-captures stack practices to PRs; complements this by ensuring the clean pattern lands in the stack guide, not just in one project
- **`never-auto-merge-config-repo.md`** — config changes need user approval; same posture applies to architectural shortcuts
- **`non-code-public-repo-guardrails.md`** — local-only artifacts; this rule is about NOT taking shortcuts in the deployed code
