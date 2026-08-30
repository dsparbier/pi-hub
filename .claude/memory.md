# pi-hub — Memory

Evolving decisions, gotchas, and pending cross-project amendments for this repo. For the
stable architecture/conventions primer see `.claude/CLAUDE.md` (imports this file).

## Pending cross-project amendments

- **`~/projects/_fleet/fleet_ui/icons/index.js`** — request 9 Lucide glyphs be added to
  the vendored icon set so the agent views (and the "Host Metrics" / "Containers" nav
  items) can drop the local `src/fleet/extra-icons.jsx` carrier:
  `box cpu hard-drive terminal play square rotate-cw download trash`. Until then
  `extra-icons.jsx` merges them over the base `GLYPHS`; `src/fleet/icons.jsx` is untouched.
  The App.jsx nav currently uses base-set icons (`activity` / `monitor` / `panel-left`)
  for the three Monitor views since the Shell renders nav icons via `icons.jsx`, not
  `extra-icons.jsx`.

## Standing decisions

- **2026-08-29 — pi-hub grew its first backend: `pi-hub-agent`** (`agent/`, FastAPI).
  Plan 1 of `docs/PLAN-monitoring-consolidation.md`. Native host metrics + read-only
  container view; retires Beszel. Same compose project as `pi-hub`, **no published port**,
  reachable only via the console nginx `location /agent/`. Two bind mounts
  (`/var/run/docker.sock:ro`, `/:/host:ro`) — documented in `docs/AGENT.md` and compose
  comments; the fleet "no cross-project Docker networks" rule is **not** violated (same
  project, no network join). History was originally a bind-mounted SQLite file
  (`agent-data/metrics.db`), 48 h raw + 90 d hourly rollups — **migrated to SQL-Hub
  2026-08-29** (see below), so that detail is now historical.
  - The DEV-Hub auto-logging skip (CLAUDE.md "Ecosystem context") was predicated on
    "pi-hub has no backend". That premise is now false (the agent is a real FastAPI
    backend) — still not revisited; `.claude/CLAUDE.md`'s top-of-file "pure static
    frontend... no backend process" description is now stale and should be corrected
    next time that file is touched, not just here.
  - The fleet-wide SQL-Hub-default rule half of this note is **resolved** — see the
    2026-08-29 SQL-Hub migration entry below.
- **2026-08-29 — `pi-hub-agent` metrics storage migrated from local SQLite to SQL-Hub**
  (closes the fleet "default to SQL-Hub over a local/embedded DB" gap the entry above had
  flagged). `agent/db.py` gained `SqlHubDatabase` (talks to SQL-Hub's `/query/read` +
  `/query/write` via the new `agent/sql_hub_client.py`) and `open_database(cfg)`, which
  picks it whenever `SQL_HUB_URL` is set — which `docker-compose.yml` now always sets.
  Same schema, same table names, on `pi-hub-agent.db`. Zero changes needed to
  `collector.py`/`routes_*.py`/`tasks.py` — they only ever used `db.py`'s public
  `execute`/`query`/`get_meta`/etc. surface, which both backends implement identically.
  The plain local-sqlite `Database` class is **not removed** — it's now the test-only
  backend (`Database(":memory:")`, unchanged in `tests/conftest.py`; all 43 tests still
  pass untouched), the same pattern fin-hub calls `FLEET_TEST_SQLITE`.
  `wal_checkpoint()`/`incremental_vacuum()` are no-ops on the SQL-Hub backend (SQL-Hub
  owns that connection's lifecycle, not this agent); `size_bytes()` is best-effort via
  `PRAGMA page_count`/`page_size` through `/query/read`, falling back to `0` rather than
  erroring if SQL-Hub ever tightens its (currently unenforced, per its own
  `BUG-FIX-PLAN.md`) read-only validation. Required `extra_hosts:
  host.docker.internal:host-gateway` in `docker-compose.yml` — confirmed live on this WSL
  host that `host.docker.internal` does **not** resolve without it (not Docker Desktop's
  DNS). New `.env` keys `SQL_HUB_URL`/`SQL_HUB_API_KEY`/`SQL_HUB_DB_NAME`; the API key is
  a dedicated one created via SQL-Hub's `POST /admin/api-keys/create` (not its master
  key). `agent-data/` is retired (no longer mounted) but left in place — it still holds
  ~30 min of pre-migration `metrics.db*` from this agent's brief local-sqlite run; nothing
  reads it anymore, safe to delete whenever convenient. Verified live end-to-end: rebuilt,
  healthy, real `host_samples`/`container_samples` rows confirmed landing in SQL-Hub via
  direct query. Full detail: `docs/AGENT.md` §"Data storage".
- **nginx `/agent/` proxy** uses `set $agent_upstream …;` **before** `rewrite … break;`
  (the `break` flag halts later rewrite-phase directives, so a `set` after it silently
  yields an uninitialized variable → 500 "invalid URL prefix"). Variable upstream +
  `resolver 127.0.0.11` so the agent IP re-resolves after a restart.
