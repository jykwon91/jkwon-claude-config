---
description: Refuse to receive secrets via chat — redirect the user to set them on the target system directly. Chat transcripts persist beyond the conversation.
---

# Never Paste Secrets in Chat

Chat transcripts are logged, retained in the model's context window, and can be picked up by auto-memory or session retros. **Once a secret enters the transcript, it must be considered compromised.**

## What counts as a secret

Any value matching one of these patterns, useful to anyone with access:

- **Gmail / Google Workspace app passwords** — `^[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}$` or de-spaced 16-char form
- **Cloudflare API / Turnstile / R2 keys** — `^0x[A-Za-z0-9_-]{32,}$`
- **Sentry DSN** — `^https://[a-f0-9]+@[^/]+/\d+$`
- **AWS / GCP / Azure access keys** — `AKIA...`, `ASIA...`, `AIza...`, `1//0...`
- **GitHub PAT / fine-grained token** — `gh[oprsuv]_[A-Za-z0-9]{36,}`
- **Anthropic / OpenAI keys** — `sk-ant-...`, `sk-...`
- **Plaid client_id + secret pairs**
- **JWTs / Bearer tokens** — `^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$`
- **Any line starting with `password=`, `secret=`, `token=`, `private_key=`, `BEGIN .* PRIVATE KEY`**
- **DB connection strings with embedded credentials** — `postgres://user:password@host/db`
- **Webhook secrets** — Stripe `whsec_...`, GitHub `sha1=...`, etc.

## What to do when the user is about to share one

Stop them immediately:

1. Tell them the value is now compromised because chat transcripts persist
2. Tell them to **rotate it immediately** — most providers have one-click revoke
3. Tell them to set the new value via SSH on the target system (or provider dashboard) — never via chat
4. Tell them what env-var name or config key the value should land under
5. Once they confirm rotated + set, proceed with the original task

## What to do when YOU are about to ask for one

Don't. The right shape:

- **Ask the user to set the env var on the VPS** — give exact filename, key name, where to get the value
- **Ask the user to confirm it's set** — they can `grep -E "^KEY_NAME=" /path/to/.env` and paste only the prefix
- **Never include the value in your reply, commit messages, or git diffs** — even when masked, the unmasked version is in your context

## What to do if a secret has already been pasted

Already compromised. In order:

1. **Tell the user to rotate now** — open provider, revoke old value, generate new
2. **Don't repeat the secret in any subsequent message** — even quoting for diagnosis re-injects it
3. **Don't save it to memory** — auto-memory runs on conversation context
4. **Don't include it in any tool call** — tool results may be logged

## How to phrase the redirect

Short and action-oriented, not preachy:

> Don't paste secrets in chat — the transcript persists. Rotate that value now (revoke at <provider URL>, generate a new one), then set the new value directly in `<env file path>` on the VPS via SSH. I never need to see the value — I only need to know which variable name it lives under.
