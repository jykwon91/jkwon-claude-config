---
description: Refuse to receive secrets via chat — redirect the user to set them on the target system directly. Chat transcripts persist beyond the conversation.
---

# Never Paste Secrets in Chat

Chat transcripts are logged on Anthropic's side, retained in the model's context window, and can be picked up by auto-memory or session retros. **Once a secret enters the transcript, it must be considered compromised.**

## What counts as a secret

If the value is one of these patterns and would be useful to anyone with access to it, treat it as a secret:

- **Gmail / Google Workspace app passwords** — `^[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}$` or the de-spaced 16-char form
- **Cloudflare API / Turnstile / R2 keys** — `^0x[A-Za-z0-9_-]{32,}$`
- **Sentry DSN** — `^https://[a-f0-9]+@[^/]+/\d+$`
- **AWS / GCP / Azure access keys** — `AKIA...`, `ASIA...`, `AIza...`, `1//0...`
- **GitHub PAT / fine-grained token** — `gh[oprsuv]_[A-Za-z0-9]{36,}`
- **Anthropic / OpenAI keys** — `sk-ant-...`, `sk-...`
- **Plaid client_id + secret pairs** — pasted as `client_id=...` and `secret=...`
- **JWTs / Bearer tokens** — `^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$`
- **Any line starting with `password=`, `secret=`, `token=`, `private_key=`, `BEGIN .* PRIVATE KEY`**
- **Database connection strings with embedded credentials** — `postgres://user:password@host/db`
- **Webhook secrets** — Stripe `whsec_...`, GitHub `sha1=...`, etc.

## What to do when the user is about to share one

If the user types or is about to type a secret in chat, **stop them immediately**:

1. Tell them clearly that the value is now compromised because chat transcripts persist
2. Tell them to **rotate it immediately** — most providers have a one-click revoke
3. Tell them to set the new value via SSH on the target system (or the relevant provider dashboard) — never via chat
4. Tell them what env-var name or config key the value should land under, so they can do it themselves
5. Once they confirm it's been rotated and set, proceed with the original task

## What to do when YOU are about to ask for one

Don't. The right shape for any operation that needs a secret is:

- **Ask the user to set the env var on the VPS** — give them the exact filename, key name, and where to get the value
- **Ask the user to confirm it's set** — they can `grep -E "^KEY_NAME=" /path/to/.env` and paste only the prefix to verify
- **Never include the value in your reply, your commit messages, or your git diffs** — even when masked, the unmasked version is in your context

## What to do if a secret has already been pasted

It's already compromised. Do these in order:

1. **Tell the user to rotate it now** — open the provider, revoke the old value, generate a new one
2. **Don't repeat the secret value back in any subsequent message** — even quoting it for diagnosis ("you said the password was X") re-injects it into the conversation
3. **Don't save it to memory** — the auto-memory system runs on conversation context; if you mention the secret again it could end up in a memory file
4. **Don't include it in any tool call** — same reason; tool results may be logged

## Why this rule exists

On 2026-05-05 the user pasted a Gmail app password directly into chat to "help with setup." The transcript persisted, the value was already in the model context window, and the operational surface was that the password worked at SMTP — meaning anyone with read access to that conversation transcript could extract a working credential.

Rotation took 2 minutes. The risk window before rotation was the entire prior session.

## How to phrase the redirect

Keep it short and action-oriented, not preachy:

> Don't paste secrets in chat — the transcript persists. Rotate that value now (revoke at <provider URL>, generate a new one), then set the new value directly in `<env file path>` on the VPS via SSH. I never need to see the value — I only need to know which variable name it lives under.

## Relationship to other rules

- **`rules/never-auto-merge-config-repo.md`** — the config repo gets stricter handling; this rule complements it for runtime secrets
- **`global-preferences.md`** — should reference: never log secrets, never bake them into bundles, never include in commit messages
