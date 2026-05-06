# Visible Loading Feedback

Any time a user action triggers an API call (or any async operation that can take more than ~200ms), the UI MUST show visible feedback the moment the action fires — not when the response arrives. Without it, the user is left wondering whether their click did anything, and the natural next action is to click again, which compounds the latency and often double-fires the request.

## The rule

When implementing any user-triggered async operation, the same component MUST:

1. **Show a loading affordance the instant the action fires.** Not after the request resolves — at click time.
2. **Disable the action while it's in flight.** Prevents double-submits, repeated clicks while waiting, and accidental re-fires.
3. **Surface success or failure when the operation completes.** Spinner replaced by either the new state (good) or an error message (bad). Silent transitions count as failure UX even when the operation succeeded.
4. **Match the affordance to the wait shape.** Different shapes for different waits:
   - **Inline spinner inside the button** for fast actions (form submit, save, delete, single API mutation expected to complete in 1-3s)
   - **Skeleton placeholder** for page / panel loads (initial query, data refresh, navigation to a new screen)
   - **Toast / banner with progress** for long background work (uploads, bulk operations, exports)
   - **Disabled + busy cursor** for interactions that block other UI (modal dialog actions while saving)

## What counts as a fast / slow action

- **Fast (<1s)**: button-level spinner is enough; user keeps the same context. Examples: save settings, mark notification read, accept invite.
- **Medium (1-5s)**: button spinner + visible disabled state. The user might glance away — make sure they can't double-click or submit twice.
- **Slow (5-30s)**: dedicated loading section with progress info. AI calls (Claude / OpenAI), large data exports, search across many records. If the operation is interruptible, show a Cancel affordance.
- **Very slow (>30s)**: should be a background job with a status surface, not a synchronous UI wait. The UI shows a "queued / running" indicator and the user can navigate away.

## Concrete shapes

### Button-level spinner

Most apps already have a `LoadingButton` (or equivalent) component. Use it everywhere a button triggers an API call.

```tsx
<LoadingButton
  isLoading={isSubmitting}
  loadingText="Saving..."
  onClick={handleSave}
  disabled={isSubmitting || !formIsValid}
>
  Save changes
</LoadingButton>
```

The button's text changes during loading so the user sees what's happening. The button is disabled to prevent double-fires. The `disabled={... || !formIsValid}` pattern is also load-bearing — if the form is invalid, the user shouldn't be able to fire at all.

### Skeleton placeholder for page / panel loads

When a page first mounts or a panel re-fetches, show a skeleton that mirrors the loaded structure (same sections, same grid columns, same approximate element count). Plain "Loading..." text is forbidden — it produces a layout shift the moment data arrives, which is jarring.

```tsx
if (query.isLoading) return <ApplicationsListSkeleton />;
if (query.isError) return <ErrorPanel onRetry={query.refetch} />;
return <ApplicationsList items={query.data} />;
```

### Toast / banner for long background work

Long uploads, bulk imports, exports — surface a non-blocking toast that the work is in flight, and a follow-up toast or in-page status when it completes. The user should be able to keep using other parts of the app.

```tsx
showInfo("Generating export — we'll notify you when it's ready");
```

### Navigation that triggers AI calls

When navigating between AI-generated suggestions (e.g. resume refinement Prev/Next), the navigation itself should be instant if the data is cached. If a generation is required, show a clear loading affordance in the destination panel — the panel shouldn't appear "frozen" or "blank" while Claude composes a response.

The right shape is to **prefetch upfront** when feasible (one parallel batch on entry to the flow) so navigation is instant in both directions, and reserve the loading affordance for the rare cache-miss path. This is what MyJobHunter's `_prefetch_all_proposals` does on session start — see that pattern for any feature with N predictable AI calls.

## What this rule prevents

- **Double-fires**: user clicks, waits, doesn't see feedback, clicks again. Without loading state on the button, the second click also fires.
- **Confusion about whether the click registered**: the worst UX failure mode. The user can't tell if the app is broken, slow, or thinking.
- **Layout shift when data lands**: skeleton placeholders eliminate this. "Loading..." text plus a sudden table render is jarring.
- **Silent failures**: an API call that fails with no toast / banner / inline error leaves the user thinking the action succeeded when it didn't.

## Auto-capture trigger for this rule

Any time I add a new component that does:
- `useMutation` or `axios.post/patch/delete` from a button click
- `useQuery` or `axios.get` for a page-level load
- An action that can take more than a fraction of a second to complete

I MUST verify that the user-facing affordance shows feedback at click time, not just at result time. If I find I've added an API call without a loading state on the trigger, that's a bug to fix in the same commit, not a follow-up.

## Failure mode this prevents

On 2026-05-06, MyJobHunter's resume-refinement Prev/Next navigation called Anthropic on every click. The button visibly enabled showed no loading state. The user clicked, waited 2-5 seconds wondering if the app was broken, sometimes clicked again. The fix was twofold:

1. Backend: prefetch all proposals on session start so navigation is cache-served and instant
2. Behavioral: when generation IS required (e.g. "Another option"), the destination panel must show a clear "generating..." affordance

Without (2), even one cache-miss feels broken. Without (1), every nav feels broken. This rule formalizes that both halves are required.

## Relationship to other rules

- **`g-auto-capture.md`** — frontend stack guides (`stacks/react.md` etc.) should reference this rule.
- **`no-bandaid-solutions.md`** — "loading state isn't critical, ship without it" is exactly the bandaid this rule rejects. The cost of the spinner is one component prop; the cost of NOT having it accumulates per user, per session.
- Project CLAUDE.md files (e.g. MyBookkeeper's) already encode this as a project-level rule. This file lifts it to global so every project inherits it without re-derivation.
