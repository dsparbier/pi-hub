# PLAN — Native Host & Container Monitoring (retire Beszel)

> **Plan 1 of 2.** Companion: `docs/PLAN-container-management.md` (Plan 2 — retire Portainer).
> Plan 1 **fully precedes** Plan 2: Plan 2 imports this plan's sidecar, auth, WebSocket-auth
> handshake, SQLite store, charts module and the read-only `Containers` view. Do not start
> Plan 2 until `pi-hub-agent` is deployed on the Pi and passing `/health` + the Beszel parity
> checklist (§8).

---

## Context

The Pi runs three separate operational web UIs — the **Pi-Hub Fleet Console**
(`console.pi-hub.local`, this repo), **Beszel** (`beszel.pi-hub.local`, host + container
metrics) and **Portainer** (`portainer.pi-hub.local`, container management). Goal: **one**
management console for Pi-Hub, with Beszel + Portainer folded in and decommissioned.

**Load reality (measured on the Pi, 2026-08-29).** Beszel hub + agent ≈ 0.01 % CPU / ~36 MiB;
Portainer ≈ 0 % CPU / ~23 MiB. Both are effectively idle. The Pi's real memory pressure is
Ollama (1.7 GiB). "Reduce load" here means **fewer services/UIs to run, reverse-proxy, update
and secure** — not reclaiming CPU/RAM. Retiring both frees ~60 MiB, two NGINX-Proxy-Manager
routes and three host ports (8091 / 9000 / 9443).

**Chosen approach.** Add one new backend service — a FastAPI sidecar **`pi-hub-agent`** — to
this repo's compose project. It mounts the Docker socket (`:ro`) and the host root (`/:/host:ro`)
and reads host metrics with `psutil`. Metrics history goes to a **local bind-mounted SQLite
file** with a 48 h-raw + 90 d-hourly-rollup retention scheme. This plan also delivers the native
**Host Metrics** view and a **read-only Containers** view.

**Architecture fit.** This repo is today a pure static React SPA (one nginx container, port
31106). This adds its first backend — a sibling service in the *same* compose project, so
sharing that project's own default network is allowed by the fleet "no cross-project Docker
networks" rule (that rule bars *cross-project* joins). The agent publishes **no port**; its only
ingress is the console's nginx via a new `/agent/` reverse-proxy `location` (single origin → no
CORS). The one deviation from "HTTP-over-published-port only" is the `docker.sock` + `/:/host:ro`
**bind mounts** — the irreducible cost of replacing Portainer + Beszel; document them in compose
comments and `docs/AGENT.md`.

**Scope.** Only files under `~/projects/pi-hub/`. `/opt/docker/pi-hub/` on the Pi is the
documented deploy target. NPM route changes, the `docker` group GID lookup, real API keys and
the physical `_retired/` moves are **recorded for the user to action** (§9) — not done from the
repo.

---

## 1. Goal

Ship `pi-hub-agent` + a Host Metrics view + a read-only Containers view. Retire Beszel. Own all
shared foundation Plan 2 builds on: the service, two-tier auth, nginx route, SQLite store, the
frontend agent client.

## 2. Backend — new tree `~/projects/pi-hub/agent/`

**Stack:** FastAPI + `uvicorn[standard]` on `python:3.12-slim-bookworm` (glibc — `psutil` arm64
wheels install without a compiler; Alpine would force a build toolchain). Docker library:
**`aiodocker`** (async over the unix socket — log-follow, stats-stream and interactive exec are
each one cancellable asyncio task; docker-py is sync and would leak threads on client
disconnect). Anything `aiodocker` lacks a helper for (`GET /images/json`, `GET /system/df`,
prune, exec resize, pull progress — Plan 2) uses its low-level `docker._query_json(...)` against
the documented Engine API. **Do not also install docker-py.** No ORM — stdlib `sqlite3` with a
single-writer executor.

`agent/requirements.txt` (pinned): `fastapi`, `uvicorn[standard]`, `aiodocker`, `psutil`, `anyio`.

