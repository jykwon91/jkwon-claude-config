---
description: When wrapping any third-party verification or webhook API, log the provider's error codes. Never reduce a documented error response to bare bool — it makes diagnostics impossible later.
---

# Log Third-Party Error Codes

Third-party verification, webhook-signature, and OAuth introspection APIs return structured error responses with documented codes that pinpoint why a call failed. Wrapping them and returning bare `bool` throws that away — the diagnostic gap surfaces months later when production fails intermittently and nobody can tell why.

## The rule

Any service function wrapping a third-party API documented to return error codes MUST:

1. **Capture the error codes** — usually under `error-codes`, `errors`, `error.code`
2. **Log them at WARNING** (or ERROR if production-critical) with structured context
3. **Either return them to the caller** (so the caller can route on the specific code) **OR emit via Sentry tags** so dashboards group by failure reason
4. **Never silently swallow via bare `return False`** — the bool says "it failed" but not "why"

## Concrete shape

```python
# WRONG — diagnostic info lost
async def verify_turnstile_token(token: str, *, secret_key: str) -> bool:
    resp = await client.post(VERIFY_URL, data={"secret": secret_key, "response": token})
    return resp.json().get("success", False)

# RIGHT — caller can route on codes; logs surface the reason
async def verify_turnstile_token(
    token: str, *, secret_key: str,
) -> tuple[bool, list[str]]:
    resp = await client.post(VERIFY_URL, data={"secret": secret_key, "response": token})
    result = resp.json()
    success = result.get("success", False)
    error_codes = result.get("error-codes", [])
    if not success:
        logger.warning(
            "Turnstile verify failed: codes=%s hostname=%s action=%s",
            error_codes,
            result.get("hostname"),
            result.get("action"),
        )
    return success, error_codes
```

If the caller is a FastAPI dependency, give it the codes so it can emit a specific 4xx body:

```python
async def require_turnstile(request: Request) -> None:
    token = request.headers.get("X-Turnstile-Token", "")
    success, error_codes = await verify_turnstile_token(token, secret_key=settings.turnstile_secret_key)
    if not success:
        if "timeout-or-duplicate" in error_codes:
            raise HTTPException(400, detail="captcha_expired_please_retry")
        if any(c in error_codes for c in ("invalid-input-secret", "missing-input-secret")):
            logger.error("Turnstile misconfigured: %s", error_codes)
            raise HTTPException(503, detail="captcha_service_misconfigured")
        raise HTTPException(400, detail="captcha_verification_failed")
```

## APIs this applies to (non-exhaustive)

Any API where failure response carries structured codes:

- **Cloudflare Turnstile siteverify** — `error-codes: string[]`
- **HIBP Pwned Passwords** — HTTP status + count; distinguish breach-detected from network-failure (fail-open vs fail-closed)
- **Stripe / GitHub webhook signature** — specific validation error types
- **Plaid item refresh / link** — `error_code` field with documented enum
- **Anthropic / OpenAI** — `error.type` (`invalid_request_error`, `rate_limit_error`, `authentication_error`, ...)
- **OAuth introspection (RFC 7662)** — token-status fields
- **Google reCAPTCHA** — `error-codes` (v2/v3) or `riskAnalysis.score` (Enterprise)
- **DNS-over-HTTPS / DKIM verify** — DNS RCODE + DKIM result fields
- **Apple App Store / Google Play receipt validation** — documented status codes

## What this rule does NOT require

- Logging codes from APIs that don't document them (bare `bool` is OK; include status + text in the log).
- Surfacing codes to the END USER. Some are config bugs, some are "try again", some leak provider implementation. Caller decides what's user-facing.
- Testing every error-code branch. Test happy path + at least one failure path. Codes evolve faster than tests.

## Auto-capture trigger

Adding a new third-party API wrapper and finding yourself writing `return False`/`return None` on non-success from a provider that documents error codes — stop and refactor to capture them. Five lines of code; compounds with every silent failure later.