- **2026-08-29 — Plan 2 shipped** (`docs/PLAN-container-management.md`): container
  lifecycle control (start/stop/restart/kill/remove/prune, all admin + audited), image
  management (list/df/pull/prune), a buffered task-progress system with WS replay
  (`agent/tasks.py`), the recreate flow (`agent/recreate.py` — rebuilds the create payload
  from live inspect, rename-old-for-rollback, guards for anonymous volumes / multi-network
  / compose-managed), and an interactive exec WS (`agent/routes_exec.py`, gated by
  `ENABLE_EXEC`, `MAX_EXEC_SESSIONS`, idle + max-duration timeouts, `EXEC_ALLOWED_CMDS`).
  Frontend: `xterm` added as a **lazy chunk** (`ExecTerminal.jsx` via `React.lazy` — base
  bundle unaffected, ~293 KB xterm chunk only loads on the Exec tab); `ImagePanel`,
  `AuditView`, `ActionButton`, `ConfirmDialog` (typed-name confirm), `TaskProgress`;
  `Containers.jsx` gained Containers/Images/Audit tabs. `useAgent.js` gained
  `useAdminActions`, `useTask`, `useExec`, `useImages`, `useAudit`, `useSystemDf`.
  **Portainer is NOT retired yet** — it stays in `src/config/fleet.js` for the parallel
  run; drop it at cutover (plan §5) once the Portainer parity checklist passes on the Pi.
  New npm deps: `@xterm/xterm`, `@xterm/addon-fit`.

## Pending — must be actioned outside this repo (plan §9)

- `getent group docker | cut -d: -f3` on **the Pi** and **the WSL dev box** → each host's
  `.env` as `DOCKER_GID=` (gitignored). Different value per host.
- Real `AGENT_READ_KEY` / `AGENT_ADMIN_KEY` (strong, random, distinct — not a fleet
  placeholder) in `/opt/docker/pi-hub/.env` (Pi) and the dev `.env`. Add both to the
  admin browser's `localStorage['fleet.console.keys']` as keys `pi-hub-agent` (read) and
  `pi-hub-agent-admin` (admin).
- ~~`mkdir -p agent-data && sudo chown 10001:10001 agent-data`~~ — **obsolete as of the
  2026-08-29 SQL-Hub migration** (above); `agent-data/` is no longer mounted, nothing
  needs its permissions fixed on a fresh deploy host anymore. What every deploy host
  *does* still need: a SQL-Hub API key for the agent (`POST /admin/api-keys/create` on
  the target SQL-Hub instance) and `SQL_HUB_URL`/`SQL_HUB_API_KEY`/`SQL_HUB_DB_NAME` in
  that host's `.env` — see `docs/AGENT.md` §"Deployment".
- NPM (`npm.pi-hub.local`): after the Beszel parity checklist passes, remove the
  `beszel.pi-hub.local` proxy host. Add **none** for the agent.
- `docker compose down` in `/opt/docker/beszel` (hub + `beszel-agent`, host port 45876);
  `mv /opt/docker/beszel /opt/docker/_retired/beszel-<date>`; archive `beszel_data/`;
  confirm host port 8091 freed.
- DEV-Hub project id 24 — one `/create-feature` for the agent (record via slash command,
  not from the repo).

### Plan 2 — additional out-of-repo actions (plan §5, gated on the Pi deployment)

- **Prerequisite for Plan 2 cutover**: `pi-hub-agent` deployed on the Pi and passing the
  Portainer parity checklist (list matches `docker ps`; start/stop/restart/kill/remove all
  work + audited; exec `/bin/sh` **and** `/bin/bash` with resize + exit code; image
  list/df/pull-with-progress; recreate tested 3 ways incl. a forced rollback; `docker
  inspect pi-hub-agent` confirms non-root + `group_add` + `no-new-privileges` + `cap_drop`
  + `read_only`).
- Then: `docker compose down` in `/opt/docker/portainer`; `mv` to `/opt/docker/_retired/`;
  remove the `portainer.pi-hub.local` NPM proxy host; confirm ports 9000/9443 freed; drop
  the `portainer` entry from `src/config/fleet.js`; one DEV-Hub `/create-feature`.
- Consider adding a CSP header to the console nginx (noted-not-done) — shrinks the XSS
  surface now that a browser holding the admin key can open a root-capable shell.

## Notes

- `agent/` has its own pytest suite (`cd agent && pip install -r requirements-dev.txt &&
  python -m pytest`). The main repo still has no JS test framework.
- On a host with a separate **rootless** Docker daemon beside the rootful one (this WSL
  box — the user's dev fleet runs on the rootless default context; `/var/run/docker.sock`
  is a separate rootful daemon, group `docker` gid 989), the agent container can't read
  the rootful `/var/run/docker.sock` regardless of `DOCKER_GID` (userns remap) — host
  metrics work, container endpoints 500. To test the full flow here: `docker compose build`
  (rootless — has DNS), `docker save … | docker -c default load`, then
  `docker -c default compose … up -d --no-build`. The Pi has a single rootful daemon so
  `group_add: [DOCKER_GID]` is the normal working path there.
- **Plan 2 was verified end-to-end against the rootful daemon on 2026-08-29** (== Pi
  model): all container/image/exec/recreate/prune flows work. 3 bugs were found + fixed in
  that pass — `restart()` kwarg (`timeout=` not `t=`), recreate payload `Hostname` vs
  `container:`/`host` network mode conflict (now stripped in `build_payload`), and
  `old_id` reporting the name not the id. See `docs/Project-Tracker.md` 2026-08-29 (3).
