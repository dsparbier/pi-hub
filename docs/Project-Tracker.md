# Pi-Hub Project Tracker

## Current Version
1.8.0

## Overview
Pi-Hub is a self-hosted front-end portal for a Raspberry Pi device (React 18 + Vite 5, CSS Modules, no UI library), served via a Docker multi-stage build (Nginx). As of 1.6.0 the compose project also runs a small FastAPI sidecar, `pi-hub-agent` (`agent/`), for native host metrics + a read-only container view — see [AGENT.md](./AGENT.md). See [UI_MANIFEST.md](./UI_MANIFEST.md) for the full design spec.

## Session Log

### 2026-09-15 — [Rollout] Decision: pi-hub-agent gets Central Logs streaming only, not the full stack

Closes the fleet-wide logging audit's pi-hub task (`~/projects/_fleet/FLEET-LOGGING-STANDARD.md`
§5). **Decision, documented in `agent/dev_hub_stream.py`'s docstring**: pi-hub-agent does *not*
get the full in-app logging treatment (file logging + rotation + retention + a `View Logs`/
`Log Configuration`/`Log Streaming` viewer UI) the FastAPI hub apps get. Reasoning: it's a
low-volume sidecar (`logging.basicConfig` console-only today, captured fine by `docker logs`),
and this repo's own React frontend already ships a broader, more valuable capability for the
*fleet's* logs — `LogViewer.jsx`/`LogStream.jsx` stream host + every container's logs, a
superset of "one app's own file," not a mechanism this would compete with or need to duplicate.

What *is* worth the small added cost, and was built: mirroring the agent's own WARNING+ lines
into DEV-Hub's Central Logs (new `agent/dev_hub_stream.py`, ported from the fleet's asyncio
reference implementation, using `aiohttp` rather than `httpx` to avoid a second HTTP client
dependency — this repo already pins `aiohttp` for `sql_hub_client.py`), so an agent-side
problem is visible fleet-wide instead of requiring `docker logs pi-hub-agent` specifically.
New `GET /api/logs/streaming/status` (`routes_host.py`, same `require_read` auth as the rest of
that router). Enable is env-var-only (`DEV_HUB_LOG_STREAMING_ENABLED`/`DEV_HUB_URL`/
`DEV_HUB_API_KEY` — pi-hub-agent has no fleet_config integration to hang a live setting off).
Added `websockets` to `requirements.txt`.

**Not live-verified** — unlike every other rollout in this same audit, pi-hub wasn't part of
this session's locally-running fleet, so this is syntax-checked only (`ast.parse` clean), not
confirmed against a real DEV-Hub connection. Verify `GET /api/logs/streaming/status` reports
`connected:true` the next time pi-hub-agent is actually run with streaming enabled.

