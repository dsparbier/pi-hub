# pi-hub — Project Primer

Project-level context, scoped to this repo (`pi-hub`) only — not a global setting.

`pi-hub` is a **pure static frontend**: a self-hosted dashboard/portal that presents links,
status, and lightweight health checks for the other self-hosted services in this personal
fleet, in a single configurable page. Confirmed from `docs/UI_MANIFEST.md` and
`docs/Project-Tracker.md`: "Pi-Hub is a self-hosted front-end portal for a Raspberry Pi
device." It is React 18 + Vite 5 with CSS Modules — no UI library, no state library — built as
a static bundle and served by Nginx. There is **no backend process**; all user config (which
services/groups exist, theme, accent color, sidebar state, refresh/timeout settings) lives in
the browser's `localStorage` under `ph-*` keys.

For evolving decisions, gotchas, and pending cross-project amendments, see
`.claude/memory.md`, imported automatically below.

@.claude/memory.md

## Naming: this project vs. "Pi-Hub" the fleet

Two distinct things share the name, and it's worth keeping straight:

- **`pi-hub`** (this repo, `~/projects/pi-hub`) — the specific Node/Vite React app described
  above: a dashboard that *links to* other services.
- **"Pi-Hub"** — the informal name for the whole physical-host / distributed-service fleet
  this app is a dashboard *for*. Confirmed from a sibling doc, `sql-hub/docs/PI_HUB_README.md`:
  "**Pi-Hub** is a **distributed service platform** that provides a unified ecosystem for
  database management, automation, and operational tooling" spanning SQL-Hub, Tool-Hub,
  automation/scheduling, and an operations layer. That platform runs on a physical Raspberry
  Pi host reachable at addresses like `192.168.68.115` (WiFi) / `192.168.68.57` (eth0), with
  services individually addressable as `<name>.pi-hub.local`.

This repo's own branding leans into the shared name — `index.html`'s `<title>` is "Pi-Hub",
and `useConfig.js`'s default `hubName` is `'Pi-Hub'` — so when reading code/docs here, "Pi-Hub"
in a UI string or default config usually means the fleet-branding sense, while "pi-hub" as a
repo/package/directory name means this frontend specifically.

## Ecosystem context

This is one project among sibling "hub" apps under `~/projects/` (sql-hub, tool-hub, dev-hub,
ai-hub, fin-hub, invest-hub, knowledge-hub, excalibur, jarvis-ui, derek-ui, ai-hub.ollama), each
an independent git repo / Docker Compose project. Standing fleet rule: **every hub is
self-contained and HTTP-only** — no shared/external Docker networks between projects;
cross-service calls go over published host ports (`host.docker.internal` for same-host,
`*.pi-hub.local` static hostnames for the remote Pi host). This repo's `docker-compose.yml` is
already compliant: a single service, no `networks:` entry pointing at another project, config
resolved entirely at the Nginx/static-asset level.

`src/config/services.js` — the app's central service registry — is the clearest evidence of
this: every entry's `url` is a plain `http://` address to a fleet sibling, e.g. `sql-hub` at
`http://192.168.68.115:1234`, `tool-hub` at `http://tool-hub.pi-hub.local`, plus
infrastructure/monitoring/AI-agent services (AdGuard, NGINX proxy, Portainer, Uptime Kuma,
Netdata, Beszel, speedtest tools, Open WebUI, n8n, PocketBase, and AI agents jarvis/derek/lois/
pepper/alfred at `*.ai.local`). No credentials or server-side proxying — all health checks are
plain client-side `fetch()` probes (`src/hooks/useHealthCheck.js`), which is only possible
because every target is a plain HTTP endpoint reachable from the browser.

DEV-Hub auto-logging/report-menu integration (the pattern documented in
`docs/READ-ME.dev-hub-logging.md`) was evaluated for this app on 2026-07-12 and explicitly
**skipped**: it assumes a backend process to watch log files and proxy DEV-Hub API calls, and
pi-hub has none (static frontend, nginx-served, settings in `localStorage`). Revisit only if
this app ever grows a backend service.

## Tech stack

- **React** 18.3, **Vite** 5.4 (`@vitejs/plugin-react`), CSS Modules per-component
  (`*.module.css`) — no CSS/UI framework.
- No state management library — component state + `localStorage` persistence via small custom
  hooks (`useConfig`, `useTheme`, `useWidgetConfig`, `useHealthCheck`) and a `LoggerContext`.
- Build/serve: multi-stage `Dockerfile` — `node:20-alpine` builds (`npm ci && npm run build`),
  then `nginx:1.27-alpine` serves the static `dist/` output with a hand-written `nginx.conf`.

## Repo structure

