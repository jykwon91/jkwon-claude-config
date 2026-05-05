# Cloudflare Turnstile Stack Guide

Apply these patterns when the project uses Cloudflare Turnstile for CAPTCHA gating. Detect from `import.meta.env.VITE_TURNSTILE_SITE_KEY` (frontend), `TURNSTILE_SECRET_KEY` env var (backend), or `https://challenges.cloudflare.com` references in CSP / fetch.

## CRITICAL — keys are domain-bound and per-app

- **One Cloudflare Turnstile site per app domain.** A site registered for `app1.example.com` rejects every token coming from `app2.example.com` with `bad-request`. Never share keys across apps.
- **Site key + Secret key are a matched PAIR.** They're generated together at the Cloudflare dashboard; the secret only validates tokens generated with its corresponding site key. Mixing keys from different sites produces `invalid-input-secret` on every verify.
- **Site key is PUBLIC** (goes in the frontend bundle). **Secret key is PRIVATE** (backend-only, never bundled). The CSP `script-src 'self' https://challenges.cloudflare.com` allows the widget script; the secret never reaches the browser.

## CRITICAL — Vite build-arg chain (the silent-failure footgun)

Every link in this chain MUST exist or the bundle ships with an empty site key:

1. `backend/.env.docker` — `TURNSTILE_SITE_KEY=0x4AAA...`
2. `docker-compose.yml` caddy/frontend service:
   ```yaml
   build:
     args:
       VITE_TURNSTILE_SITE_KEY: ${TURNSTILE_SITE_KEY:-}
   ```
3. Deploy workflow / operator runs:
   ```bash
   docker compose --env-file backend/.env.docker build
   ```
4. `caddy.Dockerfile` (or `frontend.Dockerfile`):
   ```dockerfile
   ARG VITE_TURNSTILE_SITE_KEY=
   ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
   RUN npm run build
   ```
5. Frontend code reads `import.meta.env.VITE_TURNSTILE_SITE_KEY`.

If any link is missing, the widget renders nothing (component should `return null` when key empty), the form posts no token, the backend returns `400 captcha_token_required`. Every new registration silently rejected.

See also: `rules/verify-frontend-build-args.md` — the structural rule. This stack guide is the concrete Turnstile-flavoured application.

## CRITICAL — CSP must allow Cloudflare in three places

```
script-src 'self' https://challenges.cloudflare.com    # widget script
connect-src 'self' https://challenges.cloudflare.com   # widget validation calls
frame-src 'self' https://challenges.cloudflare.com     # widget renders as an iframe
```

Missing `frame-src` is the most common — the widget script loads but the actual challenge iframe is blank. Missing `connect-src` makes the widget say "Verifying..." forever.

## CRITICAL — single-use tokens + auto-reset on failure

Each token from a successfully-solved widget can only be verified by Cloudflare ONCE. After that, `verify_turnstile_token` returns `success: false` with `error-codes: ["timeout-or-duplicate"]`.

Failure mode: registration fails for some reason (HIBP rejection, bad password, server error). Widget still shows "Success!". User clicks Submit again with the same token. Cloudflare rejects → confusing "captcha verification failed" with no indication that the user did anything wrong.

**Fix: reset the widget after every failed submission.** Expose a `reset()` method from the `TurnstileWidget` component:

```tsx
// TurnstileWidget.tsx
export interface TurnstileWidgetHandle {
  reset: () => void;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>((props, ref) => {
  const widgetIdRef = useRef<string | null>(null);
  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));
  // ...
});
```

Then call `turnstileRef.current?.reset()` in the catch block of every form submission that uses the token. Without this, the user has to refresh the entire page to retry.

## HIGH — log Cloudflare error codes server-side

The siteverify response includes `error-codes: string[]` explaining why verification failed. Never reduce to bare `bool`:

```python
# WRONG — swallows diagnostics
async def verify_turnstile_token(token, *, secret_key) -> bool:
    resp = await client.post(VERIFY_URL, data={"secret": secret_key, "response": token})
    return resp.json().get("success", False)

# RIGHT — surfaces error codes
async def verify_turnstile_token(token, *, secret_key) -> tuple[bool, list[str]]:
    resp = await client.post(VERIFY_URL, data={"secret": secret_key, "response": token})
    result = resp.json()
    success = result.get("success", False)
    error_codes = result.get("error-codes", [])
    if not success:
        logger.warning("Turnstile verify failed: codes=%s hostname=%s", error_codes, result.get("hostname"))
    return success, error_codes
```

