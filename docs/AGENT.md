# pi-hub-agent

A small **FastAPI sidecar** added to this repo's compose project (Plan 1 of
`docs/PLAN-monitoring-consolidation.md`). It gives the console native host metrics and a
read-only container view so **Beszel can be retired**. Container *control* (retiring
Portainer) is Plan 2 (`docs/PLAN-container-management.md`) and builds on everything here.

Source: `agent/`. Served to the browser only through the console's nginx at `/agent/…`
— the container publishes no port.

---

## What it does

| Area | Detail |
|---|---|
| Host metrics | `psutil` over a read-only host mount — CPU, per-core, load, mem, swap, disk usage + IO, network throughput (parsed from `/host/proc/net/dev`), CPU temp, uptime. Sampled every 15 s. |
| Container metrics | Docker Engine API (`/containers/{id}/stats`) — CPU %, mem, net, blkio, PIDs per running container, every 30 s. |
| History | **SQL-Hub** (`pi-hub-agent.db`, fleet-wide default — see `~/projects/CLAUDE.md` and "Data storage" below), not a local file. 48 h of raw samples + 90 d of hourly rollups (AVG + MAX). Retention/rollup task every 30 min. |
| Logs / live stats | Per-container WebSocket log follow and stats stream. |
| Auth | Two static keys via `X-API-Key`: **read** (metrics + read-only containers) and **admin** (container control — Plan 2). Constant-time compare. |

If a psutil source is not visible in-container (e.g. no thermal sensor, or the `/host`
mount is missing) the metric is tagged `source:"unavailable"` and the UI shows
"unavailable" rather than a wrong container-scoped number.

---

## The two bind mounts (the one deviation from "HTTP-over-published-port only")

The fleet rule is *no cross-project Docker networks* and *cross-service calls over
published HTTP ports*. `pi-hub-agent` complies on networking — it is in the **same**
compose project as `pi-hub` and shares only that project's own default network, with no
published port. The deviation is two **bind mounts**, the irreducible cost of replacing
Beszel + Portainer:

| Mount | Why | Mitigation |
|---|---|---|
| `/var/run/docker.sock:ro` | list / inspect / stats / logs containers | `:ro` is **cosmetic** — the full Engine API is still reachable over the socket. The **admin API key is the real write boundary** (all control endpoints are admin-tier, Plan 2). Agent runs non-root (`uid 10001`), `cap_drop: ALL`, `no-new-privileges`, `read_only` rootfs, and is unpublished (ingress only via console nginx). |
| `/:/host:ro` | psutil needs the host rootfs for real disk usage, `/proc/net/dev` (host NICs) and `/sys` thermal | Read-only. `network_mode: host` was rejected — it would break the nginx-over-project-network model. |

**Risk acknowledged:** `docker.sock` access ≈ host root (create a container that
bind-mounts host `/`). The admin key is the only thing between a read-tier caller and
that. Keep the admin key strong, random, and distinct from the read key.

---

## Data storage

Metrics live in **SQL-Hub**, not a local file — the fleet-wide default (every hub
defaults SQL sources to SQL-Hub over a local/embedded DB, `~/projects/CLAUDE.md`
"Application Fleet Architecture"), applied here 2026-08-29. `agent/db.py`'s
`SqlHubDatabase` talks to SQL-Hub's `/query/read` + `/query/write` over HTTP
(`agent/sql_hub_client.py`) using the exact same schema (`host_samples`,
`container_samples`, `rollup_host_1h`, `rollup_container_1h`, `audit_log`, `meta`) the
original local-sqlite implementation used — every call site above `db.py` (collector,
routes, tasks) is unchanged.