```
src/
  App.jsx                 — top-level layout/state orchestration (services, groups, active view,
                             modals: ManageServices, EditLayout, LogViewer, Settings)
  main.jsx                — React root mount
  version.js               — app version string shown in the sidebar
  components/              — Navbar, Sidebar, Dashboard, ServiceCard, ServiceConsole,
                             ManageServices, EditLayout, LogViewer, Settings, WidgetPanel,
                             WidgetEditor, WidgetPlaceholder, HealthPanel (+ .module.css each)
  config/
    services.js             — central service registry: id/label/icon/description/category/
                               group/status/url/links/healthChecks per fleet service
    groups.js                — sidebar groups: Infrastructure, Monitoring, AI & Agents, Data & Tools
  hooks/                    — useConfig, useHealthCheck, useTheme, useWidgetConfig
  context/LoggerContext.jsx — in-app log buffer (DEBUG/INFO/WARN/ERROR), feeds LogViewer
  styles/                   — index.css, themes.css (CSS custom properties, dark/light themes)
docs/                       — see "Docs map" below
Dockerfile, docker-compose.yml, nginx.conf, vite.config.js, index.html
```

State keys persisted to `localStorage`: `ph-services`, `ph-groups`, `ph-config`, `ph-theme`,
`ph-accent`, `ph-sidebar-open`, `ph-collapsed-groups`.

## Key config / ports

- **Dev server** (`vite.config.js`): port `3030`, `host: true` (listens on all interfaces).
- **Docker Compose** (`docker-compose.yml`): single `pi-hub` service, host port
  `31106` → container port `80` (nginx), bound to `0.0.0.0`. DNS pinned to
  `[192.168.68.115, 192.168.68.57, 1.1.1.1]` (Pi-Hub's AdGuard/NGINX resolver — WiFi primary,
  eth0 wired fallback, then public fallback) and IPv6 disabled
  (`sysctls: net.ipv6.conf.all.disable_ipv6=1`) — both added in a 2026-08-08 fleet-wide
  networking/DNS audit, no app code involved. A commented-out `pi-hub-dev` service in the same
  file documents (but does not itself provide — no `docker-compose.dev.yml` exists in this
  repo) an intended hot-reload override via
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`.
- **Nginx** (`nginx.conf`): SPA fallback (`try_files … /index.html`), long-cache immutable
  headers for static assets, gzip on.

## How to run / develop

From `package.json` scripts:

```
npm run dev       # vite dev server, port 3030
npm run build     # vite build -> dist/
npm run preview   # vite preview of the production build
```

Production deployment is via Docker: `docker compose up -d --build` builds the multi-stage
image and serves it on host port 31106.

## Testing

No test framework is configured — `package.json` has no `test` script and no
Jest/Vitest/Testing-Library dependency. There is currently no automated test suite for this
repo.

## Known quirks

- **Version-string sync**: `package.json`'s `"version"` and `src/version.js`'s exported
  `version` constant are two independent strings that must be bumped together by hand: a prior
  session found and fixed a real drift between them (docs/Bugs-Tracker.md, "stuck at 1.5.5 while
  the app reported 1.5.6"). At the time this file was written, `package.json` reports `1.5.10`
  while `src/version.js` reports `1.5.9` — worth checking (and syncing) before relying on either
  as ground truth for the current version.

## Docs map (`docs/`)

- `UI_MANIFEST.md` — full visual/design spec (layout, color tokens, typography, component
  inventory) intended to let an agent or developer reconstruct the UI from scratch.
- `Project-Tracker.md` — running session log of changes, current version, and history
  reconstructed from git log.
- `Bugs-Tracker.md`, `Features-Tracker.md` — **archived** pre-migration snapshots only; bug/
  feature/enhancement tracking moved to DEV-Hub on 2026-07-12 (DEV-Hub project id 24, bug ids
  89–91, feature ids 116–124). Use the `/create-bug`, `/update-bug`, `/create-feature`, etc.
  slash commands instead of editing these files — see `docs/dev-hub-sync.md`.
- `dev-hub-sync.md` — the general playbook (applies fleet-wide, not just here) for migrating a
  project's file-based tracking into DEV-Hub and the conventions for using it afterward.
- `READ-ME.dev-hub-logging.md` — playbook for adding DEV-Hub auto-logging / a "Report to
  DEV-Hub" menu to an app; evaluated and skipped for this repo (see Ecosystem context above).
- `BUG-FIX-PLAN.md` — a risk-ordered remediation checklist against DEV-Hub's then-open backlog
  for this project (15 bugs, 6 enhancements, 4 features at time of writing); does not itself
  modify code, and items should be checked against current DEV-Hub status before assuming any
  are still open.

---

## Claude Code — cross-project scope policy

- Claude Code working in this project may **modify only files inside this project's own
  directory** (`~/projects/<this-project>/`), or other locations explicitly documented
  elsewhere in this file as maintained by this project (e.g. a deploy target).
- Claude Code must **not modify files belonging to any other project** under `~/projects/`.
- Claude Code **may read** other projects' files freely (integration context, debugging
  cross-hub calls, etc.) — reading is always allowed; only writes are restricted.
- If a change in another project turns out to be necessary, don't make it directly from
  here. Instead, record what's needed (what, why, where) in that other project's
  `.claude/memory.md` (or `CLAUDE.md`) so Claude Code picks it up automatically the next
  time that project is opened — or flag it to the user to action themselves.
- This file (and `.claude/memory.md`, imported above) is read automatically at the start
  of every Claude Code session opened in this project.
