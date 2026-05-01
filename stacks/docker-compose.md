# Docker Compose Stack Guide

Apply these patterns when the project uses docker-compose for local dev or production deploys. Detect from `docker-compose.yml` or `docker-compose.dev.yml` in the repo.

## CRITICAL — Don't Use Named Volumes for Build Artifacts

- Build artifacts (frontend dist, compiled assets, generated migrations) should be baked into the image at build time, never stored in a shared docker named volume that one container populates and another reads.
- Failure mode: image is rebuilt with new dist, new container starts, container's entrypoint copies new dist into the volume, OK so far. But on subsequent deploys where the image hash hasn't actually changed (e.g. only the Caddyfile changed, not the source), `docker compose up -d` doesn't recreate the container, so the entrypoint never runs, and the volume keeps old content. Even worse: `cp -r` overwrites same-named files but never deletes obsolete ones, so old hashed bundle files accumulate in the volume forever.
- This bug class produces "users stuck on a months-old frontend bundle" outages where every layer of the deploy looks healthy and the image has the right code, but the live site serves stale artifacts. It is hard to debug because curl from the VPS host returns the OLD bundle (from the volume) while the new image's `/app/frontend-dist` has the fresh one.
- Fix: use a multi-stage Dockerfile that builds the artifact and `COPY --from=build` it into the runtime image. The serving container's filesystem becomes the source of truth, atomic with each image release.

## CRITICAL — Recreate-on-deploy

- `docker compose up -d --remove-orphans` only recreates containers whose image hash actually changed. If your build cache reuses a layer, the running container is untouched and any per-startup logic (entrypoint scripts, volume populate, env-var refresh) doesn't run.
- For deploys that MUST refresh the running container regardless of image hash, add explicit `docker compose up -d --force-recreate <service>` or `docker compose restart <service>` in the deploy pipeline.

## HIGH — Post-deploy Smoke Tests

- Don't trust `docker compose up -d` exit code as proof the deploy worked. Add explicit verification:
  - HTTP probe: `curl -fsS https://<domain>/api/health` returns 200 with expected body.
  - Bundle freshness: extract the asset hash from the live `index.html`, verify the file exists in the serving container at the expected path. Fails the deploy if they diverge (catches volume staleness immediately).
  - Database state: `alembic current` matches the head revision in the repo (catches partial migrations).
- A 30-line smoke check at the end of the deploy script catches the class of bug where the deploy "succeeded" but production is broken.

## HIGH — Cleanup Orphaned Volumes

- Named volumes (`my_app_frontend_dist`, etc.) survive `docker compose down`. After refactoring an architecture that no longer needs a volume, run `docker volume rm <name>` to clean up — orphaned volumes silently consume disk and can cause confusion when an old reference is rediscovered.
- Add the `docker volume rm ... 2>/dev/null || true` cleanup to the deploy script as a one-shot. It's a no-op once the volume is gone; harmless to leave in place.

## MEDIUM — Healthcheck-Backed Dependencies

- `depends_on: { condition: service_healthy }` works only if the dependency has an explicit `healthcheck` defined. Without it, `service_started` is the default — and "started" doesn't mean "ready to serve". Postgres + MinIO + custom services should always have a healthcheck so dependent services don't race the readiness window.

## MEDIUM — Local-only Ports

- Bind container ports to `127.0.0.1:<port>:<port>` not `:<port>:<port>` for any service that has a public-facing reverse proxy in front of it. The proxy reaches it via the bridge network; the rest of the world has no business hitting the raw container port. Tightens attack surface and prevents accidental "I forgot the firewall rule" exposure.

## MEDIUM — Image Layer Strategy for Monorepos

- When the build context is the monorepo root (so the image can pull in a shared package), put the most-frequently-changed sources LAST in the Dockerfile. Order: shared deps → app deps → shared source → app source. A change in the app's source only invalidates the final layer; the shared package layer stays cached.