Common error codes and their causes:
- `missing-input-secret` — server didn't send secret (config bug)
- `invalid-input-secret` — secret key wrong / from different site
- `missing-input-response` — frontend sent empty token (widget didn't solve)
- `invalid-input-response` — token malformed
- `bad-request` — malformed request OR domain mismatch (token generated on wrong host)
- `timeout-or-duplicate` — token expired (>5 min old) OR already used (single-use violation)

## HIGH — fail-loud-in-prod boot guard

The backend should crash at lifespan startup when running in production with no `TURNSTILE_SECRET_KEY`. Otherwise registration silently runs without CAPTCHA protection until someone notices spam:

```python
# platform_shared.core.boot_guards
def check_turnstile_configured(*, turnstile_secret_key: str, environment: str) -> None:
    if environment in ("development", "test"):
        return
    if turnstile_secret_key:
        return
    raise TurnstileNotConfiguredError(
        "TURNSTILE_SECRET_KEY required in non-dev environments"
    )
```

Wire into FastAPI lifespan after `init_sentry()` and before any route handler can run.

## HIGH — use Cloudflare's documented test keys in CI

Cloudflare provides public test keys for automation:

| Site key | Behaviour |
|---|---|
| `1x00000000000000000000AA` | Always passes (visible widget) |
| `2x00000000000000000000AB` | Always blocks (visible widget) |
| `3x00000000000000000000FF` | Forces interactive challenge |
| `1x00000000000000000000BB` | Always passes (invisible widget) |

| Secret key | Behaviour |
|---|---|
| `1x0000000000000000000000000000000AA` | Always passes verification |
| `2x0000000000000000000000000000000AA` | Always fails verification |
| `3x0000000000000000000000000000000AA` | Returns timeout-or-duplicate error |

Reference: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

E2E tests should use these keys instead of mocking Cloudflare's siteverify. The bundle gets a real test key, the widget renders normally, the test passes through the real Cloudflare endpoint, and the backend's `verify_turnstile_token` exercises the real httpx code path.

## HIGH — strict CSP needs hashes for inline theme scripts

If your `index.html` has an inline `<script>` (e.g., theme-bootstrap that sets dark mode before React hydrates), strict CSP `script-src 'self'` blocks it. Symptom: brief flash-of-wrong-theme on first paint, plus a noisy CSP error in the browser console.

Fix: add the SHA-256 hash of the inline script to `script-src`:

```
script-src 'self' 'sha256-...' https://challenges.cloudflare.com
```

The browser emits the EXACT correct hash in the CSP-blocked-script error message — copy from there. **Watch for `5` vs `S` and `0` vs `O` confusion** when transcribing from console fonts; it bit me on 2026-05-05 and required a follow-up patch.

When the script changes, the hash must be regenerated. The script is intentionally minified-by-hand to discourage routine edits.

## MEDIUM — don't render widget when site key is empty

In dev/CI without a Turnstile site, the site key is intentionally empty. The widget should render NOTHING (component returns null) so dev-mode forms don't show a broken widget. The backend's `require_turnstile` dependency should similarly short-circuit to "allow" when its secret is empty. Both behaviors documented; both essential for local development without a Cloudflare account.

```tsx
// TurnstileWidget.tsx
if (!TURNSTILE_SITE_KEY) return null;
```

```python
# require_turnstile dependency
async def require_turnstile(request: Request) -> None:
    if not settings.turnstile_secret_key:
        return  # dev/CI no-op
    # ... real check
```

## MEDIUM — frontend posts the token via header, not body

Don't put the Turnstile token in the JSON body of the registration request — that requires every endpoint to declare it in its Pydantic schema. Use a header instead:

```typescript
await axios.post("/api/auth/register", { email, password }, {
  headers: turnstileToken ? { "X-Turnstile-Token": turnstileToken } : {},
});
```

```python
# require_turnstile reads from header, validates, doesn't pollute the body
async def require_turnstile(request: Request) -> None:
    token = request.headers.get("X-Turnstile-Token", "")
    # ... verify
```

This keeps the schema clean and lets you add Turnstile to existing endpoints without breaking their request shape.

## What NOT to do

- **Don't reuse keys across apps or domains.** Each app needs its own Cloudflare Turnstile site.
- **Don't bake the secret key into the frontend bundle.** Only the public site key. Use the `VITE_` prefix as a bundle-allowlist.
- **Don't return bare `bool` from siteverify.** Log the error codes.
- **Don't skip the auto-reset on failure.** Single-use tokens + no reset = confusing user retries.
- **Don't add `'unsafe-inline'` to `script-src` to fix the inline-theme-script block.** Use a hash. `'unsafe-inline'` defeats the entire CSP.
- **Don't put the token in the request body.** Use a header.
- **Don't disable Turnstile in production by clearing the secret key.** Use `ENVIRONMENT=development` to opt out (and accept that you've also disabled Sentry production enforcement).

## Conformance test pattern

CI should fail when any link in the build-arg chain is missing. See `MyFreeApps/packages/shared-backend/tests/test_app_conformance.py::TestTurnstileBundleWiring` — six tests, three per app:

1. `test_caddy_dockerfile_declares_turnstile_arg` — Dockerfile has ARG + ENV before `npm run build`
2. `test_docker_compose_passes_turnstile_arg_to_caddy` — caddy.build.args includes the wiring
3. `test_deploy_workflow_uses_env_file_for_build` — workflow runs `docker compose --env-file ... build`

These run on every PR and prevent the chain from drifting back to broken.
