---
description: React best practices — auto-loaded when working with React files
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# React Best Practices

Apply these rules when writing or reviewing React code, prioritized by impact.

## CRITICAL — Eliminating Waterfalls

- Defer `await` until the point where the result is actually used, not at the top of the function.
- Parallelize independent async operations with `Promise.all()` — never await them sequentially.
- Start data fetching at the earliest possible moment; restructure component trees to enable parallel fetches.
- Use Suspense boundaries strategically to show wrapper UI while child data loads.

## CRITICAL — Bundle Size

- Never import from barrel files (e.g. `import { x } from 'lib'`) — import directly from the source file.
- Lazy-load heavy components with dynamic imports (`React.lazy` / `next/dynamic`).
- Load large data or modules conditionally, only when the feature is activated.
- Defer non-critical libraries (analytics, logging) until after hydration.
- Preload based on user intent (hover/focus) before the actual interaction.

## HIGH — Server-Side Performance

- Authenticate Server Actions the same as API routes — verify auth inside each action, never rely on middleware alone.
- Use `React.cache()` for per-request deduplication of auth checks, DB queries, and expensive computations.
- Pass only the fields the client actually uses across RSC boundaries — minimize serialization payload.
- Hoist static I/O (fonts, images, config) to module level, not per-request.
- Schedule non-blocking work (logging, analytics) with `after()` so it runs after the response is sent.

## MEDIUM-HIGH — Client-Side Data Fetching

- Use SWR for automatic request deduplication, caching, and revalidation across component instances.
- Add `{ passive: true }` to scroll and touch event listeners to eliminate scroll jank.
- Version localStorage keys (e.g. `v1_key`) and store only minimal fields; handle storage unavailability.

## MEDIUM — Re-render Optimization

- Derive computed values during render — don't store them in state or sync them via effects.
- Don't define components inside other components — causes full remount and state loss; pass props instead.
- Extract default values (objects, arrays) to module-level constants to prevent broken memoization.
- Use functional `setState(prev => ...)` updates to prevent stale closures and enable stable callbacks.
- Use `useRef` for values that change frequently but don't need to trigger re-renders.
- Use `startTransition` for non-urgent updates (e.g. scroll tracking) to keep the UI responsive.
- Narrow `useEffect` dependencies to primitives, not objects.
- Put user interaction logic in event handlers, not `state + effect` combinations.
- Pass a function to `useState()` for expensive initializers (lazy initialization).
- Avoid `useMemo` for simple primitives — the hook overhead exceeds the cost.

## MEDIUM — Rendering Performance

- Use ternary (`? :`) for conditional rendering — never `&&` with values that could be `0` or `NaN`.
- Use `useTransition` instead of manual loading state — gives `isPending` and automatic error resilience.
- Apply `content-visibility: auto` to long lists or off-screen sections to defer rendering.
- Hoist static JSX outside components to avoid recreation on every render.
- Use the `Activity` component to preserve state/DOM for components that frequently toggle visibility.
- Wrap SVG elements in a `div` for hardware-accelerated CSS transforms.

## LOW-MEDIUM — JavaScript Performance

- Build index Maps (`new Map`) for repeated `.find()` calls — O(1) vs O(n).
- Use `Set` for repeated membership checks — O(1) vs O(n).
- Use `flatMap()` to map and filter in one pass instead of chaining `.filter().map()`.
- Use `.toSorted()` instead of `.sort()` to preserve immutability and prevent prop/state mutation bugs.
- Hoist `RegExp` literals to module level — don't recreate them inside render.
- Batch DOM reads before writes to prevent layout thrashing.
- Cache `localStorage`/`sessionStorage` calls in memory — they're synchronous and blocking.

## LOW — Advanced Patterns

- Store event handler callbacks in refs when passed to subscriptions — avoids re-subscribing on every render.
- Use `useEffectEvent` to access latest values in callbacks without adding them to dependency arrays.
- Guard one-time app initialization with a module-level boolean to prevent duplicate init on remount.
