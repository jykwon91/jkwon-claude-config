---
description: When adding any VITE_* env var read in frontend code, verify the entire chain from .env file → docker-compose build args → Dockerfile ARG → Vite build all wires up. Boot guards check runtime env; bundles freeze build-time env. Two layers, two verifications.
---

# Verify Frontend Build Args

Frontend bundles freeze build-time env values when Vite (or webpack/rollup) runs `npm run build`. Anything read via `import.meta.env.VITE_*` is inlined as a string literal. After that, the bundle is immutable — runtime env vars cannot reach the frontend.

This is a different layer from backend runtime env. Boot guards (`check_email_configured`, `check_turnstile_configured`) verify the BACKEND. They say nothing about whether the FRONTEND bundle was built with the corresponding public values inlined.

## The chain that must be intact

For any `VITE_*` value to reach the browser:

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

If ANY link is missing, the bundle ships with empty value AND the build succeeds silently. Failure surfaces only in the browser, often as cryptic 4xx responses from the backend.

## The rule

When adding ANY `VITE_*` env-var read to frontend code, the same PR MUST:

1. **Declare ARG + ENV in the relevant Dockerfile** before any `RUN npm run build`:
   ```dockerfile
   ARG VITE_X=
   ENV VITE_X=${VITE_X}
   RUN npm run build
   ```

2. **Add the build arg to `docker-compose.yml`** under the frontend service's `build.args:`:
   ```yaml
   caddy:
     build:
       context: ../..
       dockerfile: docker/caddy.Dockerfile
       args:
         VITE_X: ${X:-}
   ```
   The right-hand side has NO `VITE_` prefix — it reads from the same env-var name the backend uses, so a single `.env.docker` line drives both layers.

3. **Verify the deploy workflow uses `--env-file`** when running `docker compose build`:
   ```yaml
   - run: |
       docker compose -f apps/{app}/docker-compose.yml \
         --env-file apps/{app}/backend/.env.docker \
         build
   ```
   Without `--env-file`, the build runs with no `.env.docker` values resolved; `${X}` expands to empty.

4. **Add a conformance test** that fails CI if any piece is missing. See `MyFreeApps/packages/shared-backend/tests/test_app_conformance.py::TestTurnstileBundleWiring` — six tests, three per app, one per chain link.

5. **Document the value in `.env.docker.example`**:
   ```
   # Required when ENVIRONMENT=production. Used by the frontend bundle
   # at build time — see docker/caddy.Dockerfile ARG VITE_X.
   X=
   ```

## How to verify the chain end-to-end

After all five pieces are wired, smoke-test on the deployed bundle:

```bash
docker compose -f apps/{app}/docker-compose.yml exec caddy \
  sh -c 'grep -oE "VITE_X_PATTERN" /srv/frontend/assets/*.js | head -3'
```

Where `VITE_X_PATTERN` is whatever shape your value has (e.g., `0x4AAA[A-Za-z0-9_-]+` for Cloudflare keys). Empty match = chain broken; non-empty = bundle was built with the value.

## When NOT to apply this rule

- Backend-only secret (no `VITE_` prefix). Backend boot guards cover that.
- Build-time CI-only value that never reaches a deployed bundle (e.g., `VITE_TEST_MODE=true` in CI).
- Server-rendered frontend (Next.js, Remix) reading runtime env via the server — chain is different; verify the server reads it, not the bundle.
