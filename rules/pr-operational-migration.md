---
description: When a PR introduces a boot guard, removes silent-fail behaviour, or otherwise requires the operator to update VPS state BEFORE the next deploy, the PR description must include an explicit "Operational migration required" section with exact env-var lines / commands.
---

# PR Operational Migration

Some PRs ship breaking changes that require the operator to update VPS configuration BEFORE the next deploy or the app crashes. Boot guards, silent-fail removals, env-var renames all fall in this category. If the PR description doesn't tell the operator what to do, either (1) the app crashes at lifespan startup and deploy rolls back, or (2) it boots silently in degraded mode and the "fix" gets reverted because nobody can see what's wrong.

## The rule

Any PR matching ANY of these patterns MUST include an "Operational migration" section:

- Adds a fail-loud boot guard in any lifespan (`check_*_configured`, `assert_*_set`, etc.)
- Renames an env var already wired in production
- Changes a default value of a config field production relies on
- Migrates a service from silent-fail to fail-loud (`return False` → `raise XError`)
- Changes a service's required-arguments shape (adds required field to Settings)
- Touches `Caddyfile`, `docker-compose.yml`, `Dockerfile` in a way that depends on a new env value
- Removes graceful-degradation behaviour the operator was relying on

## Section template

```markdown
## ⚠️ Operational migration required

After this PR merges and before/at the next deploy, the operator MUST do these
steps on the VPS or the app will not boot.

### What to set

Edit `apps/<app>/backend/.env.docker` and add/update:

\`\`\`
NEW_REQUIRED_VAR=<value>
EXISTING_VAR=<new-required-value>
\`\`\`

### How to verify

\`\`\`bash
grep -E "^NEW_REQUIRED_VAR=|^EXISTING_VAR=" apps/<app>/backend/.env.docker
# Both lines should show non-empty values
\`\`\`

### How to recover if a deploy already failed

\`\`\`bash
docker compose -f apps/<app>/docker-compose.yml logs api --tail=50 | grep -iE "error|exception"
# Look for `<XErrorName>: <message>` — set the env var listed in the message
\`\`\`

### Rollback path

If the operational migration can't be done immediately, the safe rollback is to
revert this PR in main (the previous image still works without the new env var).
```

## When NOT to use this section

- Purely additive in a defaults-clean way (new env var with sensible default; old deploys keep working)
- Local-only changes (test fixtures, build-time tooling, doc updates)
- Internal refactoring with no observable behaviour change

## Auto-capture trigger

About to commit a PR that:

- Adds `check_*_configured(...)` to a lifespan
- Replaces `return False` with `raise X` in a service called from a request handler
- Changes a Settings default value (especially `email_backend`, `log_level`, `*_timeout`, `*_threshold`)
- Adds a required field to a class parsed from env

... draft the "Operational migration" section automatically and ask whether it applies. If yes, include it. If no, document the why-not so a future reader doesn't re-derive that this PR is safe.
