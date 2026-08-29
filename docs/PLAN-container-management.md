# PLAN — Native Docker Container Management (retire Portainer)

> **Plan 2 of 2.** Companion: `docs/PLAN-monitoring-consolidation.md` (Plan 1 — retire Beszel).
> **Prerequisite:** Plan 1's `pi-hub-agent` sidecar is deployed on the Pi and passing `/health`
> + the Beszel parity checklist. This plan imports Plan 1's auth (`agent/auth.py`), socket
> wrapper (`agent/docker_client.py`), WebSocket-auth handshake, SQLite store (`agent/db.py` —
> the `audit_log` table already exists), the `charts.jsx` module, and the read-only
> `Containers.jsx` / `ContainerDetail.jsx` view shells.

---

## Context

See `docs/PLAN-monitoring-consolidation.md` §Context for the full picture. Summary: the Pi runs
three operational UIs (Fleet Console, Beszel, Portainer); the goal is one console with the
other two folded in and retired. Beszel + Portainer are near-idle (~0 % CPU, ~60 MiB combined) —
"reduce load" means fewer services/UIs/routes, not CPU/RAM.

Plan 1 added the `pi-hub-agent` FastAPI sidecar (mounts `docker.sock:ro` + `/:/host:ro`, no
published port, reached only via the console nginx `/agent/` location), a local-SQLite metrics
store, a **Host Metrics** view and a **read-only Containers** view. This plan adds the write
half — container lifecycle control, an in-browser exec shell, image management, a
container-recreate flow — and retires Portainer.

**Scope.** Only files under `~/projects/pi-hub/`. NPM route changes and the physical `_retired/`
move are recorded for the user to action (§5), not done from the repo.

---

## 1. Goal

On top of the running `pi-hub-agent`: admin control endpoints, image management, a task system
with buffered progress replay, an exec WebSocket, and the recreate flow. Then retire Portainer.
Order within this plan: **control endpoints → task system → exec WS → frontend**.

## 2. Backend additions (`~/projects/pi-hub/agent/`)

New files: `agent/routes_containers_ctl.py`, `agent/routes_images.py`, `agent/tasks.py`,
`agent/routes_exec.py`, `agent/recreate.py`, `agent/audit.py`. Extend `agent/docker_client.py`
with control + image + exec calls.

**Control + image + exec endpoints** (base path `/agent/…` through the console nginx):

| Method | Path | Tier | Body / query | Notes |
|---|---|---|---|---|
| POST | `/api/containers/{id}/start` | admin | — | audited |
| POST | `/api/containers/{id}/stop` | admin | `?t=10` | audited |
| POST | `/api/containers/{id}/restart` | admin | `?t=10` | audited |
| POST | `/api/containers/{id}/kill` | admin | `?signal=SIGTERM` | audited |
| POST | `/api/containers/{id}/remove` | admin | `?force=false&volumes=false` | audited |
| POST | `/api/containers/{id}/recreate` | admin | `{pull:true,force:false}` | `202 {task_id}`; progress on `WS /api/tasks/{task_id}`; final `{result,old_id,new_id,image_old,image_new,warnings}`. See §3. |
| GET  | `/api/images` | read | — | `{id,repo_tags,size,created,containers_using,dangling}` |
| GET  | `/api/images/df` | read | — | `docker system df` summary (reclaimable bytes) |
| POST | `/api/images/pull` | admin | `{ref:"nginx:1.27-alpine"}` | `202 {task_id}`; layer progress on `WS /api/tasks/{task_id}` |
| POST | `/api/images/prune` | admin | `{dangling_only:true}` | `{deleted,space_reclaimed}` |
| POST | `/api/containers/prune` | admin | — | stopped-container prune |
| WS   | `/api/tasks/{task_id}` | admin | — | progress frames for pull/recreate; **replays buffered frames on connect** so a late subscriber still sees history; terminal `{type:"done"\|"error"}`. |
| WS   | `/api/containers/{id}/exec?cmd=/bin/sh&tty=true` | admin | — | after the `{type:"auth",key}` frame: client → `{type:"stdin",data}` / `{type:"resize",cols,rows}` / `{type:"ping"}`; server → `{type:"stdout",data}` / `{type:"exit",code}` / `{type:"error",message}`. Idle timeout + max session duration; `MAX_EXEC_SESSIONS` cap; `ENABLE_EXEC=false` disables the route entirely. |

