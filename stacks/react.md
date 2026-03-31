# React Stack Guide

Apply these patterns when the project uses React. Detect React from `package.json` dependencies (`react`, `react-dom`).

## CRITICAL — Component Architecture

- One component per file — never define multiple components in the same file.
- Organize by feature/domain (`features/invoices/`), not by type (`components/buttons/`).
- Page components are thin orchestrators — they compose feature components, not contain business logic.
- Extract custom hooks for any reusable stateful logic — never duplicate state patterns across components.
- Each hook does one thing — no god-hooks managing multiple unrelated concerns.
- Keep forms, validation schemas, and default values in separate files from form UI components.
- Side effects live in hooks, not scattered through event handlers and render bodies.

## CRITICAL — State Management

- Server/API state belongs in a data-fetching library (React Query, RTK Query, SWR, or similar) — never in local useState. Use whichever the project already has installed; if none, prefer React Query (TanStack Query).
- Shared UI state belongs in a state manager (Redux, Zustand, Jotai, or similar) — never prop-drilled or lifted to distant ancestors. Use whichever the project already has installed.
- Form state belongs in a form library (React Hook Form, Formik, or similar) — never in manual onChange/setState wiring. Use whichever the project already has installed; if none, prefer React Hook Form.
- URL state (filters, pagination, tabs) belongs in the URL via search params — not in component state.
- Ephemeral UI state (hover, open/closed) is the only thing that belongs in local useState.

## CRITICAL — Navigation State Planning

- For any page with sub-views, tabs, drilldowns, or multi-step flows: plan URL state, back button behavior, and deep-link support before implementing. Navigation is designed, not discovered after implementation.
- Every selectable view (tab, form, detail panel) must be represented in the URL — store active tab, selected item, and view mode in search params so browser back/forward works correctly and URLs are shareable.
- Plan the back button contract for every navigation depth: clicking back from a drilldown returns to the parent view (not the previous page in browser history). Test back button behavior explicitly in E2E tests.
- If a page has more than one level of navigation depth (e.g., list → detail → sub-detail), draw out the navigation stack before coding: which transitions push history entries and which replace them.

## CRITICAL — Eliminating Waterfalls

- Defer `await` until the point where the result is actually used, not at the top of the function.
- Parallelize independent async operations with `Promise.all()` — never await them sequentially.
- Start data fetching at the earliest possible moment; restructure component trees to enable parallel fetches.
- Use Suspense boundaries strategically to show wrapper UI while child data loads.

## CRITICAL — Bundle Size

- Never import from barrel files (e.g. `import { x } from 'lib'`) — import directly from the source file.
- Lazy-load heavy components with dynamic imports (`React.lazy` / `next/dynamic`).
- Load large data or modules conditionally, only when the feature is activated.
- Defer non-critical libraries (analytics, logging) until after initial render.
- Preload based on user intent (hover/focus) before the actual interaction.

## HIGH — Next.js Specific (skip if the project uses Vite/CRA/other SPA bundler)

- Authenticate Server Actions the same as API routes — verify auth inside each action, never rely on middleware alone.
- Use `React.cache()` for per-request deduplication of auth checks, DB queries, and expensive computations.
- Pass only the fields the client actually uses across RSC boundaries — minimize serialization payload.
- Hoist static I/O (fonts, images, config) to module level, not per-request.
- Schedule non-blocking work (logging, analytics) with `after()` so it runs after the response is sent.

## HIGH — Client-Side Data Fetching

- Use the project's data-fetching library for automatic request deduplication, caching, and revalidation.
- Add `{ passive: true }` to scroll and touch event listeners to eliminate scroll jank.
- Version localStorage keys (e.g. `v1_key`) and store only minimal fields; handle storage unavailability.

## HIGH — Date Handling

- Use a date library (date-fns, dayjs, or luxon) for parsing, formatting, and comparison — never use raw `new Date()`, `Date.parse()`, or `toLocaleDateString()`. Use whichever the project already has installed; if none, prefer date-fns (tree-shakeable, no mutable global state).

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
- Guard one-time app initialization with a module-level boolean to prevent duplicate init on remount.
