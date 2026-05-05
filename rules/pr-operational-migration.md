---
description: When a PR introduces a boot guard, removes silent-fail behaviour, or otherwise requires the operator to update VPS state BEFORE the next deploy, the PR description must include an explicit "Operational migration required" section with exact env-var lines / commands.
---

# PR Operational Migration

Some PRs ship breaking changes that are intentional but require the operator to update VPS configuration BEFORE the next deploy or the app crashes. Boot guards (fail-loud-on-misconfig in production), silent-fail removals (registration now propagates failures instead of swallowing them), and env-var renames all fall in this category.

If the PR description doesn't tell the operator what to do, two failure modes:

1. **Operator deploys, app crashes at lifespan startup, healthcheck fails, deploy rolls back.** Now production is stuck on the previous image and the operator has to hunt through the PR diff to figure out what env var to set.
2. **Operator deploys, app boots silently in degraded mode** (because a different env var was set wrong). The "fix" gets reverted because nobody can see what was wrong.

## The rule

Any PR matching ANY of these patterns MUST include an "Operational migration" section in its description:

- Adds a fail-loud boot guard in any service's lifespan (`check_*_configured`, `assert_*_set`, etc.)
- Renames an env var that's already wired in production
- Changes a default value of a config field that the production env relies on
- Migrates a service from silent-fail to fail-loud (e.g., `return False` → `raise XError`)
- Changes a service's required-arguments shape (e.g., adds a new required field to a Settings class)
- Touches `Caddyfile`, `docker-compose.yml`, `Dockerfile` in a way that depends on a new env value being set
- Removes graceful-degradation behaviour the operator has been relying on

## Section template

The PR description must have a top-level section that looks roughly like this:

```markdown
## ⚠️ Operational migration required

After this PR merges and before/at the next deploy, the operator MUST do these
steps on the VPS or the app will not boot.

### What to set

Edit `apps/<app>/backend/.env.docker` (or wherever the relevant secret store is)
and add/update:

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

- The change is purely additive in a way that defaults-clean (e.g., new env var with a sensible default; old deploys keep working)
- The change is local-only (test fixtures, build-time tooling, doc updates)
- The change is internal refactoring with no observable behaviour change

## Auto-capture trigger

When I'm about to commit a PR that:

- Adds `check_*_configured(...)` to a lifespan
- Replaces `return False` with `raise X` in a service that's called from a request handler
- Changes a Settings default value (especially `email_backend`, `log_level`, `*_timeout`, `*_threshold`)
- Adds a required field to a class that's parsed from env

... I should automatically draft the "Operational migration" section and ask whether it applies. If yes, include it. If no, document the why-not in the PR description so a future reader doesn't have to re-derive that this PR is safe.

## Failure mode this prevents

On 2026-05-05 PR #293 added the email boot guard with a clear "Operational migration required" block — operator updated `.env.docker`, deploy succeeded.

In contrast, PR #305 (MBK email service migration) had NO operational-migration section. It implicitly assumed `EMAIL_BACKEND=smtp` was already set in MBK's prod (it was — by luck). If MBK had been running on the default `console` value, the next MBK deploy would have crashed at the new email boot guard introduced in #293, and the operator would have had to grep the PR diff to figure out why.

This rule formalizes the pattern #293 used and makes it the default for all breaking-change PRs.

## Relationship to other rules

- **`rules/never-auto-merge-config-repo.md`** — config-repo PRs always need human review; this rule extends "review carefully" to project repos when an operational migration is implied
- **`rules/check-third-party-error-codes.md`** — error codes from third-party APIs sometimes surface ON a deploy that didn't run the operational migration (e.g., `EmailNotConfiguredError` at boot). The error message itself should reference the PR's operational-migration block when possible.