**Audit** (`agent/audit.py`). Every control action writes an `audit_log` row (table created in
Plan 1): `ts, actor, client_ip, action, target, params, result, detail, duration_ms`. `params`
stores Env **key names only**, never values. `GET /api/audit` (read tier, from Plan 1) gains
`action=` filtering.

## 3. Recreate without compose context

1. `GET /containers/{id}/json` — full inspect.
2. Reconstruct the create payload: `Config` (Image, Env, Cmd, Entrypoint, Labels, WorkingDir,
   User, ExposedPorts, Healthcheck) + `HostConfig` (Binds, Mounts, PortBindings, RestartPolicy,
   NetworkMode, CapAdd/Drop, Devices, Ulimits, LogConfig, GroupAdd, Privileged, SecurityOpt,
   ExtraHosts, Sysctls, Dns) + extra networks from `NetworkSettings.Networks`.
3. If `pull:true` → `POST /images/create?fromImage=<repo>&tag=<tag>` (from `Config.Image`
   resolved to `repo:tag`; digest-pinned images keep the digest); stream progress on the task
   WS.
4. `stop` old (`?t=10`) → **rename** old to `{name}_old_{ts}` (frees the name, keeps rollback)
   → `create` new with the original name + reconstructed payload → for each additional network
   `POST /networks/{net}/connect` with the saved aliases → `start` new.
5. Success → leave `{name}_old_{ts}` for manual cleanup (or a `?cleanup=true` flag / next
   recreate sweep). Failure → stop + remove new, rename `_old` back, restart it, return the
   error with `warnings`.

**Guards** — surfaced as `recreate_warnings`, require `force:true` to override:

- **Anonymous volumes** (`Mounts[].Type=="volume"` with a 64-hex name) get *new* empty volumes
  on recreate → silent data loss. Detect and refuse without `force`.
- Multi-network containers: `create` takes only one network (`HostConfig.NetworkMode`); the
  rest need per-network `connect` before `start`.
- `com.docker.compose.*` labels are preserved, so `docker compose` later sees the container as
  "created outside its run". **The UI labels the action "Recreate (ad-hoc) — for
  compose-managed fleet services prefer their own deploy loop"** and shows
  `com.docker.compose.project` when present.
- Inspect is not a clean round-trip (Mounts vs Binds normalisation, empty-string `HostIp` in
  `PortBindings`, legacy `Links`, `MacAddress` field moves across API versions) — record old vs
  new image ID in the audit `detail`.
- `latest` may pull a genuinely new digest (intended) — the audit row captures old vs new.
- `Env` may hold secrets → audit `params` stores Env key names only.
- Port conflict if the old container is not fully stopped — the sequence must confirm
  stop + rename before `create`.

## 4. Frontend additions (`~/projects/pi-hub/src/fleet/agent/`)

| File | Contents |
|---|---|
| `ExecTerminal.jsx` | `@xterm/xterm` + `@xterm/addon-fit` — **new deps**, lazy-loaded via `React.lazy` so the base bundle is unaffected. Custom `onData` → WS / WS → `term.write` wiring (no attach addon). Resize messages on fit. |
| `ImagePanel.jsx` | Image list + sizes + consumers, `system df`, a pull form with a task-progress bar, prune. |
| `ActionButton.jsx` | start / stop / restart / kill / remove / recreate, each gated on the admin key. |
| `ConfirmDialog.jsx` | Destructive-action confirm — typed container name for remove / recreate. |
| `AuditView.jsx` | `audit_log` table; also mounted as a tab in `Containers.jsx`. |

Wire action buttons + an Images tab + an Audit tab into the `Containers.jsx` /
`ContainerDetail.jsx` shells from Plan 1. Extend `src/fleet/useAgent.js` with admin helpers
`runAction(id,action,params)`, `useTask(taskId,onProgress)`, `openExec(id,opts)`. The admin
browser stores `localStorage['fleet.console.keys']['pi-hub-agent-admin']`.