The local-sqlite path (`agent/db.py`'s plain `Database` class) still exists and still
backs the test suite (`Database(":memory:")`, see `tests/conftest.py`) — mirrors the
`FLEET_TEST_SQLITE`-style test-only escape hatch already used elsewhere in the fleet
(e.g. fin-hub). `db.py`'s `open_database(cfg)` picks SQL-Hub whenever `SQL_HUB_URL` is
set (i.e. always, in `docker-compose.yml`); tests never set it, so they're unaffected.

`wal_checkpoint()`/`incremental_vacuum()` are no-ops against the SQL-Hub backend — that's
SQL-Hub's own connection to manage, not this agent's. `size_bytes()` is best-effort
(`PRAGMA page_count`/`page_size` via `/query/read`; SQL-Hub's `BUG-FIX-PLAN.md` tracks
tightening read-only enforcement there, which could someday break this pass-through —
falls back to `0`, not a crash, if it ever does).

---

## Deployment

`docker-compose.yml` defines the `pi-hub-agent` service. Before the first `up`:

1. **`.env`** (gitignored — copy from `.env.example`):
   ```
   AGENT_READ_KEY=<strong random>
   AGENT_ADMIN_KEY=<different strong random>
   DOCKER_GID=<getent group docker | cut -d: -f3   on THIS host>
   SQL_HUB_URL=http://host.docker.internal:1234
   SQL_HUB_API_KEY=<dedicated key — POST /admin/api-keys/create on SQL-Hub, not its master key>
   SQL_HUB_DB_NAME=pi-hub-agent.db
   ```
   The Pi and the WSL dev box have different `docker` gids — set each host's own.
   `extra_hosts: host.docker.internal:host-gateway` (already in `docker-compose.yml`) is
   required on this engine — confirmed 2026-08-29 that `host.docker.internal` does not
   resolve here without it (this isn't Docker Desktop's DNS; a plain container without
   `--add-host` fails to resolve it at all).

2. **`agent-data/`** — retired. Was the old local-sqlite bind-mount target; no longer
   mounted by `docker-compose.yml` now that storage is SQL-Hub. Left in place on hosts
   that had it (may still hold pre-migration `metrics.db*` files) but nothing reads or
   writes it anymore — safe to delete whenever convenient.

3. **Browser keys** — on the admin box, set
   `localStorage['fleet.console.keys']` to include
   `{"pi-hub-agent":"<read>","pi-hub-agent-admin":"<admin>"}`. The console reads these
   and sends `X-API-Key` itself; nginx injects nothing.

Then:

```
# dev (exposes the agent on 127.0.0.1:31107 for curl):
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Pi (live):
docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build
```

nginx (`nginx.conf`) proxies `location /agent/` → `pi-hub-agent:8080` with a Docker
`resolver` (re-resolves the container IP after a restart), WebSocket upgrade headers, and
long read/send timeouts. `set $agent_upstream …` must precede `rewrite … break` — the
`break` flag halts later rewrite-phase directives.

**Rollback:** `docker compose stop pi-hub-agent`. The console stays fully functional; the
agent's health card just turns red. Beszel stays up until the parity checklist passes
(plan §8).

---

## API surface (Plan 1)

Base path through the console nginx: `/agent/…` (container-internal `/…`).

| Method | Path | Tier | Notes |
|---|---|---|---|
| GET | `/health` | none | superset of the fleet `/health` shape (`version`, `docker`, `db`, `collector`) — `useFleetHealth.js` polls it unchanged. |
| GET | `/ready` | none | 200 once ≥1 sample written and docker ping ok, else 503. |
| GET | `/api/host/info` | read | hostname, kernel, CPU model/cores, mem total, boot time, per-metric `source` map. |
| GET | `/api/host/metrics/current` | read | latest `host_samples` row (percore + disk_extra parsed) + `sources` + `age_s`. |
| GET | `/api/host/metrics/range?from=&to=&metrics=cpu,mem,net,disk,temp,load&points=300&agg=avg\|max` | read | `{resolution:"raw"\|"1h", bucket_s, series:{cpu_pct:[[ts,v]…], …}}`. Series are **always** keyed by the canonical raw name regardless of resolution. raw when span ≤ 48 h and bucket < 1 h, else the hourly rollup. |
| GET | `/api/collector/status` | read | row counts per table, db size, prune/rollup timestamps, last error. |
| GET | `/api/containers` | read | one row per container; cpu/mem from the newest `container_samples` row (no live inspect). |
| GET | `/api/containers/{id}` | read | `/containers/{id}/json` passthrough + `{compose_managed, anonymous_volumes, recreate_warnings}`. |
| GET | `/api/containers/{id}/logs?tail=&since=&timestamps=` | read | one-shot `{lines:[{ts,stream,text}]}`. |
| WS | `/api/containers/{id}/logs/stream?tail=&timestamps=` | read | frames `{type:"log",…}`, `{type:"end"}` on stop. |
| GET | `/api/containers/{id}/stats` | read | single computed snapshot. |
| WS | `/api/containers/{id}/stats/stream` | read | `{type:"stats",…}` ~every 2 s. |
| GET | `/api/audit?limit=&before=&action=` | read | audit rows (populated by Plan 2; table + endpoint exist now). |

**WebSocket auth:** browsers can't set headers on a `WebSocket`, and a `?key=` query
param would leak into nginx logs — so the first frame after connect must be
`{"type":"auth","key":"…"}` within 2 s, or the server closes with code **4401**.

---

## API surface (Plan 2 — container management)

All control is **admin tier** and writes an `audit_log` row (via `agent/audit.py`;
`params` stores Env **key names only**). `docs/PLAN-container-management.md`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/containers/{id}/start` | audited |
| POST | `/api/containers/{id}/stop?t=10` | audited |
| POST | `/api/containers/{id}/restart?t=10` | audited |
| POST | `/api/containers/{id}/kill?signal=SIGTERM` | audited |
| POST | `/api/containers/{id}/remove?force=&volumes=` | audited |
| POST | `/api/containers/prune` | stopped-container prune |
| POST | `/api/containers/{id}/recreate` `{pull,force}` | `202 {task_id}`; progress on `WS /api/tasks/{task_id}`; rebuilds the create payload from the live inspect (`Config` + `HostConfig` + extra networks), stop → rename old to `{name}_old_{ts}` → create → reconnect networks → start; rollback on failure. Guards (anonymous volumes / multi-network / compose-managed) need `force:true`. |
| GET | `/api/images` | read tier — `{id,repo_tags,size,created,containers_using,dangling}` |
| GET | `/api/images/df` | read tier — `docker system df` summary + reclaimable bytes |
| POST | `/api/images/pull` `{ref}` | `202 {task_id}`; layer progress on the task WS |
| POST | `/api/images/prune` `{dangling_only}` | `{deleted,space_reclaimed}` |
| WS | `/api/tasks/{task_id}` | admin — **replays the task's buffered frames on connect**, then live, then `{type:"done"\|"error"}` |
| WS | `/api/containers/{id}/exec?cmd=/bin/sh&tty=true` | admin — after the auth frame: client `{type:"stdin"\|"resize"\|"ping"}`, server `{type:"stdout"\|"exit"\|"error"}`. Idle timeout `EXEC_IDLE_TIMEOUT_S` (300), hard cap `EXEC_MAX_DURATION_S` (3600), `MAX_EXEC_SESSIONS` (3) concurrent, `cmd` must be in `EXEC_ALLOWED_CMDS`. `ENABLE_EXEC=false` removes the route entirely. Open + close each write an `audit_log` row. |

**Key risk:** exec + image pull + recreate from a LAN browser means anyone holding the
admin key (or a browser that holds it, or console XSS) gets a root-capable shell on the
Pi. Mitigations: admin key only in the one admin browser; `ENABLE_EXEC` flag; short idle
timeout; session cap; every action audited; typed-name confirm on remove/recreate. A CSP
header on the console nginx to shrink the XSS surface is noted-not-done.

**Retirement (recorded for the user — plan §5):** after the Portainer parity checklist
passes — `docker compose down` in `/opt/docker/portainer`, `mv` to `_retired/`, remove the
`portainer.pi-hub.local` NPM proxy host, confirm ports 9000/9443 freed, drop the
`portainer` entry from `src/config/fleet.js`, `/create-feature` in DEV-Hub project 24.

---

## Local development

```
cd agent
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q          # 43 tests: downsampling, retention/rollup, auth tiers
                             # (401/403), WS first-frame auth (incl. admin task/exec
                             # sockets), container-stats math, range key normalization,
                             # recreate payload reconstruction + guards + network-mode
                             # round-trip, audit rows + Env redaction
```

Socket-touching tests are marked `integration` and skipped by default. `pytest.ini` sets
`asyncio_mode = auto`.

### End-to-end (needs a working Docker socket)

The container endpoints only work when the agent container can read the socket it mounts:
non-root `uid 10001` + `group_add: [DOCKER_GID]` against a normal **rootful** daemon (the
Pi). Full flow verified there — list/inspect, logs (one-shot + follow), stats
(one-shot + stream), start/stop/restart/kill, image list/df/pull-with-layer-progress,
`containers/prune` + `images/prune`, recreate (happy path, forced-failure rollback,
compose-guard block-without-`force`), exec `/bin/sh` **and** `/bin/bash` (TTY, resize,
exit code), `MAX_EXEC_SESSIONS` cap, and a complete redacted audit trail.

On a WSL box that runs a **rootless** daemon as the default context beside a rootful one,
build on the rootless daemon (it has network) then run the stack on the rootful one:

```
docker compose build                                   # rootless (default) — has DNS
docker save pi-hub-pi-hub-agent:latest pi-hub-pi-hub:latest | docker -c default load
docker -c default compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-build
```

Against the rootless daemon directly, `uid 10001` can't read the rootful `/var/run/docker.sock`
regardless of `DOCKER_GID` (userns remap), so container endpoints return 500 while host
metrics still work.
