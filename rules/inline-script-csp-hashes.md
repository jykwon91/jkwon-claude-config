---
description: When adding any inline `<script>` to index.html under a strict CSP, declare the SHA-256 hash in script-src in the same PR. Copy the hash from the browser's CSP-blocked-script console message — never type it from scratch.
---

# Inline Script CSP Hashes

Under a strict CSP (`script-src 'self'` without `'unsafe-inline'`), inline `<script>` blocks in `index.html` are blocked. The bundle still loads (external `<script type="module" src="...">` is allowed), but inline init scripts (theme bootstrap, analytics, polyfill loaders) silently fail — usually surfacing as a brief flash of unstyled content or a feature that doesn't activate.

## The rule

When adding ANY inline `<script>...</script>` to `index.html` (or any HTML served under a strict CSP), the same PR MUST:

1. **Add a SHA-256 hash to the CSP `script-src`** allowing that exact script:
   ```
   script-src 'self' 'sha256-...' https://other.allowed.origin
   ```
2. **Get the hash from the browser's CSP-blocked-script console message** — never compute by hand from scratch:
   ```
   Content-Security-Policy: The page's settings blocked an inline script ...
   Consider using a hash ('sha256-6gP5jY9WKtmx3Qr/KXGhyuG+YL86Nf6nSb7wHrV5jmk=')
   ```
3. **Copy-paste, don't transcribe.** Monospace fonts in dev tools make `5` vs `S` and `0` vs `O` indistinguishable.
4. **Comment the hash in the CSP** with a pointer to the script it allows:
   ```
   # script-src 'sha256-...' allows the inline theme-bootstrap script
   # in apps/{app}/frontend/index.html lines X-Y. If the script is
   # ever edited, the hash must be regenerated.
   ```
5. **Keep the inline script tiny + frozen.** Hashes are content-specific — any byte change breaks the hash. Convention: minify by hand, comment "do not edit without regenerating CSP hash", treat as a frozen artifact.

## When NOT to add `'unsafe-inline'` instead

Tempting to "just add `'unsafe-inline'`" — DON'T. It defeats the entire `script-src` directive: any XSS that can inject `<script>` now executes. The hash approach allows ONE specific script byte-for-byte; an attacker can't inject a different inline script.

The only legitimate exception is a CSP `nonce` system, which requires server-side nonce generation per response. For static SPAs (Vite + Caddy file_server), the hash approach is the right shape.

## How to regenerate the hash when the script changes

1. **Easiest: deploy with the old hash, let the browser tell you the new hash.** The browser blocks the new script and emits the correct hash in the console error.
2. **Pre-deploy: compute locally.** Extract the script body (no `<script>` wrapper, no leading/trailing whitespace):
   ```bash
   echo -n '(function(){...the literal script body...})()' | openssl sha256 -binary | base64
   ```
   Prefix with `sha256-` in the CSP.
3. **Treat as forbidden.** Mark with a comment "DO NOT EDIT — see CSP hash in Caddyfile.docker line N" so contributors know the change is more involved than it looks.

Option 1 has the best ergonomics — the browser is the source of truth.
