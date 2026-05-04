# React Stack Guide

Apply these patterns when the project uses React. Detect React from `package.json` dependencies (`react`, `react-dom`).

## CRITICAL — Component Architecture

- One component per file — never define multiple components in the same file. This includes presentational helpers ("just two lines, only used once below") — split them. The cost of an extra file is ~zero; the cost of grep-hunting through multi-component files is real.
- Organize by feature/domain (`features/invoices/`), not by type (`components/buttons/`).
- Page components are thin orchestrators — they compose feature components, not contain business logic.
- Extract custom hooks for any reusable stateful logic — never duplicate state patterns across components.
- Each hook does one thing — no god-hooks managing multiple unrelated concerns.
- Keep forms, validation schemas, and default values in separate files from form UI components.
- Side effects live in hooks, not scattered through event handlers and render bodies.

## CRITICAL — Props Naming

- Always domain-prefix the props interface: `DocumentViewerHeaderProps`, `PaymentRowProps`, `ImageBodyProps`. Never name a props interface just `Props` — when two such interfaces are imported into the same file (or surface in IDE rename / type-search), they collide silently.
- Always export the props interface (`export interface FooProps`). Callers may need to reference the type without redeclaring; non-exported props turn into "anonymous shape duplicated at the call site" anti-pattern.
- The component's props interface is the one allowed exception to "one type per file" — it can be co-located with the component because it's tightly coupled and never reused independently. Any OTHER interface in a component file is a smell — split it out.

## CRITICAL — Conditional Rendering

- Reach for early returns + discriminated unions before reaching for nested ternaries. Nested ternaries in JSX are unreadable past 2 levels — every reader has to mentally evaluate the chain to figure out what actually renders.
- One ternary per JSX expression is fine. Two is suspicious. Three or more is almost always wrong — refactor.
- For complex multi-state rendering, the canonical pattern is: (a) a `useXxxMode` hook that returns a discriminated union (`'loading' | 'error' | 'empty' | 'pdf' | …`), (b) a single `switch` over the mode in the body component, (c) one subcomponent per state, each in its own file. The body becomes a flat dispatcher; state-specific markup is owned by the subcomponent that renders it.
- Acceptable compact ternary: a class-name toggle, a "value or fallback string" expression, a single boolean disclosure (`{open ? <Body /> : null}`).
- Unacceptable: chains like `cond1 ? <A /> : cond2 ? <B /> : cond3 ? <C /> : <D />`, nested ternaries inside JSX prop values, ternaries that change layout structure (different containers, different grid shapes).

## CRITICAL — Inline Type Shapes

- Whenever a `useState<{...}>`, callback parameter, or return value uses an anonymous object shape with 2+ named fields, extract it to a named interface in `shared/types/<domain>/<thing>.ts` and import.
- The anti-pattern: `const [viewing, setViewing] = useState<{ documentId: string; transactionId: string } | null>(null)`. The fix: `interface DocumentViewTarget` in `shared/types/document/document-view-target.ts`, then `useState<DocumentViewTarget | null>(null)`.
- Why: anonymous shapes can't be re-used, can't be referenced from other files, and the field set tends to drift between callers as fields are added. Named interfaces are documentation, single-source-of-truth, and refactor-safe.
- One named type per file. File name matches the type name in kebab-case.

## CRITICAL — Truthy / Null Checks

- `if (!blob)` over `if (blob === null)` when the type is `T | null` and `T` is always truthy (object, non-empty string, non-zero number). Same for `!error` when `error: string | null` (empty error string is not a valid value).
- Reserve explicit `=== null` / `!== null` for cases where the falsy check would over-match — e.g. distinguishing `null` from `""` (where empty string is a valid value), `null` from `0` (where zero is meaningful), or `null` from `undefined` (when they semantically differ — set vs. never-set).
- Same for `=== undefined`: only when undefined and null are semantically distinct.
- Never use `=== true` / `=== false` — `if (x)` and `if (!x)` are sufficient. Booleans are booleans.

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

