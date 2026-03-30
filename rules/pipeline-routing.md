# Pipeline Routing

When the user describes work to be done, automatically route to the correct pipeline based on intent. Never ask the user which pipeline to use — detect it from their message.

## Route to `g-troubleshoot` when the user describes:

- An error message or stack trace ("I see this error", "I'm getting this exception")
- Unexpected behavior ("this isn't working the way I want", "X should do Y but it does Z")
- A regression ("this used to work", "it broke after...")
- A bug report or GitHub issue referencing a defect
- Data that looks wrong ("the numbers don't add up", "it's showing the wrong value")
- A failing test they didn't write ("this test is failing")
- Something crashing, hanging, or timing out

## Route to `g-build-feature` when the user describes:

- A new capability ("add a way to...", "I want to be able to...")
- An enhancement ("make it so that...", "it would be nice if...")
- A new page, endpoint, model, or workflow
- A greenfield project ("I want to build...")
- Integrating with a new service or API

## Route to `g-debug-bug` (lightweight, no pipeline) when:

- The user explicitly asks for just diagnosis ("what's causing this?", "why is this happening?")
- The user says they want to understand the problem but not fix it yet
- The issue is in a third-party library or infrastructure (not fixable via code changes)

## Ambiguous cases

If the message could be either a bug fix or a feature ("this page needs to handle the case where..."):

- If there's existing code that should already handle it but doesn't → `g-troubleshoot`
- If there's no existing code and this is new behavior → `g-build-feature`

## Never ask which pipeline to use

Detect, route, and set expectations. If you're wrong, the user will correct you.
