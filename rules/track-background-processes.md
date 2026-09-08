# Track Every Background Process in a Global Registry

A background process Claude starts outlives the tool call that created it, and often
the session. Launched with a hidden window it is invisible: it does not appear in the
taskbar, the operator never consented to it in any durable way, and once the session
ends there is no record that it exists, what it does, or how to stop it. The operator
is left with an unexplained process on their machine.

This is a real-incident pattern. On 2026-09-07 a session launched a hidden PowerShell
network monitor via `Start-Process -WindowStyle Hidden`, mentioned it only in passing
inside a table, and the operator's next message was "what monitor?" — they had no way
to know what had been started on their own machine.

## The rule

**Before** launching any process that outlives the tool call, add it to
`~/.claude/BACKGROUND_PROCESSES.md`. Register first, launch second — if the launch
fails you remove the row, but if you launch first you may never get back to write it.

This applies to any of:

- `Start-Process`, `nohup`, `&`, `setsid`, detached `spawn`
- The Bash tool's `run_in_background: true`
- Long-lived dev servers, watchers, tailers, pollers, monitors
- Scheduled work: `CronCreate`, `schtasks`, `at`, `cron`
- Anything with a self-terminating deadline measured in hours

It does **not** apply to ordinary foreground tool calls that finish within the call,
however slow — those end when the call ends and leave nothing behind.

## What every entry must record

The test: **could the operator, months later and with no memory of the session,
identify this process and safely kill it using only this file?**

- **Started** — timestamp, plus the session id
- **PID** and the exact **stop command**
- **What it is** in one plain line
- **Why** it was started — the question it exists to answer
- **Script path** and **every file it writes** (logs, reports, artifacts)
- **Cadence** — how often it wakes
- **Side effects** — what it touches beyond its own log; say "read-only probes" if so
- **Self-termination** — the deadline, or "runs until killed"
- **Hidden?** — whether it has a visible window

## Lifecycle

- **Register** before launching.
- **Move to `## Stopped`** with an outcome line when it exits, is killed, or reaches its
  deadline. Do not delete rows — a stopped entry explains a file the operator later
  finds in temp.
- **Reconcile at session start** if the file has active rows: check whether those PIDs
  are still alive, and correct the file if they aren't. Stale "active" rows are worse
  than no file, because they teach the operator not to trust it.

## Tell the operator, plainly

Registering is not a substitute for saying it out loud. When you start a background
process, state in your reply: what it is, that it's running in the background, whether
it's hidden, and the one-line command to stop it. A file the operator doesn't know to
open is not disclosure.

Prefer a **visible** window unless hiding is genuinely warranted. Hidden is the default
for `Start-Process -WindowStyle Hidden` out of tidiness, and tidiness is not worth the
operator losing track of what runs on their machine.

## Never commit the registry

`~/.claude/BACKGROUND_PROCESSES.md` is machine-local state — PIDs, absolute paths,
sometimes infrastructure addresses. It lives in `~/.claude/`, never in a project tree,
and is never committed to any repo. Same reasoning as
`non-code-public-repo-guardrails.md` and `working-state.md`: the artifact is for the
operator and the next session, not for a public main branch.

## Auto-capture trigger

About to write `Start-Process`, `run_in_background: true`, `nohup`, `CronCreate`, or
anything else that keeps running after the call returns — stop and write the registry
entry first. It costs four lines. Skipping it costs the operator a process they can
neither identify nor stop.
