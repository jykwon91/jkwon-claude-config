# Visible Loading Feedback

Any user action that triggers an API call (or async op >~200ms) MUST show visible feedback the moment the action fires — not when the response arrives. Without it, users wonder if their click registered and click again, compounding latency and often double-firing.

## The rule

When implementing any user-triggered async operation:

1. **Show a loading affordance the instant the action fires.** Not after the request resolves — at click time.
2. **Disable the action while it's in flight.** Prevents double-submits and re-fires.
3. **Surface success or failure when it completes.** Spinner → new state (good) or error (bad). Silent transitions count as failure UX.
4. **Match the affordance to the wait shape:**
   - **Inline spinner inside the button** for fast actions (form submit, save, delete, single mutation 1-3s)
   - **Skeleton placeholder** for page / panel loads (initial query, refresh, navigation)
   - **Toast / banner with progress** for long background work (uploads, bulk ops, exports)
   - **Disabled + busy cursor** for blocking interactions (modal actions while saving)

## Wait shapes

- **Fast (<1s)**: button-level spinner suffices.
- **Medium (1-5s)**: button spinner + visible disabled state.
- **Slow (5-30s)**: dedicated loading section with progress info. AI calls, exports, wide searches. If interruptible, show Cancel.
- **Very slow (>30s)**: background job with status surface, not synchronous UI wait. UI shows queued/running; user can navigate away.

## Concrete shapes

### Button-level spinner

Use `LoadingButton` (or equivalent) for any button that triggers an API call.

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

Text changes during loading. Button disabled to prevent double-fires. `disabled={... || !formIsValid}` prevents firing on invalid input.

### Skeleton placeholder for page / panel loads

Skeleton mirrors loaded structure (same sections, columns, approximate element count). Plain "Loading..." text is forbidden — it causes layout shift when data arrives.

```tsx
if (query.isLoading) return <ApplicationsListSkeleton />;
if (query.isError) return <ErrorPanel onRetry={query.refetch} />;
return <ApplicationsList items={query.data} />;
```

### Toast / banner for long background work

Surface a non-blocking toast that work is in flight, follow up when complete. User keeps using the app.

```tsx
showInfo("Generating export — we'll notify you when it's ready");
```

### Navigation that triggers AI calls

If data is cached, navigation should be instant. If a generation is required, show a clear loading affordance in the destination panel — it shouldn't appear "frozen" or "blank" while Claude composes.

**Prefetch upfront** when feasible (one parallel batch on flow entry) so navigation is instant in both directions; reserve loading affordance for the rare cache-miss path. See MyJobHunter's `_prefetch_all_proposals` for the pattern.

## Auto-capture trigger

Any new component that does `useMutation`, `axios.post/patch/delete` from a button, `useQuery`/`axios.get` for a page load, or any action that takes >a fraction of a second — verify feedback shows at click time, not just at result time. An API call without loading state on the trigger is a bug to fix in the same commit.