### 2026-08-29 (4) — `pi-hub-agent` metrics storage migrated to SQL-Hub
Closes the fleet-wide "default to SQL-Hub over a local/embedded DB" gap for this repo's one
backend (`~/projects/CLAUDE.md` "Application Fleet Architecture"; flagged as outstanding in
the 2026-08-29 (2)/(3) entries below, since Plan 1/2 had shipped with local SQLite).
- **Backend** (`agent/`): new `agent/sql_hub_client.py` — minimal async REST client for
  SQL-Hub's `/query/read` + `/query/write` (retries with backoff, idempotent
  `/databases/create` on connect). `agent/db.py` gained `SqlHubDatabase` (same public
  surface as the existing `Database`: `execute`/`query`/`query_one`/`scalar`/`get_meta`/
  `set_meta`/`ok`/`size_bytes`/`wal_checkpoint`/`incremental_vacuum`) and `open_database(cfg)`,
  which picks SQL-Hub whenever `SQL_HUB_URL` is set. `config.py` gained
  `sql_hub_url`/`sql_hub_api_key`/`sql_hub_db_name`; `app.py`/`deps.py` updated to call
  `open_database()` and type against `Database | SqlHubDatabase`. Zero changes needed in
  `collector.py`/`routes_*.py`/`tasks.py` — they only ever used `db.py`'s public surface.
  The local-sqlite `Database` class is unchanged and now serves as the test-only backend
  (`Database(":memory:")`, `tests/conftest.py`) — same pattern as fin-hub's
  `FLEET_TEST_SQLITE`. `wal_checkpoint()`/`incremental_vacuum()` are no-ops on the SQL-Hub
  backend (SQL-Hub owns that connection's lifecycle); `size_bytes()` is best-effort via
  `PRAGMA page_count`/`page_size` through `/query/read`, falling back to `0`.
- **Deployment**: `docker-compose.yml` sets `SQL_HUB_URL`/`SQL_HUB_API_KEY`/`SQL_HUB_DB_NAME`
  and drops the `./agent-data:/data` bind mount; gained
  `extra_hosts: host.docker.internal:host-gateway` (required on this engine — confirmed
  `host.docker.internal` does not resolve here without it). `.env.example` documents the
  three new keys (API key should be a dedicated one via SQL-Hub's
  `POST /admin/api-keys/create`, not its master key).
- **Docs**: `docs/AGENT.md` gained a "Data storage" section; its Deployment section's
  `agent-data/` chown step is replaced with the SQL-Hub key/env setup.
- **Verified**: all 43 agent tests pass unchanged; live end-to-end against a running
  SQL-Hub instance — rebuilt, healthy, real `host_samples`/`container_samples` rows
  confirmed landing in SQL-Hub via direct query.
- Tracked in DEV-Hub as feature id 205 (`pi-hub-agent metrics storage migrated to SQL-Hub`,
  status `done`).

### 2026-08-29 (3) — Plan 2: native container management, retire Portainer (`docs/PLAN-container-management.md`)
- **Backend** (`agent/`): `docker_client.py` extended with control / image / exec calls
  (its lifecycle method renamed `start()` → `connect()` to free the name for the container
  action). New modules: `audit.py` (`AuditSpan` context manager + `redact_env` — Env stored
  as key names only), `tasks.py` (in-memory task registry, per-task frame buffer, WS replay
  on connect, TTL GC), `recreate.py` (`analyse` guards + `build_payload` from live inspect +
  `run_recreate` with rename-for-rollback), `routes_containers_ctl.py`, `routes_images.py`,
  `routes_tasks.py` (`WS /api/tasks/{id}`), `routes_exec.py` (`WS /api/containers/{id}/exec`,
  only mounted when `ENABLE_EXEC`; idle + max-duration timeouts, `MAX_EXEC_SESSIONS`,
  `EXEC_ALLOWED_CMDS`). `config.py` gained the exec knobs; `app.py` registers the Plan 2
  routers + a `TaskManager` on `app.state`. Tests: 41 total (17 new — recreate payload
  reconstruction from a captured inspect fixture, control-endpoint auth 401/403 + audit
  rows, admin task/exec WS first-frame auth, disallowed-cmd rejection, image list/df/prune).
- **Frontend** (`src/fleet/agent/`): `ExecTerminal.jsx` (`@xterm/xterm` + `@xterm/addon-fit`
  — **new deps**, `React.lazy` chunk so the base bundle is unchanged: xterm lands in a
  ~293 KB `ExecTerminal-*.js` that only loads on the Exec tab). `ImagePanel.jsx`,
  `AuditView.jsx`, `ActionButton.jsx`, `ConfirmDialog.jsx` (typed-name confirm for
  remove / recreate), `TaskProgress.jsx`. `Containers.jsx` now has Containers / Images /
  Audit tabs; `ContainerDetail.jsx` gained the action row + an Exec tab. `useAgent.js`
  extended with `useAdminActions` (`runAction` / `pullImage` / `pruneImages` /
  `pruneContainers`), `useTask`, `useExec`, `useImages`, `useAudit`, `useSystemDf`; the
  `wsConnect` return grew a `send()`.
- **Verified (unit + nginx)**: 43 agent tests pass; frontend build clean with the xterm
  code split out; through nginx — Plan 2 auth tiers (no-key 401 / read 403 / admin
  proceeds), image pull returns `202 {task_id}` and the task WS **replays buffered frames**
  to a late subscriber, task + exec WS reject the read key (4401), exec WS rejects a
  disallowed `cmd` (4403); `ENABLE_EXEC=false` removes only the exec route.
- **Verified (full end-to-end against a rootful daemon == the Pi model)**: built on the
  dev box's rootless daemon, `docker save | docker -c default load`, ran the stack on the
  rootful daemon (`group_add: [989]`, `uid 10001`) → `docker.ok:true`. Exercised
  list/inspect, logs (one-shot + follow), stats (one-shot + stream with rates),
  start/stop/restart/kill, images list/df, `image.pull` with **live layer progress** over
  the task WS, `containers/prune` + `images/prune`, **recreate** (happy path with
  rename-old-for-rollback; a forced-failure → rollback + `result:rolled_back` audit;
  compose-managed → **blocked without `force`**, proceeds with `force` + advisory
  warning), **exec** `/bin/sh` and `/bin/bash` (TTY, resize, exit code 3 propagated),
  `MAX_EXEC_SESSIONS=3` cap + slot drain, and a complete audit trail with `params`
  redacted (0 Env value leaks).
- **3 bugs found + fixed during E2E**: (1) `container.restart` — aiodocker's `restart()`
  takes `timeout=`, not `**kwargs` like `stop()`/`kill()` (was `TypeError`, now audited
  `ok`); (2) recreate payload — `inspect` is not a clean round-trip: a `Hostname` in the
  create body conflicts with `container:`/`host`/`none` network modes ("conflicting
  options: hostname and the network mode"), so `build_payload` now strips
  `Hostname`/`Domainname`/`MacAddress`/`ExposedPorts`/`PortBindings` for those modes;
  (3) `old_id` in the recreate result was the passed name, now the real container id.
  Also aligned the inspect endpoint's `recreate_warnings` to run the same
  `recreate.analyse()` the flow uses (was a misleading "not compose-managed" note).
- **Not done here** (plan §5): Portainer stays in `src/config/fleet.js` for the parallel
  run and is dropped at cutover once the Portainer parity checklist passes on the Pi;
  the `_retired/` move, the NPM route removal, and the DEV-Hub `/create-feature` are
  recorded in `.claude/memory.md`.
- Version bumped `1.6.0 → 1.7.0` (`package.json` + `src/version.js`).

### 2026-08-29 (2) — Plan 1: native monitoring, retire Beszel (`docs/PLAN-monitoring-consolidation.md`)
- **New backend service `pi-hub-agent`** (`agent/`, FastAPI + uvicorn on
  `python:3.12-slim-bookworm`; `aiodocker`, `psutil`, stdlib `sqlite3`). First backend in
  this repo. Modules: `app` (lifespan + routers), `auth` (two-tier `X-API-Key` +
  WebSocket first-frame handshake, close 4401), `config`, `db` (single-writer executor,
  WAL, full schema incl. `audit_log`), `host_metrics` (psutil + `/host` visibility
  handling, per-metric `source` tag), `container_metrics` (stats-frame math),
  `docker_client` (aiodocker wrapper + low-level Engine API), `collector` (15 s host /
  30 s container samplers + 30 min retention/rollup: 48 h raw + 90 d hourly AVG/MAX),
  `downsample`, `routes_host` / `routes_containers_ro` / `routes_health`. 24 pytest tests
  (`agent/tests/`, `requirements-dev.txt`).
- **Deployment wiring**: `docker-compose.yml` gains the `pi-hub-agent` service — no
  published port, `/var/run/docker.sock:ro` + `/:/host:ro` bind mounts (documented, the
  one deviation from HTTP-over-published-port), `group_add: [DOCKER_GID]`, `user 10001`,
  `read_only` + `cap_drop: ALL` + `no-new-privileges`, healthcheck. New
  `docker-compose.dev.yml` (loopback `31107:8080` for curl); `docker-compose.pi.yml` and
  `.gitignore` updated; `.env.example` added. `nginx.conf` gains `location /agent/`
  (variable upstream + Docker `resolver`, WS upgrade headers, `set` before
  `rewrite … break`). `docs/AGENT.md` created.
- **Frontend**: `src/App.jsx` now switches between three top-level views (`console` /
  `metrics` / `containers`) instead of scroll-anchor only — the metrics/containers views
  hold live WebSockets that must unmount when hidden. New: `src/fleet/useAgent.js`
  (agentFetch / wsConnect / polling hooks / stream helpers — `useFleetHealth.js`
  untouched), `src/fleet/extra-icons.jsx` (9 extra Lucide glyphs, merged over the base
  set), `src/fleet/agent/` (charts, gauges, HostMetrics, Containers, ContainerDetail,
  LogStream, StatsSparklines, `agent.module.css`). `src/config/fleet.js` gains the
  `AGENT` export + a `pi-hub-agent` infrastructure service; the `beszel` entry stays for
  the parallel run and is dropped at cutover (plan §8) once the parity checklist passes.
- **Verified**: agent unit tests pass; full stack (`docker compose … up`) builds; through
  nginx — `/agent/health` 200, host metrics current/range/info/collector-status all
  correct (temp degrades to `source:"unavailable"` on the WSL box, as designed), auth
  tiers 401/403, WebSocket auth handshake (4401 on bad key, streams on valid). Container
  endpoints could not be exercised end-to-end on the dev box (separate rootless daemon
  can't read the rootful `docker.sock`) — covered by unit tests with a fake Docker; will
  work on the Pi's single rootful daemon.
- **Not done here** (plan §9, recorded in `.claude/memory.md`): per-host `DOCKER_GID`,
  real API keys + browser `fleet.console.keys`, `chown 10001 agent-data` on deploy hosts,
  removing the `beszel.pi-hub.local` NPM route, the physical `_retired/` move of Beszel,
  and the DEV-Hub `/create-feature`. Beszel stays up until the parity checklist (plan §8)
  passes.
- Version bumped `1.5.11 → 1.6.0` (`package.json` + `src/version.js`) — first backend
  service, minor-worthy.

### 2026-08-08
- Fleet-wide docker-compose networking audit (`/align-docker-conf across all projects`, all ~12
  hub projects, not pi-hub-specific): this repo's own `docker-compose.yml` was already
  self-contained (single service, no cross-project network) — the only addition here was DNS/IPv4
  hardening: pinned `dns: [192.168.68.115, 192.168.68.57, 1.1.1.1]` (Pi-Hub's AdGuard/NGINX
  resolver, WiFi + eth0, then public fallback) and `sysctls: net.ipv6.conf.all.disable_ipv6=1`
  (IPv6 was causing local connectivity issues). Elsewhere in the same audit, removed the dangling
  `pi-hub-network` external network reference from sql-hub's compose file (nothing in this repo
  ever created it) and a similar `dev-hub_default` reference from invest-hub's. No app code
  changed here; `package.json`/`src/version.js` bumped to 1.5.10 (patch) to keep the version-sync
  convention this project already follows. Logged and resolved as DEV-Hub bug #187.

### 2026-07-16
- Added `docs/BUG-FIX-PLAN.md`: a risk-ordered remediation plan covering every currently-open
  DEV-Hub bug/enhancement/feature for this project (15 bugs, 6 enhancements, 4 features), each
  with root cause, concrete fix approach grounded in current code, files touched, and a
  verification step, grouped into three phases (critical, functional correctness, hardening &
  cleanup) for a future Claude Code session to execute. Produced from a full-codebase audit; no
  app code changed and no DEV-Hub statuses touched — each item gets flipped to done via
  `/update-bug`/`/update-enhancement`/`/update-feature` as it's completed. No version bump
  (docs-only).

### 2026-07-12
- Migrated bug/feature/enhancement tracking to DEV-Hub per `docs/dev-hub-sync.md`. Created the
  `pi-hub` project in DEV-Hub (id 24), migrated the 3 resolved bugs from `Bugs-Tracker.md` (ids
  89–91, all `status: resolved`) and the 9 done features from `Features-Tracker.md` (ids 116–124,
  all `status: done`, `phase-1`). No enhancements migrated — the "Next Planned Features" backlog
  was empty. `docs/Bugs-Tracker.md` and `docs/Features-Tracker.md` now carry a migration notice at
  the top; their original content is kept below as an archived snapshot. Evaluated
  `docs/READ-ME.dev-hub-logging.md` (Auto-Logging + "Report to DEV-Hub" menu) but skipped it per
  user decision — pi-hub is a pure static frontend (React/Vite, nginx-served, no backend process,
  settings in `localStorage`), so the doc's assumed Python backend/routers/log-watching don't have
  anywhere to attach without a larger architecture change; revisit if pi-hub ever grows a backend
  service. Version bumped to 1.5.9 (docs-only change, no app code touched).

### 2026-07-11 (2)
- Versioned the `.claude/commands/` slash-command definitions (`clean-project.md`, `commit-code.md`) that had been left untracked by the prior session — the user asked for these to be committed manually.

### 2026-07-11
- Ran `/clean-project`: reviewed folder structure (no drift found, nothing to move or purge), added `.vscode/` and `*.code-workspace` to `.gitignore` since those files hold personal Peacock/editor color settings rather than shared project config.
- Fixed a version-string desync: `package.json` had been left at `1.5.5` since the `v1.5.6` commit while `src/version.js` was bumped; both are now synced and bumped to `1.5.7`.
- Picked up an in-progress `docker-compose.yml` change (pending from before this session): container port mapping changed from `3030:80` to `0.0.0.0:31106:80` (and the commented-out dev override updated to match), binding explicitly to all interfaces on the new host port.
- Created `Project-Tracker.md`, `Features-Tracker.md`, and `Bugs-Tracker.md` (none existed previously) to track ongoing work going forward.

### Prior history (reconstructed from git log, pre-dates this tracker)
- `v1.5.6` — Fixed configuration retention bug in `App.jsx`.
- `v1.5.5` — Version bump.
- `d4e8fdd` — Service-specific links with tabbed console view.
- `v1.5.0` — Chore version bump.
- `dc14dd0` — Dashboard modernization: compact cards and widget management.
- `v1.0.0` — Stable release.
- Port changed from 3000 to 3030 (chore).
- `v0.1.0` — Initial versioned bump.
- UI/UX manifest added for AI-agent replication.
- Sidebar drag-and-drop reordering, fixed reorder-after-drop bug.
- Service detail simplified to health panel only.
- Console fills viewport; health panel spans full grid width.
- Group management in Edit Layout, extra URLs, "Open in Browser".
- Dynamic sidebar groups, Pi-Hub logger, service health panels (initial feature set).