| File | Responsibility |
|---|---|
| `agent/app.py` | FastAPI app; lifespan starts/stops collector tasks; router registration. |
| `agent/auth.py` | Two-tier `X-API-Key` check via `secrets.compare_digest` (mirror tool-hub `src/auth/middleware.py`): `require_read` (admin key also accepted), `require_admin`. **WebSocket variant:** first frame after connect must be `{"type":"auth","key":"…"}` within 2 s or the server closes 4401 (browsers can't set WS headers; a query-param key is rejected — it leaks into nginx access logs). |
| `agent/config.py` | Env: `AGENT_READ_KEY`, `AGENT_ADMIN_KEY`, `HOST_ROOT=/host`, `DISK_MOUNTS=/host`, `SAMPLE_INTERVAL_HOST=15`, `SAMPLE_INTERVAL_CONTAINERS=30`, `RAW_RETENTION_HOURS=48`, `ROLLUP_RETENTION_DAYS=90`, `ENABLE_EXEC=true` (Plan 2), `MAX_EXEC_SESSIONS=3` (Plan 2). |
| `agent/docker_client.py` | Thin `aiodocker` wrapper. Read-only use in Plan 1 (list, inspect, `stats(stream=…)`, `log(...)`). Control + images added in Plan 2. |
| `agent/host_metrics.py` | psutil + mount/visibility handling (§3). Every metric tagged `source: "host" \| "container" \| "unavailable"`. |
| `agent/db.py` | Schema (**all** tables incl. `audit_log` created now), `PRAGMA journal_mode=WAL`, `synchronous=NORMAL`, `auto_vacuum=INCREMENTAL`; single-writer via a dedicated executor. |
| `agent/collector.py` | asyncio tasks: host sampler, container sampler, retention/rollup task. |
| `agent/routes_host.py` | `/api/host/*`, `/api/host/metrics/range`, `/api/collector/status`. |
| `agent/routes_containers_ro.py` | `/api/containers` (list), `/api/containers/{id}` (inspect), `/api/containers/{id}/logs` (one-shot), WS `/logs/stream`, WS `/stats/stream`, `/api/audit` (read). |
| `agent/routes_health.py` | `/health`, `/ready`, optional `/metrics` (Prometheus, low priority). |
| `agent/Dockerfile` | `python:3.12-slim-bookworm`; non-root user `10001`; `pip install -r requirements.txt`; `CMD uvicorn agent.app:app --host 0.0.0.0 --port 8080`. |
| `agent/tests/` | pytest + `httpx.AsyncClient`: downsampling math, retention deletes, auth tiers (401/403), WS first-frame auth. Socket-touching tests marked `integration`. |

## 3. psutil visibility on a containerised Pi

Linux does not virtualise system-wide `/proc`, so a container reads **host** values for
CPU / load / mem / swap / disk-IO / uptime by default — which is what we want. Gaps:

- **Disk usage (df):** container sees its own rootfs → bind-mount `/:/host:ro` and call
  `psutil.disk_usage('/host')` (+ extra targets from `DISK_MOUNTS`).
- **Network throughput:** container netns hides real NICs → parse `/host/proc/net/dev`
  directly (~15-line parser; `wlan0` / `eth0` live in the host netns). `network_mode: host` is
  **rejected** — it breaks the nginx-over-project-network model.
- **CPU temp:** usually readable at `/sys/class/thermal/thermal_zone0/temp`; add a direct
  file-read fallback on `/host/sys/...`. `vcgencmd` is not available in-container.
- **No `pid: host`** — host process list is not needed.

Container CPU/mem/net/blkio come from the Docker API (`/containers/{id}/stats`), not psutil.
If a mount is missing, the metric is tagged `source:"unavailable"` and the UI shows
"unavailable" rather than a bogus container-scoped number.

## 4. SQLite schema (`/data/metrics.db`) — created in full now

```sql
CREATE TABLE host_samples (
  ts INTEGER PRIMARY KEY,                 -- unix epoch seconds
  cpu_pct REAL, cpu_pct_percore TEXT,     -- percore = JSON array
  load1 REAL, load5 REAL, load15 REAL,
  mem_total INTEGER, mem_used INTEGER, mem_avail INTEGER, mem_pct REAL,
  swap_total INTEGER, swap_used INTEGER, swap_pct REAL,
  disk_total INTEGER, disk_used INTEGER, disk_pct REAL,          -- primary mount
  disk_extra TEXT,                        -- JSON {mount:{total,used,pct}}
  net_rx_bytes INTEGER, net_tx_bytes INTEGER, net_rx_rate REAL, net_tx_rate REAL,
  disk_read_bytes INTEGER, disk_write_bytes INTEGER, disk_read_rate REAL, disk_write_rate REAL,
  temp_c REAL, uptime_s INTEGER
);

CREATE TABLE container_samples (
  ts INTEGER NOT NULL, cid TEXT NOT NULL, name TEXT NOT NULL,
  state TEXT, cpu_pct REAL,
  mem_used INTEGER, mem_limit INTEGER, mem_pct REAL,
  net_rx_bytes INTEGER, net_tx_bytes INTEGER, net_rx_rate REAL, net_tx_rate REAL,
  blk_read INTEGER, blk_write INTEGER, pids INTEGER,
  restart_count INTEGER, health TEXT,
  PRIMARY KEY (ts, cid)
);
CREATE INDEX ix_cs_cid_ts ON container_samples(cid, ts);

CREATE TABLE rollup_host_1h (
  ts INTEGER PRIMARY KEY,                 -- hour bucket start
  cpu_pct_avg REAL, cpu_pct_max REAL, load1_avg REAL, load1_max REAL,
  mem_pct_avg REAL, mem_pct_max REAL, swap_pct_avg REAL,
  disk_pct_avg REAL, disk_pct_max REAL,
  net_rx_rate_avg REAL, net_rx_rate_max REAL, net_tx_rate_avg REAL, net_tx_rate_max REAL,
  disk_read_rate_avg REAL, disk_write_rate_avg REAL,
  temp_c_avg REAL, temp_c_max REAL, sample_count INTEGER
);
CREATE TABLE rollup_container_1h (
  ts INTEGER NOT NULL, cid TEXT NOT NULL, name TEXT,
  cpu_pct_avg REAL, cpu_pct_max REAL, mem_pct_avg REAL, mem_pct_max REAL,
  mem_used_avg INTEGER, net_rx_rate_avg REAL, net_tx_rate_avg REAL, sample_count INTEGER,
  PRIMARY KEY (ts, cid)
);

CREATE TABLE audit_log (                  -- populated by Plan 2; table exists now
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL, actor TEXT, client_ip TEXT,
  action TEXT NOT NULL,
  target TEXT, params TEXT,               -- JSON; Env reduced to key names only
  result TEXT, detail TEXT, duration_ms INTEGER
);
CREATE INDEX ix_audit_ts ON audit_log(ts);

CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);   -- schema_version, last_rollup_ts, last_prune_ts
```

**Collector.** Host sampler every 15 s (one `host_samples` row). Container sampler every 30 s
(one `container_samples` row per **running** container; `stats(stream=false)` fanned out with
`asyncio.gather` under a semaphore of 4; non-running skipped; rates from consecutive cumulative
counters, first row after start writes NULL rates). Gaps render as gaps — never interpolated.

**Retention task every 30 min.** (1) roll each complete past hour into `rollup_*_1h` (AVG +
MAX per numeric column); (2) delete `host_samples` / `container_samples` older than
`RAW_RETENTION_HOURS` (48 h); (3) delete rollups older than `ROLLUP_RETENTION_DAYS` (90 d);
(4) drop `container_samples` for any `cid` unseen in 48 h (container-churn guard); (5) trim
`audit_log` to max(5000 rows, 1 year); (6) `wal_checkpoint(TRUNCATE)` each run, weekly
`incremental_vacuum`. `range` serves raw when span ≤ 48 h and bucket < 1 h, else the rollup
table.

**MVP fallback** if rollups over-scope this plan: raw-only, 7-day retention (~105 MB) — ship
that, move rollups to Plan 2.

**DB growth (~25 containers on the Pi).** `host_samples` ~1.5 MB/day; `container_samples`
~12–14 MB/day; rollups ~130 KB/day. Steady state (48 h raw + 90 d rollup) ≈ **30–45 MB**.

## 5. HTTP / WS API — Plan 1 subset

Base path through the console nginx: `/agent/…` (container-internal `/…`).

| Method | Path | Tier | Notes |
|---|---|---|---|
| GET | `/health` | none | `{status,version,uptime_s,docker:{ok,api_version},db:{ok,size_bytes},collector:{last_host_sample_ts,last_container_sample_ts,lag_s}}` — superset of the fleet `/health` shape so `useFleetHealth.js` polls it unchanged. |
| GET | `/ready` | none | 200 once ≥1 sample written and docker ping ok. |
| GET | `/api/host/info` | read | hostname, kernel, OS, CPU model/cores, mem total, docker version, boot time, per-metric `source` map. |
| GET | `/api/host/metrics/current` | read | latest `host_samples` row + derived fields. |
| GET | `/api/host/metrics/range?from=&to=&metrics=cpu,mem,net,disk,temp,load&points=300` | read | `{resolution:"raw"\|"1h", series:{cpu_pct:[[ts,v],…],…}}`; server downsamples to `points` (default 300, max 2000), AVG/MAX per bucket. |
| GET | `/api/collector/status` | read | rows per table, db size, next prune/rollup due. |
| GET | `/api/containers` | read | `{id,name,image,state,status,health,created,ports,compose:{project,service},restart_count,cpu_pct,mem_used,mem_pct}` — cpu/mem from newest `container_samples` row (no live inspect). |
| GET | `/api/containers/{id}` | read | passthrough of `/containers/{id}/json` + `{compose_managed,anonymous_volumes,recreate_warnings}`. |
| GET | `/api/containers/{id}/logs?tail=200&since=&timestamps=true` | read | one-shot `{lines:[{ts,stream,text}]}`. |
| WS | `/api/containers/{id}/logs/stream?tail=200&timestamps=true` | read | frames `{type:"log",ts,stream,text}`; `{type:"end"}` on stop. |
| GET | `/api/containers/{id}/stats` | read | single computed snapshot. |
| WS | `/api/containers/{id}/stats/stream` | read | `{type:"stats",ts,cpu_pct,mem_used,mem_limit,mem_pct,net_rx_rate,net_tx_rate,blk_read_rate,blk_write_rate,pids}` ~every 2 s. |
| GET | `/api/audit?limit=100&before=&action=` | read | audit rows (Env redacted to key names). |

## 6. Deployment wiring

**`docker-compose.yml`** — new service, no published port:

```yaml
  pi-hub-agent:
    build: ./agent
    container_name: pi-hub-agent
    restart: unless-stopped
    environment:
      - AGENT_READ_KEY=${AGENT_READ_KEY:?set in .env}
      - AGENT_ADMIN_KEY=${AGENT_ADMIN_KEY:?set in .env}
      - HOST_ROOT=/host
      - DISK_MOUNTS=/host
      - SAMPLE_INTERVAL_HOST=15
      - SAMPLE_INTERVAL_CONTAINERS=30
      - RAW_RETENTION_HOURS=48
      - ROLLUP_RETENTION_DAYS=90
      - ENABLE_EXEC=true          # consumed in Plan 2
      - MAX_EXEC_SESSIONS=3       # consumed in Plan 2
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro   # :ro is cosmetic — full API still reachable; admin key is the boundary
      - /:/host:ro,rslave
      - ./agent-data:/data
    group_add:
      - "${DOCKER_GID:?run: getent group docker}"
    user: "10001:10001"
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    dns: [192.168.68.115, 192.168.68.57, 1.1.1.1]
    sysctls: [net.ipv6.conf.all.disable_ipv6=1]
    healthcheck:
      test: ["CMD","python","-c","import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
```

**`docker-compose.pi.yml`** — overlay adds only `restart: unless-stopped` for `pi-hub-agent`
(matches how `pi-hub` is pinned).

**Optional `docker-compose.dev.yml`** (already referenced in the base file's comments) — adds
`ports: ["127.0.0.1:31107:8080"]` on `pi-hub-agent` for `curl` during development only.

**`nginx.conf`** — add, inside `http` / `server`:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
# ... inside server { } :
resolver 127.0.0.11 valid=10s;     # Docker embedded DNS — re-resolve agent IP on restart
location /agent/ {
    proxy_pass http://pi-hub-agent:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}
```

**Key handling:** the browser sends `X-API-Key` itself from
`localStorage['fleet.console.keys']`, exactly like the other backends — nginx does **not**
inject it (config stays static/secret-free; the read/admin split is driven from the browser).
Accepted cost: keys live in localStorage on a LAN admin box (already the fleet posture).

**No new NPM proxy host** — `/agent/` rides on the existing `console.pi-hub.local` → `pi-hub:80`
route. Deliberate: the agent's only ingress is the console.

Run `/align-docker-conf` after the compose edit (confirm `dns` / `sysctls` present, no
`version:` key, no bare cross-project hostnames).

Document the two bind mounts in `docs/AGENT.md` (create it in this plan) along with the Plan 1
API surface.

## 7. Frontend — all under `~/projects/pi-hub/src/`

**Navigation — introduce lightweight view-switching.** The app currently only scroll-anchors
(`onSelect` → `scrollIntoView` on `[data-group]`). Host Metrics and Containers hold live
WebSockets that must unmount when hidden. Add `const [view, setView] = useState('console')` in
`src/App.jsx`; render one of `<FleetConsole/>` / `<HostMetrics/>` / `<Containers/>`. No router
dependency. The "Jump to" group is rendered only when `view === 'console'`. New "Monitor" group
items: `{id:'console',label:'Fleet Console',icon:'activity'}`,
`{id:'metrics',label:'Host Metrics',icon:'cpu'}`,
`{id:'containers',label:'Containers',icon:'box'}`. `onSelect(id)`:
`console|metrics|containers` → `setView(id)`; `grp-*` → existing scroll. `activeId={view}`.

**`src/config/fleet.js`** — add:

```js
export const AGENT = {
  id: 'pi-hub-agent', base: '/agent', healthUrl: '/agent/health',
  readKey:  K('pi-hub-agent', 'pi-hub-agent-read-key'),
  adminKey: keyOverrides['pi-hub-agent-admin'] || 'pi-hub-agent-admin-key',
}
```

and a `services[]` entry
`{id:'pi-hub-agent',label:'Pi-Hub Agent',icon:'box',group:'infrastructure',blurb:'Native metrics + container mgmt sidecar',healthUrl:'/agent/health'}`
so `useFleetHealth.js` polls it with **zero hook changes**.

**New files:**

| File | Contents |
|---|---|
| `src/fleet/useAgent.js` | `agentFetch(path,{method,body,admin})` (prepends `/agent`, adds `X-API-Key`, typed errors → `useLogger()`); `wsConnect(path,{admin,onFrame})` (opens WS, sends `{type:'auth',key}` first frame, backoff reconnect, unmount cleanup); read-tier hooks `useHostMetricsCurrent(15000)`, `useHostMetricsRange(from,to,metrics,points)`, `useContainers(10000)`, `useContainerInspect(id)`; stream helpers `openLogStream`, `openStatsStream`. Polls **only while a view is mounted**. No change to `useFleetHealth.js`. |
| `src/fleet/extra-icons.jsx` | `Icon` matching `src/fleet/icons.jsx`'s contract, backed by an extended GLYPHS map with the 9 Lucide glyphs missing from the vendored `src/fleet-ui/icons/index.js`: `box cpu hard-drive terminal play square rotate-cw download trash`. Agent components import `Icon` from here; `src/fleet/icons.jsx` untouched. **Cross-project note:** request these be upstreamed into `~/projects/_fleet/fleet_ui/icons/index.js`; once done, delete this file and repoint imports. |
| `src/fleet/agent/charts.jsx` | Relocate + generalise the inline-SVG renderers from the orphaned `src/components/WidgetPanel.jsx` — **no new runtime deps**: `<TimeSeries points height width unit yMax multi/>` (from `LatencyChartWidget`; add area fill + last-value label + a 2-series rx/tx variant), `<Sparkline values/>`, `<DotGrid values cols/>` (from `UptimeGridWidget`), `<StatTriplet values/>` (from `StatLatencyWidget`). Leave `WidgetPanel.jsx` itself untouched (superseded reference). |
| `src/fleet/agent/gauges.jsx` | Radial / bar gauge for cpu / mem / disk / temp. |
| `src/fleet/agent/HostMetrics.jsx` | View: gauge row + time-series charts + range selector (1 h / 24 h / 7 d / 30 d). |
| `src/fleet/agent/Containers.jsx` | View: container table (state / health / ports / image / cpu / mem sparkline) + selection → detail. **Read-only in Plan 1** — no action buttons. |
| `src/fleet/agent/ContainerDetail.jsx` | Tabs: inspect JSON / logs / stats. |
| `src/fleet/agent/LogStream.jsx` | WS log viewer — follow toggle, tail size, stdout/stderr filter. Reuse `src/components/LogViewer.jsx` styling conventions. |
| `src/fleet/agent/StatsSparklines.jsx` | Live stats WS → sparklines. |
| `src/fleet/agent/agent.module.css` | Only where fleet-ui classes (`fleet-card`, `fleet-tile`, `fleet-pill`, `fleet-section`, tones `ok\|warn\|stop\|idle`) don't suffice. |

## 8. Retire Beszel (cutover part 1)

**Parallel-run ~1–2 weeks**, then verify the **Beszel parity checklist:**

- Host CPU %, load, mem, swap, disk usage, disk IO, net throughput, CPU temp — all present,
  within ~5 % of Beszel over the same window.
- Per-container CPU / mem / net / PIDs history visible (table + sparklines + detail).
- Range queries (1 h / 24 h / 7 d / 30 d) render and roughly match Beszel.
- DB size plateaus after the retention window; prune + rollup runs logged.
- Survives a Pi reboot (`restart: unless-stopped`); collector resumes; no WAL corruption.
- Resource cost acceptable — target < ~1 % CPU idle, < ~120 MiB RSS (heavier than Beszel's
  ~36 MiB because Python — expected).

**Then — recorded for the user (the repo cannot do these), see §9:**

1. `docker compose down` in `/opt/docker/beszel` (hub **and** `beszel-agent` on host port
   45876).
2. `mv /opt/docker/beszel /opt/docker/_retired/beszel-<date>`; optionally `tar czf` the
   `beszel_data/` dir (`data.db`). Keep ≥ 1 month past sign-off.
3. NPM UI (`npm.pi-hub.local`): remove the `beszel.pi-hub.local` proxy host.
4. Confirm host port 8091 freed.

**In this repo at cutover:**

- `src/config/fleet.js` — drop the `beszel` service entry (the `pi-hub-agent` entry replaces
  it in the Infrastructure group).
- Bump `package.json` `"version"` **and** `src/version.js` together — currently `1.5.11` in
  both; grep the old string, they drift by hand.
- DEV-Hub project id 24 — one `/create-feature` for this plan (record via slash command, not
  from the repo).

## 9. Must be actioned outside this repo

- `getent group docker` on the Pi **and** on the WSL dev box → each host's `.env` as
  `DOCKER_GID=` (gitignored).
- Real `AGENT_READ_KEY` / `AGENT_ADMIN_KEY` (strong random, distinct, **not** a fleet
  placeholder) in `/opt/docker/pi-hub/.env` (Pi) and dev `.env`; add to the admin browser's
  `localStorage['fleet.console.keys']` = `{"pi-hub-agent":"<read>","pi-hub-agent-admin":"<admin>"}`.
- Remove the `beszel.pi-hub.local` NPM proxy host. Add none.
- `mv /opt/docker/beszel` → `/opt/docker/_retired/…`, archive `beszel_data/`.
- Confirm the `/:/host:ro` bind mount into the agent is acceptable (host rootfs readable inside
  that one container).
- Optional: upstream the 9 Lucide glyphs into `~/projects/_fleet/fleet_ui/icons/index.js`;
  until then `src/fleet/extra-icons.jsx` carries them.

## 10. Verification

**Dev box (WSL — has its own `/var/run/docker.sock`):**

- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` → `pi-hub`
  (nginx) + `pi-hub-agent`. Set `DOCKER_GID` to the WSL docker gid; `/:/host:ro`.
- `http://localhost:31106/` → console; `http://localhost:31106/agent/health` → 200.
- Host metrics populate (WSL host — temp sensor may be absent, must degrade to
  `source:"unavailable"`); container list shows the dev fleet; log + stats stream for a local
  container; `range` returns downsampled series; the DB file appears under `agent-data/` and
  grows then plateaus after the retention window.
- `agent/tests/` pytest: downsampling math, retention deletes, auth tiers (401/403), WS
  first-frame auth. Socket tests marked `integration`.

**Pi:** after `git -C /opt/docker/pi-hub pull` +
`docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build`: run the manual
checklist against `http://console.pi-hub.local/agent/…`; run the Beszel parity checklist;
watch `docker stats pi-hub-agent` for a day; confirm DB size plateau; reboot the Pi, confirm
the collector recovers.

**Rollback:** `docker compose stop pi-hub-agent` (or redeploy without the service) — the
console stays fully functional, the agent card just turns red. Beszel remains until step §8.

## 11. Key risks

1. **`docker.sock` = host root.** `:ro` on the mount is cosmetic — `create` + bind-mount host
   `/` into a new container = trivial host root. **The admin API key is the only boundary.**
   Mitigations: strong random admin key; distinct read key; non-root uid + `cap_drop: ALL` +
   `no-new-privileges` + `read_only` rootfs (limits *agent* compromise); agent unpublished
   (ingress only via console nginx). Hardening noted, not v1: NPM HTTP basic auth in front of
   `console.pi-hub.local`, or nginx `map $request_method` requiring the admin key for write
   methods on `/agent/`.
2. **API keys in localStorage** — already the fleet posture, but the admin key (used in Plan 2)
   is newly powerful. Rotation = edit `.env` + redeploy + update the one browser.
3. **psutil container-visibility gaps** (§3) — wrong-scope values if a mount is missing; every
   metric carries `source: host|container|unavailable` and the UI shows "unavailable".
4. **Python footprint** — expect ~100–120 MiB RSS vs Beszel's ~36 MiB; still trivial on the Pi.
   Net change after retiring both Beszel and Portainer (Plan 2) ≈ break-even on RAM,
   −2 services / −2 NPM routes / −3 host ports.
5. **Fleet "no cross-project Docker networks" rule** — not violated: `pi-hub-agent` is in the
   *same* compose project as `pi-hub`; the deviation is the `docker.sock` + `/:/host` **bind
   mounts**, not a network join. Document in compose comments + `docs/AGENT.md`; re-run
   `/align-docker-conf`.
6. **Version-bump quirk** — `package.json` `"version"` and `src/version.js` must move together;
   end this plan with one coordinated bump.
