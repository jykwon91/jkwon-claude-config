# No Bandaid Solutions

Never propose a "quick workaround" / "use the running container" / "point env at the existing thing" / "store it in postgres BYTEA for now" hack — even with caveats, even when the user is in a hurry.

## What counts as a bandaid

A solution that LOOKS pragmatic but accumulates hidden cost:

- **Cross-stack coupling** — "App B reaches into App A's docker network for now" → silent dependency on A's container being up
- **Manual prod surgery** — "Skip the migration; just run this SQL once on prod" → code and DB drift apart
- **Hardcoded "temporary" values** — always become permanent
- **Silent-fail catches** — `try: ...; except: pass` to "gracefully degrade"
- **"For now, store it in postgres BYTEA instead of MinIO"** — when proper storage exists and just needs wiring
- **"We can fix this properly later"** — later never comes
- **Auth bypasses for testing** — `if request.headers.get("X-Skip-Auth"): ...` ships to prod

## How to spot the bandaid in your own draft

- Words "for now", "temporarily", "as a workaround", "just", "quick fix" — all flag bandaid thinking
- An explicit follow-up TODO to "do it properly later" → bandaid
- A solution that couples two systems that shouldn't be coupled → bandaid
- A solution that requires the operator to remember a hidden invariant ("don't redeploy A while B is up") → bandaid
- The user asks "is this a bandaid?" → it almost certainly is. Don't argue. Pivot to clean.
- A proposal that asks the user to take a manual one-off action that won't be reproducible on the next deploy/VPS → bandaid

## The correct posture

1. **Identify the architecturally clean answer first.** Don't lead with the workaround.
2. **Estimate scope honestly.** Don't undersell to "ship today."
3. **Surface choices only when there are LEGITIMATE clean alternatives.** "Per-app MinIO" vs "shared MinIO" are both real architectures. "Per-app MinIO" vs "use App A's container" is NOT a real choice — the second option is a bandaid masquerading as a tradeoff.
4. **If the user is in a hurry, cut SCOPE, not corners.** Drop one of four features and ship the remaining three properly.
5. **If the user has a hard deadline that genuinely doesn't fit any clean option**, say so explicitly. "Clean approach takes ~4 hours and I don't think I can finish today; defer or extend?" Never silently swap in a bandaid.

## When a workaround IS legitimate

- **External system is broken and needs a tactical fix.** "GitHub Actions is down, push manually so the deploy can happen." That's responding to external failure with the correct interim action; long-term answer is "wait for GitHub."
- **User EXPLICITLY asks for a one-off temporary fix and acknowledges the tradeoff** ("I know this is a hack, just patch this one row"). Comply, but make sure the request is actually explicit, not just "ship something fast."
