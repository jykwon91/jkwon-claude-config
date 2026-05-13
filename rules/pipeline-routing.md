# Pipeline Routing

When the user describes work, automatically route to the correct pipeline based on intent. Never ask the user which pipeline to use — detect from their message.

## Route to `g-troubleshoot` when the user describes:

- An error message or stack trace ("I see this error", "I'm getting this exception")
- Unexpected behavior ("this isn't working the way I want", "X should do Y but it does Z")
- A regression ("this used to work", "it broke after...")
- A bug report or GitHub issue referencing a defect
- Data that looks wrong ("the numbers don't add up", "showing the wrong value")
- A failing test they didn't write
- Something crashing, hanging, or timing out

## Route to `g-build-feature` when the user describes:

- A new capability ("add a way to...", "I want to be able to...")
- An enhancement ("make it so that...", "it would be nice if...")
- A new page, endpoint, model, or workflow
- A greenfield project ("I want to build...")
- Integrating with a new service or API

## Route to `g-debug-bug` (lightweight, no pipeline) when:

- The user asks for just diagnosis ("what's causing this?", "why is this happening?")
- The user wants to understand the problem but not fix it yet
- The issue is in a third-party library or infrastructure (not fixable via code changes)

## Recognize build-system / infra-wiring issues — neither feature nor bug

Some issues span backend env, docker-compose, Dockerfile build args, deploy workflows, and frontend bundles simultaneously. Symptoms:

- "Setting works in local dev but breaks in production deploy" (build-time env wasn't passed through)
- "Backend logs are clean but the browser is broken" (gap between runtime and build-time env layers)
- "I changed `.env.docker` but it didn't take effect"
- "`docker compose build` succeeds but the deployed bundle is missing X"
- "Boot guard passes but the corresponding feature in the browser is broken"

When you spot this category:

1. **Don't route to `g-troubleshoot`** — it focuses on backend/frontend logic, won't walk the build-arg chain
2. **Don't route to `g-build-feature`** — feature exists; wiring is broken
3. **Walk the chain explicitly**, in order, asking the user to grep/inspect at each step:
   - `.env.docker` has the variable set
   - `docker-compose.yml` has it under `build.args:` for the relevant service
   - The Dockerfile has `ARG NAME=` + `ENV NAME=...` BEFORE `RUN npm run build`
   - The deploy workflow runs `docker compose --env-file <path> build`
   - The deployed bundle actually contains the value (`grep` inside the running container)
4. **Reference `rules/verify-frontend-build-args.md`** — that rule is the formal contract for this class of bug

## Ambiguous cases

If the message could be either a bug fix or a feature ("this page needs to handle the case where..."):

- Existing code that should already handle it but doesn't → `g-troubleshoot`
- No existing code, this is new behavior → `g-build-feature`

## Never ask which pipeline to use

Detect, route, and set expectations. If you're wrong, the user will correct you.
