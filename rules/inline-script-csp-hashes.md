---
description: When adding any inline `<script>` to index.html under a strict CSP, declare the SHA-256 hash in script-src in the same PR. Copy the hash from the browser's CSP-blocked-script console message — never type it from scratch.
---

# Inline Script CSP Hashes

When the project has a strict CSP (`script-src 'self'` without `'unsafe-inline'`), any inline `<script>` block in `index.html` is blocked. The bundle still loads (external `<script type="module" src="...">` is allowed), but inline init scripts (theme bootstrap, analytics snippets, polyfill loaders) silently fail. Symptom is usually a brief flash of unstyled content or a feature that just doesn't activate.

## The rule

When adding ANY inline `<script>...</script>` to `index.html` (or any HTML file served under a strict CSP), the same PR MUST:

1. **Add a SHA-256 hash to the CSP `script-src`** allowing that exact script:
   ```
   script-src 'self' 'sha256-...' https://other.allowed.origin
   ```
2. **Get the hash directly from the browser's CSP-blocked-script console error message** — never compute it by hand from scratch. The browser tells you the EXACT hash that would unblock the script:
   ```
   Content-Security-Policy: The page's settings blocked an inline script ...
   Consider using a hash ('sha256-6gP5jY9WKtmx3Qr/KXGhyuG+YL86Nf6nSb7wHrV5jmk=')
   ```
3. **Copy-paste, don't transcribe.** The browser's monospace font in dev tools makes `5` vs `S` and `0` vs `O` indistinguishable at a glance. On 2026-05-05 I transcribed `Nf6n5b7w` instead of `Nf6nSb7w` and shipped a PR that didn't fix the bug.
4. **Comment the hash in the CSP** with a pointer to the script it allows so future maintainers know what's allowed and why:
   ```
   # script-src 'sha256-...' allows the inline theme-bootstrap script
   # in apps/{app}/frontend/index.html lines X-Y. If the script is
   # ever edited, the hash must be regenerated.
   ```
5. **Keep the inline script tiny + frozen.** Hashes are content-specific — any byte change breaks the hash. Convention: minify by hand, comment "do not edit without regenerating CSP hash", treat the script as a frozen artifact.

## When NOT to add `'unsafe-inline'` instead

Tempting to "just add `'unsafe-inline'`" — DON'T. It defeats the entire CSP `script-src` directive: any XSS that can inject a `<script>` tag now executes. The hash approach allows ONE specific script byte-for-byte; an attacker can't inject a different inline script.

The only legitimate exception is using a CSP `nonce` system, which requires server-side nonce generation per response. For static SPAs (Vite + Caddy file_server), the hash approach is the right shape.

## How to regenerate the hash when the script changes

Three options:

1. **Easiest: deploy with the old hash, let the browser tell you the new hash.** Wait — the browser will block the new script and emit the new correct hash in the console error.
2. **Pre-deploy: compute it locally.** Extract the script body (no `<script>` wrapper, no leading/trailing whitespace) and hash it:
   ```bash
   echo -n '(function(){...the literal script body...})()' | openssl sha256 -binary | base64
   ```
   The output is your hash; prefix with `sha256-` in the CSP.
3. **Treat it as forbidden.** Mark the script with a comment "DO NOT EDIT — see CSP hash in Caddyfile.docker line N" so contributors know the change is more involved than it looks.

Option 1 has the best ergonomics — the browser is the source of truth.

## Failure mode this prevents

On 2026-05-05, MyFreeApps' MJH frontend had a strict CSP `script-src 'self'` and an inline theme-bootstrap script in `index.html`. The bootstrap silently never ran in production. Symptom: brief flash-of-wrong-theme on first paint when users had dark mode preferred. Visible bug, no error surfaced to users beyond a console message they'd never see.

When PR #308 added a hash to fix it, I transcribed the value wrong (one character — `5` for `S`). PR #309 (one-line follow-up) corrected it. Total cost of the typo: one wasted CI run + the user noticing the same console error after the rebuild + one follow-up PR.

The "copy-paste, don't transcribe" part of this rule exists specifically to prevent that retry.

## Auto-capture trigger

If a session adds an inline `<script>` to `index.html` and I find myself either (a) skipping the CSP update or (b) transcribing the hash from a browser screenshot rather than copy-pasting, stop and apply this rule.

## Relationship to other rules

- **`stacks/cloudflare-turnstile.md`** — Turnstile widget loads via external script (allowed via origin in CSP), but the same `index.html` typically has an inline theme-bootstrap that triggers this rule
- **`rules/verify-frontend-build-args.md`** — sibling rule for the build-time-vs-runtime-env class of bug; both prevent silent frontend failures invisible from the backend's perspective
