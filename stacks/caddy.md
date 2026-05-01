# Caddy Stack Guide

Apply these patterns when the project uses Caddy as a reverse proxy or static-file server. Detect from `Caddyfile`, `Caddyfile.docker`, or `caddy.Dockerfile` in the repo.

## CRITICAL — Single Source of Truth for Routing

- For two-tier setups (host Caddy + container Caddy), exactly ONE tier owns routing, security headers, and CSP. The other tier is a thin TLS terminator that proxies to the first. Don't have both layers each adding `X-Frame-Options` / `Content-Security-Policy` / cache headers — they drift, confuse debugging, and double-send headers (visible as `Via: 1.1 Caddy` appearing twice).
- The container Caddy (in source control, deploys atomically with the app) is usually the right place for app-aware routing. The host Caddy should be `reverse_proxy <container>:port` plus minimal TLS-edge headers (HSTS, nosniff, Referrer-Policy).
- Don't mix `uri strip_prefix /api` between layers. Decide which Caddy strips it. Two layers stripping the same prefix means the inner Caddy never sees `/api/*` and falls through to the SPA handler, returning HTML for API requests (frontend gets HTML where it expects JSON, browser shows `t.payload.some is not a function` or similar parse errors).

## CRITICAL — Don't `file_server` from a Stale Directory

- If the Caddyfile says `root * /srv/myapp/frontend/dist`, that directory must be updated by the deploy pipeline on every release. A `file_server` reading from a directory only ever populated by a one-off manual build will serve months-old code as production traffic, indefinitely.
- For docker-compose deployments, prefer baking the SPA dist into a custom Caddy image (multi-stage Dockerfile: `FROM node AS frontend-build` → `FROM caddy:2-alpine; COPY --from=frontend-build /build/dist /srv/frontend`) over using a shared docker named volume. Volumes persist across image rebuilds and can drift; baked-in dist + new image = atomic refresh.

## CRITICAL — Headers Scoping

- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` are designed to protect the HTML document from being framed. Apply them ONLY to SPA HTML responses, not to JSON / binary API responses. When a SPA fetches a binary via `axios { responseType: 'blob' }` and renders the resulting `blob:` URL inside an in-app `<iframe>`, modern Chromium enforces the framing restrictions of the origin Response on the blob load — even though "Open in new tab" with the same blob URL works fine. Symptom: in-panel iframe shows "This content is blocked. Contact the site owner to fix the issue." while the bytes are correct and reachable.
- Scope structure: top-level `header { defer ... }` block keeps HSTS + nosniff + Referrer-Policy + Permissions-Policy (those are useful on every response). Per-handler `header { ... }` inside the SPA `handle { ... }` adds XFO + CSP `frame-ancestors`. The `/api/*` handler stays bare.

## HIGH — Cache-Control on a SPA

- Always set explicit `Cache-Control` headers; default Caddy `file_server` sets none, which leaves browser cache up to heuristics (= bad for SPA correctness).
- HTML and the service worker / manifest must be `no-cache, no-store, must-revalidate`. They are the entry points and reference the latest content-hashed assets.
- Content-hashed assets (`assets/*.js`, `assets/*.css`, `*.woff2` whose filename includes a hash like `index-AbCd1234.js`) should be `public, max-age=31536000, immutable`. The hash changes when content changes, so caching forever is safe and saves user-visible bandwidth.
- Match by path pattern: `path /index.html /sw.js /workbox-*.js /manifest.webmanifest /registerSW.js` for no-cache; `path_regexp \.[A-Za-z0-9_-]{8,}\.(js|css|woff2)$` for immutable.

## HIGH — Process Management

- Don't run Caddy as ad-hoc background processes (`caddy run --config ... &`). Use systemd (`systemctl enable --now caddy`) so the process restarts on reboot, has structured logs (`journalctl -u caddy`), and can be reloaded via `systemctl reload caddy`. Ad-hoc background instances accumulate (you'll find two or three running off old config files months later) and can't be reloaded cleanly.
- File path matters: the systemd unit reads from `/etc/caddy/Caddyfile`. Watch for typo'd filenames (`Caddfile` without the `y`) — `caddy run` won't error if pointed at the wrong file, it'll just keep serving the previous in-memory config.

## HIGH — Always Verify After Reload

- After `caddy reload`, immediately verify the change took effect via curl:
  ```bash
  curl -sSI https://<domain>/api/health | grep -iE 'x-frame|cache-control|content-type'
  ```
  Don't assume the reload picked up the new file. The Caddy admin API can fail silently if no instance is listening on `:2019`, and ad-hoc instances may not share a config namespace.

## MEDIUM — Auto-deploy the host Caddyfile

- If the host Caddyfile lives at `/etc/caddy/Caddyfile` on the VPS but is also tracked in `apps/<app>/deploy/Caddyfile` in the repo, add a step to the deploy workflow that diffs them and `sudo cp` + `sudo caddy reload` if they've drifted. Without this, every Caddyfile change in the repo requires a manual VPS step that gets skipped 90% of the time and silently produces stale config.