## CRITICAL — Vite + Monorepo Workspaces

- When multiple `package.json` in the workspace declare React (as dep, devDep, or peerDep with hoisted local install), ALWAYS set `resolve.dedupe: ["react", "react-dom"]` in `vite.config.ts`. Without this, Vite resolves React from each package's local `node_modules` separately, producing two physically-distinct React copies in the bundle. Runtime crash: `Invalid hook call / Objects are not valid as a React child / Cannot access property 'useMemo', resolveDispatcher() is null`. The error points at component code; the actual cause is the bundler. Fix takes 30s; without it, hours of wrong-tree debugging.
- Avoid pinning a hard React version (`"react": "^19.2.5"`) in `devDependencies` of shared component packages. Use `peerDependencies` only — the consumer's React version wins. devDep React in a shared package gets installed into that package's local `node_modules` and conflicts with consumers running a different React major.

## CRITICAL — SPA Cache Headers

- Vite content-hashes asset filenames (e.g. `index-AbCd1234.js`, `assets/index-CfJ7F7lO.js`). Hashed assets are immutable by construction — cache aggressively: `Cache-Control: public, max-age=31536000, immutable`.
- Entry points (`index.html`, `sw.js`, `manifest.webmanifest`, `registerSW.js`) reference the latest hashed assets and MUST never be cached. Always set `Cache-Control: no-cache, no-store, must-revalidate` on them. Without this, browsers serve stale HTML pointing at deleted bundle hashes for hours/days after a deploy.
- Configure these at the reverse-proxy / CDN layer (Caddy, nginx, Cloudflare). Set them BEFORE the SPA goes live, not after the first staleness incident — the install-base of stuck browser caches can be very long-lived.

## HIGH — PWA / Service Workers

- Do NOT add `vite-plugin-pwa` (or any service-worker registration) to apps that aren't legitimately offline-first. Service workers precache the bundle and continue serving the precached version even after a deploy, producing "users stuck on stale code for weeks" outages with no visible fix path short of manual cache clear. The deployment-confidence cost (every deploy is suspect, debugging takes hours, users need explicit cleanup) far exceeds the rare offline / Add-to-Home-Screen benefit for online-first SaaS.
- If a SW is genuinely needed: enable `skipWaiting: true` + `clientsClaim: true` + `cleanupOutdatedCaches: true` in workbox config so new SWs activate immediately and don't accumulate dead precaches. Exclude HTML and the SW itself from precache (NetworkFirst for navigation, never precache `index.html`); cache only content-hashed assets.
- When removing a previously-shipped PWA, ship a "kill-switch" `public/sw.js` that calls `self.unregister()`, deletes all caches, and reloads any open clients. Browsers re-fetch `sw.js` on page load — they pick up the kill-switch automatically and self-clean. Without it, every existing user has to manually clear site data.

## HIGH — Deploy-pipeline Confidence

- After a UI fix that doesn't reach the user, suspect the deploy pipeline before suspecting the code. Verify in this order: (1) live HTTP response headers + content match expectations (curl from outside the VPS), (2) container filesystem matches the source tree (`docker compose exec ... cat /path/to/asset`), (3) only then re-read your code. Today's classes of staleness: docker named volumes that don't repopulate from new images, image-build cache that doesn't pick up new source, host-Caddy `file_server` pointing at a directory the build pipeline never updates, browser SW caching the old bundle.
- Add a post-deploy smoke check that fetches the live `index.html`, extracts the asset hash via `grep -oE 'src="/[^"]*index-[A-Za-z0-9_-]+\.js"'`, and asserts that exact file is reachable from the serving layer. If the live HTML and the build-output hash diverge, fail the deploy loudly instead of silently shipping a stale bundle.
- Don't ship a follow-up "fix" until you've verified the previous fix actually reached production. Cascading wrong fixes (each shipped after the previous one didn't work) is exactly how you accumulate three architecturally-broken layers in one outage.

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