Add the 9 already-provided extra glyphs from `src/fleet/extra-icons.jsx` (Plan 1) where needed:
`play square rotate-cw download trash terminal`.

## 5. Retire Portainer (cutover part 2)

Verify the **Portainer parity checklist:**

- Container list with state / health / ports / image matches `docker ps`.
- Inspect JSON viewable; logs tail + live follow + stdout/stderr + timestamps; live stats
  stream.
- start / stop / restart / kill / remove — all work, all audited.
- Exec `/bin/sh` **and** `/bin/bash` into a running container; resize works; exit code shown.
- Image list with sizes + consumers; `system df`; image pull with layer progress.
- Recreate tested three ways: a throwaway `docker run -d --name t1 alpine sleep 1000`; one real
  compose-managed **stateless** frontend; and a forced failure to prove rollback.
- Audit log captures actor / client IP / redacted params / result for every action.
- `docker inspect pi-hub-agent` confirms non-root, `group_add`, `no-new-privileges`,
  `cap_drop`, `read_only`.

**Then — recorded for the user (the repo cannot do these):**

1. `docker compose down` in `/opt/docker/portainer`.
2. `mv /opt/docker/portainer /opt/docker/_retired/portainer-<date>`; optionally `tar czf` the
   `portainer/data/` dir.
3. NPM UI (`npm.pi-hub.local`): remove the `portainer.pi-hub.local` proxy host.
4. Confirm host ports 9000 / 9443 freed.

**In this repo at cutover:**

- `src/config/fleet.js` — drop the `portainer` service entry.
- Bump `package.json` `"version"` **and** `src/version.js` together (grep the old string).
- DEV-Hub project id 24 — one `/create-feature` for this plan.
- `docs/AGENT.md` — append the Plan 2 endpoints + the retirement record.

## 6. Verification

**Dev box (WSL — has its own `/var/run/docker.sock`):**

- With the Plan 1 dev stack up (`docker-compose.dev.yml`): exec into a local container
  (`/bin/sh`); `pull alpine` with visible layer progress; recreate a throwaway
  `alpine sleep 1000`; force a recreate failure (e.g. a bad image ref) and confirm rollback +
  `warnings`; every action appears in `/api/audit`.
- `agent/tests/`: recreate-payload reconstruction from a captured inspect fixture; auth tiers
  (read key rejected on an admin route → 403); WS first-frame auth on the exec + task sockets;
  the anonymous-volume guard. Socket-touching tests marked `integration`.

**Pi:** after `git -C /opt/docker/pi-hub pull` +
`docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build`: run the manual
checklist and the Portainer parity checklist against `http://console.pi-hub.local/agent/…`.

**Rollback:** `docker compose stop pi-hub-agent` — the console stays functional; Portainer
remains until step §5.

## 7. Key risks

1. **`docker.sock` = host root; the admin API key is the only boundary.** Exec shell + image
   pull + recreate from a LAN browser means anyone with the admin key (or a browser holding it,
   or console XSS) gets a root-capable shell on the Pi. Mitigations: admin key only in the one
   admin browser; `ENABLE_EXEC` flag; short exec idle timeout; `MAX_EXEC_SESSIONS`; audit every
   action + a visible "exec active" indicator; add a CSP header on the console nginx to shrink
   the XSS surface. Prefer a typed-name confirm per destructive action over per-action key
   re-entry.
2. **Recreate of compose-managed containers** — imperfect semantics (labels preserved but
   `docker compose` sees "created outside its run"). The UI labels it "Recreate (ad-hoc)" and
   points at the service's own deploy loop; the anonymous-volume + multi-network guards require
   `force:true`.
3. **xterm bundle weight** — mitigated by `React.lazy`; the base console bundle is unchanged
   for users who never open a terminal.
4. **Version-bump quirk** — `package.json` `"version"` and `src/version.js` must move together;
   end this plan with one coordinated bump.
5. **WSL dev host metrics are the dev box, not the Pi** — fine for plumbing tests; never treat
   dev numbers as parity data.
