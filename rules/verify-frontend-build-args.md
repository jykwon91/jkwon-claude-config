---
description: When adding any VITE_* env var read in frontend code, verify the entire chain from .env file → docker-compose build args → Dockerfile ARG → Vite build all wires up. Boot guards check runtime env; bundles freeze build-time env. Two layers, two verifications.
---

# Verify Frontend Build Args

Frontend bundles freeze build-time environment values at the moment Vite (or webpack, or rollup) runs `npm run build`. Anything read via `import.meta.env.VITE_*` is inlined into the bundle as a string literal. After that point, the bundle is immutable — runtime env vars cannot reach the frontend.

This is a different layer from backend runtime env. Boot guards (e.g., `check_email_configured`, `check_turnstile_configured`) verify the BACKEND has its env wired. They tell you nothing about whether the FRONTEND bundle was built with the corresponding public values inlined.

## The chain that must be intact

For any `VITE_*` value to actually reach the browser:

```
backend/.env.docker        # operator wires the value here
   ↓
docker-compose.yml         # caddy.build.args declares VITE_X: ${X}
   ↓
docker-compose --env-file  # deploy workflow / operator passes the env file
   ↓
Dockerfile                 # ARG VITE_X= + ENV VITE_X=${VITE_X} BEFORE `RUN npm run build`
   ↓
Vite build                 # inlines import.meta.env.VITE_X into bundle
   ↓
browser                    # reads the inlined literal
```

If ANY link in this chain is missing, the bundle ships with an empty value AND the build succeeds silently. Failure surfaces only at runtime in the browser, often as cryptic 4xx responses from the backend (because the missing public value means the frontend can't generate the matching token / payload).

## The rule

When adding ANY `VITE_*` env-var read to frontend code (`import.meta.env.VITE_X`), the same PR MUST:

1. **Declare the ARG + ENV in the relevant Dockerfile** before any `RUN npm run build`:
   ```dockerfile
   ARG VITE_X=
   ENV VITE_X=${VITE_X}
   RUN npm run build
   ```

2. **Add the build arg to `docker-compose.yml`** under the frontend service's `build.args:` block:
   ```yaml
   caddy:
     build:
       context: ../..
       dockerfile: docker/caddy.Dockerfile
       args:
         VITE_X: ${X:-}
   ```
   Note the right-hand side has NO `VITE_` prefix — it reads from the same env-var name the backend uses, so a single `.env.docker` line drives both layers.

3. **Verify the deploy workflow uses `--env-file`** when running `docker compose build`:
   ```yaml
   - run: |
       docker compose -f apps/{app}/docker-compose.yml \
         --env-file apps/{app}/backend/.env.docker \
         build
   ```
   Without `--env-file`, the build runs with no `.env.docker` values resolved, and `${X}` expands to empty string.

4. **Add a conformance test** that fails CI if any of the three pieces is missing. See `MyFreeApps/packages/shared-backend/tests/test_app_conformance.py::TestTurnstileBundleWiring` for a working pattern — six tests, three per app, one per chain link.

5. **Document the value in `.env.docker.example`** so the operator knows it must be set:
   ```
   # Required when ENVIRONMENT=production. Used by the frontend bundle
   # at build time — see docker/caddy.Dockerfile ARG VITE_X.
   X=
   ```

## How to verify the chain end-to-end

After all five pieces are wired, smoke-test on the deployed bundle:

```bash
# Confirm the value made it into the bundle
docker compose -f apps/{app}/docker-compose.yml exec caddy \
  sh -c 'grep -oE "VITE_X_PATTERN" /srv/frontend/assets/*.js | head -3'
```

Where `VITE_X_PATTERN` is whatever shape your value has (e.g., `0x4AAA[A-Za-z0-9_-]+` for Cloudflare keys). Empty match = chain broken; non-empty = bundle was built with the value.

## Failure mode this prevents

On 2026-05-05, MyFreeApps shipped two production apps (MBK and MJH) where Cloudflare Turnstile was wired:

- Backend boot guard verified `TURNSTILE_SECRET_KEY` was set ✓
- Backend `require_turnstile` dependency rejected requests without a token ✓
- Frontend `TurnstileWidget` read `import.meta.env.VITE_TURNSTILE_SITE_KEY` — empty string ✗
- Widget rendered nothing (component returns null when key is empty)
- Registration POSTs sent no token
- Backend returned 400 `captcha_token_required`
- Both apps had been silently rejecting every new registration since Turnstile was added.

Root cause: neither `caddy.Dockerfile` declared `ARG VITE_TURNSTILE_SITE_KEY`, neither `docker-compose.yml` declared `build.args.VITE_TURNSTILE_SITE_KEY`, neither deploy workflow passed `--env-file`. Three missing pieces in one chain. The boot guard and the `require_turnstile` dependency were both correct; the silent failure was strictly between them in the build pipeline.

Fixed in MyFreeApps PRs #306 (the chain wiring) + a new conformance test class.

## Relationship to other rules

- **`rules/auto-memory-curation.md` operational-migration check** — when adding a `VITE_*` env var via this rule, the PR description should also include the operational migration note (operator must set the new env var on the VPS before the next deploy)
- **`rules/g-auto-capture.md`** — Vite-specific build-time env practices belong in `stacks/vite.md` (or wherever the frontend stack guide lives)
- **`stacks/cloudflare-turnstile.md`** — the canonical example of this rule applied end-to-end

## When NOT to apply this rule

- The env var is a backend-only secret (no `VITE_` prefix). Backend boot guards cover that.
- The value is built-time CI-only and never reaches a deployed bundle (e.g., `VITE_TEST_MODE=true` in CI test runs).
- The frontend is server-rendered (Next.js, Remix) and reads runtime env via the server. In that case, the chain is different — verify the server reads it, not the bundle.
