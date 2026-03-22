---
description: Automatically captures stack-specific best practices from technical users and contributes them back to the global config
---

# Auto-Capture Stack Practices

When a technical user states or corrects a stack-specific best practice during normal work, automatically capture it. Do not ask for permission — just do it. The PR mechanism is the review gate.

## What to capture

- Direct corrections: "always use table-driven tests in Go", "never use useEffect for data fetching"
- Patterns the user enforces repeatedly: if they correct the same thing twice, it's a practice worth saving
- Framework-specific conventions: "in Django, always use select_related for foreign keys"
- Anti-patterns: "never use var in TypeScript, always use const/let"

## What NOT to capture

- Project-specific rules (use CLAUDE.md for those)
- Personal preferences that aren't widely accepted best practices
- Opinions on tabs vs spaces, semicolons, or purely stylistic choices
- Anything already in the stack guide

## Scope — what you can and cannot modify

Auto-capture may ONLY modify files under `stacks/*.md`. All other files in the config repo are owned by @jykwon91 and must not be touched:
- `CLAUDE.md` — off limits
- `global-preferences.md` — off limits
- `agents/*.md` — off limits
- `skills/` — off limits
- `install.sh`, `onboard.sh`, `uninstall.sh` — off limits
- `stacks.md` — off limits

If a captured practice is universal (not stack-specific), do NOT add it to any file. Instead, mention it to the user: "That sounds like a universal preference — you can add it to global-preferences.md with `/add-preference`."

## How to capture

1. **Identify the stack** — which framework/language does this practice apply to? (React, Python, Go, FastAPI, Django, Vue, etc.)
2. **Update the local stack guide** — read `~/.claude/stacks/<stack>.md`. If it exists, add the practice in the appropriate section. If it doesn't exist, create it with proper structure.
3. **PR to global config** — clone/pull `~/.claude/.config-repo`, create a branch `stack/<stack>-<short-description>`, update ONLY `stacks/<stack>.md`, push, and create a PR with a clear title and the practice as the body. Always request review from @jykwon91.

## PR format

```
Title: Add <practice summary> to <stack> guide
Body: Captured from user during <project/context>.
      Practice: <the exact practice>
      Reason: <why, if the user gave one>

Reviewer: @jykwon91
```

## Tone

Do this silently in the background. Don't interrupt the user's flow. After capturing, mention it briefly:
> "Added that to the Go stack guide — it'll be in a PR for review."

One sentence, then move on. The user should barely notice it happened.

## When the stack guide doesn't exist yet

Create a new file at `~/.claude/stacks/<stack>.md` following this structure:

```markdown
# <Stack> Stack Guide

Apply these patterns when the project uses <Stack>. Detect from <detection method>.

## CRITICAL — <category>

- <practice>

## HIGH — <category>

- <practice>
```

Assign severity based on impact: CRITICAL for things that cause bugs or data loss, HIGH for performance and maintainability, MEDIUM for style and consistency.
