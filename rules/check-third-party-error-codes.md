---
description: When wrapping any third-party verification or webhook API, log the provider's error codes. Never reduce a documented error response to bare bool — it makes diagnostics impossible later.
---

# Log Third-Party Error Codes

Most third-party verification, webhook-signature, and OAuth introspection APIs return STRUCTURED error responses with documented error codes that pinpoint exactly why a call failed. Code that wraps them and returns just `bool` (or `Optional[T]`) throws away that information — and the diagnostic gap surfaces months later when production starts failing intermittently and nobody can tell why.

## The rule

When implementing any service function that wraps a third-party API documented to return error codes, the function MUST:

1. **Capture the error codes** in the response — they're usually under `error-codes`, `errors`, `error.code`, or similar
2. **Log them at WARNING level** (or ERROR if production-critical) on every failure path with structured context
3. **Either return them to the caller** (so the caller can route on the specific code) OR **emit them via Sentry tags** so production dashboards can group by failure reason
4. **Never silently swallow them via bare `return False`** — the bool tells the caller "it failed" but not "why"

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

If the caller is a FastAPI dependency or middleware that needs to translate the failure to an HTTP error, give it the code list so it can emit a more specific 4xx body:

```python
async def require_turnstile(request: Request) -> None:
    token = request.headers.get("X-Turnstile-Token", "")
    success, error_codes = await verify_turnstile_token(token, secret_key=settings.turnstile_secret_key)
    if not success:
        # Distinguish "user error" (try again) from "config error" (bug)
        if "timeout-or-duplicate" in error_codes:
            raise HTTPException(400, detail="captcha_expired_please_retry")
        if any(c in error_codes for c in ("invalid-input-secret", "missing-input-secret")):
            # Config bug — alert ops, don't blame the user
            logger.error("Turnstile misconfigured: %s", error_codes)
            raise HTTPException(503, detail="captcha_service_misconfigured")
        raise HTTPException(400, detail="captcha_verification_failed")
```

## What APIs this applies to (non-exhaustive)

Any API where the failure response carries structured error codes:

- **Cloudflare Turnstile siteverify** — `error-codes: string[]` (`timeout-or-duplicate`, `invalid-input-secret`, `bad-request`, ...)
- **HIBP Pwned Passwords** — HTTP status + count; should distinguish breach-detected from network-failure (the silent fail-open vs fail-closed decision)
- **Stripe webhook signature** — specific signature-validation error types
- **GitHub webhook signature** — same
- **Plaid item refresh / link** — `error_code` field with documented enum values
- **Anthropic / OpenAI** — `error.type` (`invalid_request_error`, `rate_limit_error`, `authentication_error`, ...)
- **OAuth introspection (RFC 7662)** — token-status fields
- **Google reCAPTCHA** — `error-codes` (legacy v2/v3) or `riskAnalysis.score` (Enterprise)
- **DNS-over-HTTPS / DKIM verify** — DNS RCODE + DKIM result fields
- **Apple App Store / Google Play receipt validation** — documented status code enums

## What this rule DOESN'T require

- You don't need to log error codes from APIs that don't document them. If the API returns generic 500-with-text, the bare `bool` is OK (just include the response status + text in the log).
- You don't need to surface error codes to the END USER. Some are config bugs, some are "try again", some leak provider implementation. The caller decides what's user-facing.
- You don't need to test every error-code branch in unit tests. Test the happy path + at least one failure path. Codes evolve faster than tests.

## Failure mode this prevents

On 2026-05-05, MyFreeApps registration started returning `400 captcha verification failed`. The `verify_turnstile_token` service returned bare `bool`. We had to walk through five hypotheses (token reuse, key mismatch, domain mismatch, CSP block, network outage) before landing on the actual cause (HIBP password rejection on first attempt → user retry → spent token on second attempt). With error-code logging, the Sentry dashboard would have shown `error-codes: ["timeout-or-duplicate"]` immediately and we would have known within 30 seconds it was a token-reuse issue, not a config bug.

Time cost of the diagnostic gap: ~90 minutes of confused debugging. Time cost of the fix: 5 lines of code.

## Auto-capture trigger for this rule

Any time I add a new third-party API wrapper and find myself writing `return False` or `return None` on a non-success response from a provider that documents error codes, stop and refactor to capture them. This is small enough that the cost is negligible; the cost of NOT doing it compounds with every silent failure later.

## Relationship to other rules

- **`stacks/cloudflare-turnstile.md`** — concrete application of this rule
- **`feedback_check_sentry_first.md`** — Sentry-first diagnosis only works if the error codes ARE in Sentry. This rule ensures they get there.
- **`feedback_no_bandaid_solutions.md`** — bare `bool` returns ARE a bandaid; they hide the real failure mode and force every caller to invent its own diagnostic.
