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
  project, no network join). History in a bind-mounted SQLite file
  (`agent-data/metrics.db`), 48 h raw + 90 d hourly rollups.
  - The DEV-Hub auto-logging skip (CLAUDE.md "Ecosystem context") and the fleet-wide
    SQL-Hub-default rule were both predicated on "pi-hub has no backend". That premise is
    now partly false — revisit both **for the agent specifically** if it ever needs
    logging/persistence beyond its metrics SQLite.
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
- `mkdir -p agent-data && sudo chown 10001:10001 agent-data` (or `chmod 777`) on every
  deploy host before first `up` — git does not carry the directory's write permission and
  the container runs as uid 10001. Symptom if skipped: agent crash-loops with
  `sqlite3.OperationalError: unable to open database file`.
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
