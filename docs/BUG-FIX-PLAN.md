# Pi-Hub — Bug/Enhancement/Feature Remediation Plan

**Purpose:** This is an execution checklist for working through every currently-open DEV-Hub
item (bugs, enhancements, features) for the `pi-hub` project, ordered risk-first. It was produced
by reading the DEV-Hub backlog dump alongside the current codebase at
`/home/dieter/projects/pi-hub` to ground each fix in real files/functions. It does not modify any
code.

**DEV-Hub status handling:** Statuses in DEV-Hub are intentionally left untouched by this
document. As you complete each item below, mark it done yourself via the `/update-bug`,
`/update-enhancement`, or `/update-feature` slash commands (per item type) — do not batch-update
at the end.

**Scope:** 15 bugs, 6 enhancements, 4 features = 25 items total, each appearing exactly once below.

---

## Phase 1 — Critical (security, data-loss, crashes/RCE)

### [BUG #155] Unhandled JSON.parse crashes app on corrupted localStorage
- **Root cause:** `src/App.jsx` lines 27–36 call `JSON.parse(localStorage.getItem(...))` directly
  for `ph-services`, `ph-groups`, `ph-sidebar-open` with no try/catch — unlike
  `src/hooks/useConfig.js` (`load()`, wrapped in try/catch) and `src/hooks/useWidgetConfig.js`
  (`load()`, also wrapped). There is no ErrorBoundary anywhere (`grep -r ErrorBoundary src`
  returns nothing, confirmed), so any malformed value in those three keys throws during initial
  render and produces a permanent blank white screen with no recovery path.
- **Fix approach:**
  1. Add a small `safeParse(key, fallback)` helper (mirroring the try/catch pattern already used
     in `useConfig.js`/`useWidgetConfig.js`) and use it for the three `useState` initializers at
     `src/App.jsx` lines 27–36.
  2. Add a top-level `ErrorBoundary` component (new file, e.g. `src/components/ErrorBoundary.jsx`)
     and wrap `<App />` with it in `src/main.jsx` so any future unexpected render-time throw shows
     a recoverable message instead of a blank page.
- **Files likely touched:** `src/App.jsx`, `src/main.jsx`, new `src/components/ErrorBoundary.jsx`.
- **Verification:** In devtools, run `localStorage.setItem('ph-services', '{bad json')` then
  reload — app should render (empty/default service list or a friendly error), not a blank page.
  Repeat for `ph-groups` and `ph-sidebar-open`. Then clear localStorage and confirm normal boot
  still works.

### [BUG #157] Adding a service/group with a duplicate label collides IDs
- **Root cause:** `src/App.jsx` `handleAddService` (lines 64–67) and `handleAddGroup` (lines
  78–81) derive new IDs purely from `slugify(label)` with no uniqueness check against existing
  `services`/`groups` IDs. Adding a service labeled "AdGuard" a second time produces `id:
  'adguard'`, colliding with the built-in `adguard` entry in `src/config/services.js`; subsequent
  `handleEditService`/`handleDeleteService` (which match on `s.id === id`) then silently mutate or
  delete both entries together, and React list keys (`key={service.id}` in
  `src/components/Sidebar.jsx` and `src/components/ManageServices.jsx`) become non-unique.
- **Fix approach:** In `handleAddService`/`handleAddGroup` (`src/App.jsx` lines 64–81), after
  slugifying, check the result against `services.map(s => s.id)` / `groups.map(g => g.id)` and, on
  collision, append a numeric suffix (`adguard-2`, `adguard-3`, …) until unique. Apply the same
  helper to both functions to avoid duplicating the loop logic.
- **Files likely touched:** `src/App.jsx`.
- **Verification:** Via Manage Services, add a new service labeled exactly "AdGuard". Confirm it
  gets a distinct id (check React DevTools or the generated `href`/console URL), and that deleting
  the new one does not remove the built-in AdGuard entry (and vice versa). Repeat for a duplicate
  group label in Edit Layout.

---

## Phase 2 — Functional correctness

### [BUG #159] Health refresh interval/timeout/local-domain settings are stored but never applied
- **Root cause:** `src/components/Settings.jsx` exposes fully editable "Auto-refresh interval" /
  "Request timeout" controls (lines 76–102, backed by `REFRESH_OPTIONS`/`TIMEOUT_OPTIONS` from
  `src/hooks/useConfig.js`) and a "Local Domain" field (lines 60–67), and `useConfig`
  persists them to `ph-config` correctly. But `src/hooks/useHealthCheck.js` line 3 hardcodes
  `const TIMEOUT_MS = 6000` (never reads `config.healthTimeoutMs`), and
  `src/components/Dashboard.jsx` hardcodes `setInterval(run, 30000)` in both
  `ServiceCardWithHealth` (line 127) and `ServiceDetail` (line 168) — `config.healthRefreshMs` is
  never read anywhere. `config.hostname`/`config.localDomain` are only read in
  `src/components/Navbar.jsx` for display; nothing consults `localDomain` when building service
  URLs. The whole "Health Monitoring" settings section is decorative.
- **Fix approach:**
  1. Thread `config` (from `useConfig()` in `src/App.jsx`) down into `Dashboard` as a prop, and
     from there into `useHealthCheck`.
  2. In `src/hooks/useHealthCheck.js`, accept a `timeoutMs` param (default 6000) instead of the
     module-level constant, and use it in `probe()`'s `setTimeout`.
  3. In `src/components/Dashboard.jsx`, replace both hardcoded `setInterval(run, 30000)` calls with
     `config.healthRefreshMs` — and treat `0` ("Off" in `REFRESH_OPTIONS`) as "don't poll" (skip
     `setInterval` entirely).
  4. Decide + implement how `localDomain` is meant to compose service URLs (currently every
     service in `src/config/services.js` hardcodes a full `http://x.pi-hub.local` URL) — likely
     out of scope for a pure bug fix unless `localDomain` is meant to just override the display
     suffix; at minimum, wire the two numeric settings (refresh/timeout) since those are
     unambiguous, and flag the `localDomain` semantics decision to the user/PM if unclear.
- **Files likely touched:** `src/App.jsx`, `src/components/Dashboard.jsx`,
  `src/hooks/useHealthCheck.js`, `src/components/Settings.jsx` (if wiring needs prop changes).
- **Verification:** Set "Auto-refresh interval" to 15s in Settings, open a service detail page,
  and confirm (via Network tab timestamps or added logger output) checks now run every 15s, not
  30s. Set timeout to 3s and confirm a slow/unreachable URL times out around 3s, not 6s.

### [BUG #103] Side-bar menu not displaying new categories
- **Note:** The original DEV-Hub entry has no description/file:line evidence — this root cause is
  a hypothesis from reading the current code; verify via manual repro before implementing.
- **Root cause (hypothesis):** The app has two distinct grouping concepts that this ticket's
  title conflates: `group` (drives `src/components/Sidebar.jsx` navigation grouping, editable via
  "Edit Layout") and `category` (drives `src/components/Dashboard.jsx` `DashboardOverview`
  section grouping, documented in `docs/UI_MANIFEST.md` §7–8). `src/components/ManageServices.jsx`
  `ServiceForm`'s `EMPTY_FORM` (line 4) and all its input fields (lines 138–236) have **no
  Category field at all** — only `icon, label, description, url, dashboardUrl, homeUrl, adminUrl,
  group, status, links`. So any service added or edited through the UI can never get a
  `category` value, meaning it always falls into the "Other" bucket in
  `DashboardOverview` (`src/components/Dashboard.jsx` line 63 `uncategorised`) and can never
  populate/create a new category section — which likely reads to the reporter as "new
  categories don't show up." Separately, `src/components/Sidebar.jsx` line 63
  (`groupedServices = groups.map(...).filter(g => g.items.length > 0)`) hides any sidebar group
  with zero assigned services, which could also look like "new category not displaying" if the
  reporter meant sidebar groups.
- **Fix approach:**
  1. Reproduce first: add a new group in Edit Layout and confirm whether it appears in the
     sidebar before/after a service is assigned (tests the `groupedServices` filter theory), and
     separately try to get a new *category* value onto a service via Manage Services (tests the
     missing-field theory).
  2. If the missing Category field is the issue: add a `category` text/select input to
     `ServiceForm` in `src/components/ManageServices.jsx` (near the `group` select, lines 211–223),
     matching the `Service Object` schema documented in `docs/UI_MANIFEST.md` §7.
  3. If the sidebar-group-hiding-when-empty behavior is the real complaint: change the filter at
     `src/components/Sidebar.jsx` line 63 to show empty groups too (or show a "no services yet"
     placeholder row) so a newly created group is visible immediately.
- **Files likely touched:** `src/components/ManageServices.jsx`, `src/components/Sidebar.jsx`.
- **Verification:** After the fix, add a new service via Manage Services, set a brand-new category
  (or group), save, and confirm it renders as a new section on the Dashboard overview (for
  category) and/or a new entry in the sidebar (for group) without needing a page reload.

### [ENH #151] No confirmation before destructive delete actions (services/groups)
- **Root cause:** `src/components/ManageServices.jsx` `ServiceRow`'s `onDelete` prop is wired
  directly to `() => onDelete(service.id)` (around line 75) and fires immediately on click;
  `src/components/EditLayout.jsx` line 138 wires `onDeleteGroup` the same way. Deleting a group
  also silently reassigns all its services to ungrouped via `handleDeleteGroup` in
  `src/App.jsx` (lines 87–90). No "are you sure?" step exists, so a misclick permanently loses
  configuration with no undo.
- **Fix approach:** Add a small reusable confirm step — either a native `window.confirm(...)` for
  a minimal fix, or a lightweight `ConfirmDialog` component for a nicer UX — and gate both
  `onDelete` in `ServiceRow` (`src/components/ManageServices.jsx`) and `onDeleteGroup` in
  `src/components/EditLayout.jsx` (line 138) behind it. For group deletion, the confirm copy
  should mention that member services will become ungrouped, not just "delete this group?".
- **Files likely touched:** `src/components/ManageServices.jsx`, `src/components/EditLayout.jsx`,
  optionally a new shared `src/components/ConfirmDialog.jsx`.
- **Verification:** Click delete on a service/group and confirm a confirmation step now appears;
  cancelling leaves data untouched; confirming deletes as before. Confirm group-delete copy
  mentions service reassignment.

### [ENH #153] Health checks use mode:'no-cors', so they can't distinguish reachable from actually healthy
- **Root cause:** `src/hooks/useHealthCheck.js` line 10,
  `fetch(url, { method, mode: 'no-cors', signal })`, always yields an opaque response (`status
  0`, not readable) as long as the network round-trip completes — even if the target returns
  404/500/etc. `probe()` (lines 5–18) only distinguishes `online` (fetch resolved) / `timeout`
  (AbortError) / `offline` (any other throw), so a service that's up but erroring reports
  "online," defeating the point of health checks for exactly the failure modes users want caught.
- **Fix approach:** This is a fundamental limitation of `no-cors` opaque responses (can't read
  `response.status` cross-origin without CORS headers on the target). Options, roughly in order
  of effort: (1) document the limitation clearly in the UI (e.g. relabel "online" as "reachable");
  (2) for services known to send CORS headers, drop `no-cors` and read the real status; (3) add an
  optional per-service "strict health check" opt-in (via a new `healthChecks.strict` flag in
  `src/config/services.js`) that omits `mode: 'no-cors'` and treats non-2xx as `offline`. Start
  with (1) since it's zero-risk, then evaluate (2)/(3) per-service since most self-hosted dashboards
  here (Portainer, Uptime Kuma, etc.) don't emit permissive CORS headers by default.
- **Files likely touched:** `src/hooks/useHealthCheck.js`, `src/components/HealthPanel.jsx` /
  `src/components/WidgetPanel.jsx` (status labels), `src/config/services.js` (if adding a strict
  flag).
- **Verification:** Point a custom health check at a URL that reliably returns a 404/500 (e.g. a
  throwaway endpoint) and confirm the health UI no longer reports "online" for it once the fix
  lands (or, if only relabeled, confirm the label change is accurate and non-misleading).

### [BUG #104] Portainer does not open in console
- **Note:** Original DEV-Hub entry has no description/file:line evidence. Root cause below is a
  hypothesis shared with BUG #105/#106/#107 — verify via manual repro before starting.
- **Root cause (hypothesis):** `src/components/ServiceConsole.jsx` embeds the service via
  `<iframe src={activeTabData.url} onLoad={handleLoad} onError={handleError}>` (lines 105–113) and
  only shows the "may be blocking embedded display (X-Frame-Options)" banner when `onError` fires.
  Browsers do **not** reliably fire an iframe `error` event when a load is blocked by
  `X-Frame-Options`/CSP `frame-ancestors` — it's a silent, network-level refusal, not a JS-visible
  error — so the loading spinner (`loading` state, never resolves) or a blank frame is what the
  user actually sees, reading as "does not open." Portainer ships `X-Frame-Options: SAMEORIGIN` by
  default, which is not `pi-hub`'s origin, so embedding is genuinely blocked at the HTTP layer —
  no frontend fix can force it to render inside pi-hub's iframe.
- **Fix approach:**
  1. Confirm via browser devtools (Network/Console tab while opening Portainer's console) that the
     response headers include `X-Frame-Options` or a restrictive `Content-Security-Policy:
     frame-ancestors`.
  2. Since this can't be bypassed client-side, add a load timeout in
     `src/components/ServiceConsole.jsx` (e.g. if `onLoad` hasn't fired within ~4s, assume blocked
     and show the existing error banner instead of an indefinite spinner) — this at least turns a
     silent hang into an actionable message for every affected service, not just Portainer.
  3. Set `embeddable: false` for `portainer` in `src/config/services.js` (mirroring the existing
     `adguard` entry) so the "Open Console" button doesn't appear at all and users go straight to
     "Open in Browser," matching reality.
  4. Expose the existing `embeddable` field in `src/components/ManageServices.jsx`'s `ServiceForm`
     (currently unsettable from the UI at all) so users can mark their own non-embeddable services
     without editing source.
- **Files likely touched:** `src/components/ServiceConsole.jsx`, `src/config/services.js`,
  `src/components/ManageServices.jsx`.
- **Verification:** After adding the load-timeout fallback, opening Portainer's console should
  show the "blocking embedded display" banner within a few seconds instead of hanging; after
  setting `embeddable: false`, the "Open Console" button should no longer appear for Portainer at
  all (only "Open in Browser").

### [BUG #105] Uptime-Kuma does not open in console
- **Note:** Same root-cause family as BUG #104 — no original description/evidence; verify before
  starting.
- **Root cause (hypothesis):** Same as BUG #104: Uptime Kuma sends `X-Frame-Options` /
  `frame-ancestors` restrictions by default, and `src/components/ServiceConsole.jsx`'s
  `onError`-only detection (lines 105–113) doesn't reliably catch that class of block, so the
  console appears to hang rather than surfacing the existing error banner.
- **Fix approach:** Apply the same load-timeout fallback in `src/components/ServiceConsole.jsx`
  described in BUG #104 (shared fix, implement once). Then decide per-service: if Uptime Kuma
  confirms blocked, set `embeddable: false` for `uptime-kuma` in `src/config/services.js`.
- **Files likely touched:** `src/components/ServiceConsole.jsx`, `src/config/services.js`.
- **Verification:** Same as BUG #104, run against the Uptime Kuma service entry specifically.

### [BUG #106] Bezel does not open in console
- **Note:** Same root-cause family as BUG #104 — no original description/evidence; verify before
  starting. (Ticket title says "Bezel"; the matching entry in `src/config/services.js` is `id:
  'beszel', label: 'Beszel'` — confirm this is the intended target, not a typo for a different
  service.)
- **Root cause (hypothesis):** Same detection gap as BUG #104/#105 in
  `src/components/ServiceConsole.jsx`; whether Beszel itself sends frame-blocking headers needs to
  be confirmed directly (unlike Portainer/Uptime Kuma this is less universally documented).
- **Fix approach:** Reproduce first by opening the Beszel console and checking response headers
  in devtools. Apply the shared load-timeout fallback (see BUG #104) regardless, since it improves
  the failure UX either way. If Beszel indeed blocks framing, set `embeddable: false` for `beszel`
  in `src/config/services.js`; if it does *not* block framing, this ticket may have a different
  root cause (e.g. a wrong `url` value) — check `src/config/services.js` line ~108 for a stale/
  incorrect `url`.
- **Files likely touched:** `src/components/ServiceConsole.jsx`, `src/config/services.js`.
- **Verification:** Confirm whether the console now shows the blocked-embed banner (if blocked) or
  loads successfully (if the fix was a URL correction).

### [BUG #107] N8N does not open in console
- **Note:** Same root-cause family as BUG #104 — no original description/evidence; verify before
  starting.
- **Root cause (hypothesis):** n8n sends `X-Frame-Options: SAMEORIGIN` by default (documented n8n
  behavior), so same detection gap in `src/components/ServiceConsole.jsx` applies.
- **Fix approach:** Apply the shared load-timeout fallback from BUG #104. If confirmed blocked,
  set `embeddable: false` for `n8n` in `src/config/services.js`.
- **Files likely touched:** `src/components/ServiceConsole.jsx`, `src/config/services.js`.
- **Verification:** Same pattern as BUG #104/#105, run against the N8N service entry.

### [BUG #156] Sidebar group collapse state is written to localStorage but never read back
- **Root cause:** `src/App.jsx`'s `collapsedGroups` `useState` initializer (lines 37–42) derives
  a fresh `Set` from `ph-groups`/`initialGroups` on every load (defaulting **every** group to
  collapsed), while a separate effect (line 47) persists the live `collapsedGroups` `Set` under
  key `'ph-collapsed-groups'` on every change. That key is written but never read anywhere — dead
  data — so every group is forced collapsed on every page load/refresh regardless of what the user
  last had open.
- **Fix approach:** Change the `collapsedGroups` initializer (`src/App.jsx` lines 37–42) to read
  back from `'ph-collapsed-groups'` (with a safe-parse fallback per BUG #155's fix) instead of
  deriving a fresh all-collapsed `Set` from `ph-groups`/`initialGroups`. Fall back to
  all-collapsed (or all-expanded — confirm desired default with the user) only when
  `'ph-collapsed-groups'` has never been written.
- **Files likely touched:** `src/App.jsx`.
- **Verification:** Expand a group in the sidebar, reload the page, confirm it stays expanded.
  Collapse a different group, reload, confirm it stays collapsed.

### [BUG #158] 'DNS Resolve' health check doesn't test DNS — duplicates the ping check
- **Root cause:** `src/hooks/useHealthCheck.js` lines 81–87 (ping) and 90–96 (dns) both call
  `probe(svc.url, 'HEAD')` with the identical `svc.url`; `hostFromUrl(svc.url)` (line 20) is only
  used for the log/display label at line 91, never actually passed to `probe()`. The "DNS Resolve"
  check is presented as a distinct diagnostic but performs the exact same fetch as "IP Ping" and
  always reports identical status/latency — no real DNS-resolution signal.
- **Fix approach:** Either (a) implement an actual DNS-only signal — genuinely hard from a browser
  sandbox without a backend DNS-over-HTTPS call, so likely means adding a small
  `fetch('https://dns.google/resolve?name=' + host)`-style check (requires network egress the Pi
  may or may not have) — or (b) more realistically, relabel/remove the redundant "DNS Resolve"
  check since it can't be meaningfully distinguished from ping in a pure frontend, updating
  `src/hooks/useHealthCheck.js` (remove the `dns` key from `initResults`/`run`) and all consumers
  (`src/components/HealthPanel.jsx` `CheckCard` for "DNS Resolve", `src/components/WidgetPanel.jsx`
  `HealthChecksWidget`'s `items` array). Recommend (b) as the pragmatic fix; flag (a) to the user
  if a real DNS check is actually wanted.
- **Files likely touched:** `src/hooks/useHealthCheck.js`, `src/components/HealthPanel.jsx`,
  `src/components/WidgetPanel.jsx`.
- **Verification:** After the fix, confirm the health panel/widget no longer shows a "DNS Resolve"
  row that mirrors "IP Ping" 1:1 (either it's gone, or it now reflects a genuinely different
  check/result).

### [BUG #160] In-flight health-check fetches are not cancelled on component unmount
- **Root cause:** `probe()` in `src/hooks/useHealthCheck.js` (lines 5–18) creates an
  `AbortController` that only fires after a fixed 6s timeout (`setTimeout(() =>
  controller.abort(), TIMEOUT_MS)`), never tied to component lifecycle. The polling `useEffect`s in
  `src/components/Dashboard.jsx` — `ServiceCardWithHealth` (lines 125–129) and `ServiceDetail`
  (lines 165–170) — only `clearInterval` on unmount; they don't abort any fetch already in flight.
  Navigating away mid-check leaves the fetch running and its `.then()` calling `setResults` on an
  unmounted component — a resource leak, worse with 18 services polling every 30s on constrained
  Pi hardware.
- **Fix approach:** In `useHealthCheck` (`src/hooks/useHealthCheck.js`), track an `AbortController`
  per in-flight `run()` call in a ref, and expose a cleanup that aborts it; call that cleanup from
  the `useEffect` returns in both `ServiceCardWithHealth` and `ServiceDetail`
  (`src/components/Dashboard.jsx`) alongside the existing `clearInterval`. Simplest approach: have
  `run()` accept/create its own controller stored in a ref, and return an abort function from the
  hook that the two `useEffect` cleanups call.
- **Files likely touched:** `src/hooks/useHealthCheck.js`, `src/components/Dashboard.jsx`.
- **Verification:** In devtools, throttle network to "Slow 3G," open a service detail page, then
  quickly navigate away before the check resolves. Confirm (via a temporary `console.log` or the
  Network tab's "canceled" status) that the in-flight request is aborted rather than completing
  and silently calling `setResults` after unmount (React 18 will not warn about this the way React
  17 did, so rely on the Network tab / AbortController check, not console warnings).

### [ENH #152] Dead 'Refresh' and 'Add Panel' buttons on the Dashboard
- **Root cause:** `src/components/Dashboard.jsx` line 26 (`<button
  className={styles.btn}>Refresh</button>`) and line 46 (`<button className={...}>＋ Add
  Panel</button>`) render with no `onClick` handler at all — visually present but completely
  inert.
- **Fix approach:** Wire "Refresh" to re-run the active health checks — likely by lifting a
  `refresh()` callback out of `useHealthCheck` (or exposing the existing `run` from
  `ServiceCardWithHealth`/`ServiceDetail`) up to the page header button. Wire "＋ Add Panel" to
  open `WidgetEditor` (already used elsewhere in `ServiceDetail`, `src/components/Dashboard.jsx`
  line 190) or a dashboard-level equivalent for adding a new widget/panel to the overview. If
  "Add Panel" has no defined target behavior yet, treat it as a stub for FEAT #156/#155 and note
  that dependency rather than guessing at scope.
- **Files likely touched:** `src/components/Dashboard.jsx`, possibly
  `src/hooks/useHealthCheck.js`, `src/components/WidgetEditor.jsx`.
- **Verification:** Click "Refresh" on a service detail page and confirm health checks visibly
  re-run (spinner/log entry). Click "＋ Add Panel" and confirm some panel-adding UI now opens
  instead of nothing happening.

---

## Phase 3 — Hardening & cleanup

### [ENH #154] No automated tests, lint config, or CI
- **Root cause:** `package.json` only defines `dev`/`build`/`preview` scripts (confirmed — no
  `test`/`lint` scripts); no `*.test.*`/`*.spec.*` files and no `.eslintrc*`/`eslint.config.*`
  exist anywhere in the repo (confirmed via repo-wide search). Non-trivial state logic
  (drag-and-drop reordering in `src/components/Sidebar.jsx`, localStorage persistence in
  `src/App.jsx`, health-check polling in `src/hooks/useHealthCheck.js`) has zero coverage, which is
  exactly how bugs like #156 (collapsed-groups) and #157 (duplicate IDs) went unnoticed.
- **Fix approach:** Add a minimal toolchain rather than a big-bang rewrite: (1) add `eslint` +
  `eslint-plugin-react-hooks` with a flat config (`eslint.config.js`) matching Vite's React
  template defaults, plus a `"lint"` script in `package.json`; (2) add `vitest` +
  `@testing-library/react` and a `"test"` script; (3) start with targeted unit tests for the
  highest-risk logic: `slugify`/ID-uniqueness in `src/App.jsx` (BUG #157), the
  `collapsedGroups` read/write round-trip (BUG #156), and `useHealthCheck`'s abort-on-unmount
  behavior (BUG #160) once fixed. Do this after the bugs above land so tests encode the *fixed*
  behavior, not the current bugs.
- **Files likely touched:** `package.json`, new `eslint.config.js`, new `vitest.config.js`, new
  `src/**/*.test.jsx` files.
- **Verification:** `npm run lint` and `npm run test` both run and pass (or fail only on
  pre-existing issues you intentionally haven't fixed yet); at least the 3 targeted tests above
  exist and pass against the post-fix code.

### [BUG #164] Hardcoded data-theme="dark" causes a flash of wrong theme for light/system users
- **Root cause:** `index.html` line 2 ships `<html data-theme="dark">` baked in at parse time, and
  `src/hooks/useTheme.js`'s theme-apply `useEffect` (lines 42–48) only runs after React mounts and
  first paint completes. Users who chose `'light'` (or `'system'` on a light OS) see a brief flash
  of dark theme on every full page load/refresh.
- **Fix approach:** Add a tiny inline `<script>` in `index.html` (before the stylesheet/root div,
  synchronous, blocking) that reads `localStorage.getItem('ph-theme')` (and
  `matchMedia('(prefers-color-scheme: light)')` for `'system'`) and sets `data-theme` on
  `<html>` immediately — the same pattern `useTheme.js`'s `resolveTheme`/`applyTheme` already
  implement, just needs to run pre-paint instead of in a `useEffect`.
- **Files likely touched:** `index.html`, `src/hooks/useTheme.js` (keep in sync, avoid duplicate
  logic drift — consider extracting the resolve logic to a small shared snippet/comment noting the
  two copies must match).
- **Verification:** Set theme to "Light" in Settings, hard-reload (Ctrl+Shift+R) several times,
  and visually confirm no dark flash before the light theme applies. Repeat with "System" while OS
  is set to light mode.

### [BUG #161] LoggerContext value re-creates on every log entry, causing app-wide re-renders
- **Root cause:** `src/context/LoggerContext.jsx` lines 32–41,
  `useMemo(() => ({...}), [logs, minLevel, addLog])`, lists `logs` as a dependency, and `logs`
  changes on every `addLog` call (line 22, `setLogs(prev => [...])`). Since health checks alone log
  twice per service every 30s across all services (`src/hooks/useHealthCheck.js` `run()`
  logger calls), every emission creates a brand-new context value, re-rendering every
  `useLogger()` consumer app-wide — an avoidable cost on low-power Pi hardware.
- **Fix approach:** Remove `logs` from the memoized `value` object's dependency array by splitting
  concerns: keep `logs` in its own context (or a ref + subscription pattern) separate from the
  stable action functions (`debug/info/warn/error/clear`), so components that only need to *call*
  logger methods (most of the app) don't re-render when `logs` changes — only `LogViewer.jsx`
  (which actually displays `logs`) should re-render on new entries.
- **Files likely touched:** `src/context/LoggerContext.jsx`, `src/components/LogViewer.jsx` (may
  need to consume a second context/selector for `logs`).
- **Verification:** Add a temporary render-count log (or use React DevTools Profiler) in an
  unrelated component (e.g. `Navbar`) while health checks are running; confirm it no longer
  re-renders every ~15s purely from log emissions after the fix.

### [BUG #162] HealthPanel.jsx is imported but never rendered — dead component out of sync with docs
- **Root cause:** `src/components/Dashboard.jsx` line 2 imports `HealthPanel`, but
  `ServiceDetail` (lines 148–200) renders `WidgetPanel`/`WidgetEditor` instead — `<HealthPanel>` is
  never actually used (confirmed: `grep -rn "<HealthPanel" src` only matches its own definition
  file, not `Dashboard.jsx`). `docs/UI_MANIFEST.md` §6.3 still documents `HealthPanel` as the live
  body for service detail pages, which is stale since the widget-based dashboard replaced it with
  `WidgetPanel`'s `HealthChecksWidget`.
- **Fix approach:** Remove the unused `import HealthPanel from './HealthPanel.jsx'` at
  `src/components/Dashboard.jsx` line 2. Decide whether `HealthPanel.jsx`/`.module.css` should be
  deleted outright (if `WidgetPanel`'s `HealthChecksWidget` fully supersedes it) or kept as an
  alternate/legacy view — if deleting, also remove `src/components/HealthPanel.jsx` and
  `HealthPanel.module.css`. Update `docs/UI_MANIFEST.md` §6.3 to describe the actual current
  `WidgetPanel`-based body instead of `HealthPanel`.
- **Files likely touched:** `src/components/Dashboard.jsx`, `src/components/HealthPanel.jsx`,
  `src/components/HealthPanel.module.css`, `docs/UI_MANIFEST.md`.
- **Verification:** `npm run build` succeeds with no unused-import warnings for `HealthPanel` in
  `Dashboard.jsx`; `docs/UI_MANIFEST.md` §6.3 now matches what actually renders on a service detail
  page.

### [BUG #163] docker-compose dev override port doesn't match vite.config.js
- **Root cause:** `docker-compose.yml`'s commented-out `pi-hub-dev` service (lines 11–21) maps
  `0.0.0.0:31106:31106`, per the documented port change in `docs/Project-Tracker.md`
  ("container port mapping changed from `3030:80` to `0.0.0.0:31106:80`"), but
  `vite.config.js` line 7 still hardcodes `server.port: 3030`. If a developer uncomments the
  dev-compose service and runs `npm run dev` inside it, Vite listens on 3030 while Docker only
  forwards 31106, making the dev server unreachable from the host.
- **Fix approach:** Either change `vite.config.js` line 7 to `port: 31106` to match the documented
  Docker port mapping, or change the commented `pi-hub-dev` port mapping in `docker-compose.yml`
  (lines 11–21) to `31106:3030` (host:container) — pick whichever port convention the team
  actually wants going forward and make both files agree. Given `docs/Project-Tracker.md` frames
  31106 as the deliberate new host-facing port, the simpler fix is likely updating
  `vite.config.js` to `31106` so both the prod nginx mapping and the dev override agree on one
  number end-to-end.
- **Files likely touched:** `vite.config.js`, `docker-compose.yml`.
- **Verification:** Uncomment the `pi-hub-dev` service in `docker-compose.yml`, run `docker compose
  -f docker-compose.yml up pi-hub-dev` (or per the comment's instructions), and confirm the app is
  reachable at `http://localhost:31106` from the host.

### [ENH #156] Duplicated health-polling/latency-history logic between ServiceCardWithHealth and ServiceDetail
- **Root cause:** `src/components/Dashboard.jsx`'s `ServiceCardWithHealth` (lines 110–145) and
  `ServiceDetail` (lines 148–200) each independently implement the same pattern: a 30-item
  latency-history ring buffer via `historyRef`/`useState` and a 30-second `setInterval(run, 30000)`
  polling `useEffect`. Drift risk: BUG #159's fix (configurable interval) and BUG #160's fix
  (abort-on-unmount) both need to land in two places instead of one if this isn't deduplicated
  first.
- **Fix approach:** Extract a shared `useServiceLatencyHistory(service, config)` hook (new file,
  e.g. `src/hooks/useServiceLatencyHistory.js`) that wraps `useHealthCheck`, owns the ring-buffer
  ref/state, and owns the polling `useEffect` (including the BUG #160 abort-on-unmount fix and the
  BUG #159 configurable-interval fix). Have both `ServiceCardWithHealth` and `ServiceDetail` call
  the new hook instead of duplicating the logic. Sequence this **after** BUG #159/#160 land so the
  extraction captures the fixed behavior once, not the buggy behavior twice.
- **Files likely touched:** new `src/hooks/useServiceLatencyHistory.js`,
  `src/components/Dashboard.jsx`.
- **Verification:** After extraction, confirm both the dashboard overview cards and a service
  detail page still show live latency data/sparklines identically to before, and that changing the
  refresh interval in Settings (BUG #159) affects both consistently.

### [ENH #155] Sidebar drag-and-drop reordering has no keyboard-accessible alternative
- **Root cause:** `src/components/Sidebar.jsx`'s `DragWrapper` (lines 7–29) exposes reordering
  only via native `draggable`/`onDragStart`/`onDragOver`/`onDrop` handlers — no keyboard
  shortcuts, up/down move buttons, or ARIA drag-and-drop semantics (e.g. `aria-grabbed`,
  `aria-dropeffect`, or the modern `aria-roledescription` pattern), making layout management
  unusable for keyboard-only or screen-reader users.
- **Fix approach:** Add a keyboard-operable alternative alongside the existing mouse DnD: e.g. a
  focus-visible "reorder" mode per `NavItem` (`src/components/Sidebar.jsx` lines 228–239) with
  Up/Down arrow-key handlers calling the existing `onReorderService`/`onMoveServiceToGroup`
  callbacks (already passed down from `src/App.jsx`), or simpler up/down icon buttons shown on
  focus/hover that call the same handlers. Add appropriate `aria-label`s describing the action
  ("Move AdGuard up").
  callbacks so no new state-management logic is needed — only new UI affordances.
- **Files likely touched:** `src/components/Sidebar.jsx`, `src/components/Sidebar.module.css`.
- **Verification:** Tab to a sidebar service item using only the keyboard, trigger the new
  reorder controls, and confirm the service moves in the list the same way a drag would, with no
  mouse involved. Spot-check with a screen reader (e.g. VoiceOver/NVDA) that the action is
  announced.

### [FEAT #145] Background monitoring for real monitoring
- **Note:** DEV-Hub entry title is garbled ("Backg ground monitoring for real monitoring") and has
  no description — treat the scope below as a best-effort interpretation; confirm actual intent
  with the user/PM before implementing, since this could mean several different things.
- **Root cause / gap (hypothesis):** Today, health-check polling only runs while a
  `ServiceCardWithHealth` or `ServiceDetail` component is mounted (`src/components/Dashboard.jsx`
  `useEffect`s at lines 125–129 / 165–170) — navigate away, and polling for that service stops
  entirely; close the tab, and all monitoring stops. "Real"/background monitoring likely means
  status should be tracked centrally (e.g. lifted into `src/App.jsx` or a new context/provider) so
  it continues regardless of which view is active, rather than being scoped to whichever
  card/detail page happens to be rendered.
- **Fix approach:** After BUG #160 (abort-on-unmount) and ENH #156 (shared polling hook) land,
  consider lifting health-check polling out of per-card/per-detail components into a single
  top-level provider (e.g. `src/context/HealthContext.jsx`) that polls all services once,
  centrally, and lets any component subscribe to results — this is the natural foundation for
  "real" background monitoring within a single open tab. True cross-tab/closed-tab background
  monitoring would require a Service Worker or a backend process, which is a much bigger
  architectural change (`docs/Project-Tracker.md` already notes pi-hub is currently a pure
  static frontend with no backend) — flag that distinction to the user before committing to scope.
- **Files likely touched:** new `src/context/HealthContext.jsx`, `src/App.jsx`,
  `src/components/Dashboard.jsx`, `src/hooks/useHealthCheck.js`.
- **Verification:** With the centralized approach, navigate between the dashboard overview and a
  service detail page and confirm health-check results persist/continue rather than resetting or
  pausing per view. Clarify with the user whether cross-session/backend monitoring is actually in
  scope before building it.

### [FEAT #155] Entire 'Phase 2' widget placeholder system is built but completely unwired
- **Root cause:** `src/components/WidgetPlaceholder.jsx` implements a full set of shimmer/skeleton
  widgets (`StatWidget`, `BarWidget`, `ChartWidget`, `GridWidget`, `ListWidget`, each tagged with a
  `PhaseBadge` reading "Phase 2") plus co-located CSS, but `grep -rn "WidgetPlaceholder" src`
  confirms nothing imports it anywhere else in the app — not even
  `src/components/WidgetPanel.jsx`, which implements a separate, smaller set of widget types
  (`health-checks`, `latency-chart`, `uptime-grid`, `stat-latency`, `status-badge` — see
  `WidgetRenderer` switch, lines 22–35). Dead code with no path to being reached by a user.
- **Fix approach:** Decide product direction first (this is the actual blocker, not effort): (a)
  wire `WidgetPlaceholder` types into `WidgetPanel.jsx`'s `WidgetRenderer` switch as real
  selectable widget types (likely tied to FEAT #156's category→widget mapping work), or (b) if
  the placeholder system is superseded by `WidgetPanel`'s simpler widgets, delete
  `src/components/WidgetPlaceholder.jsx` + its CSS module to stop it drifting further from reality.
  Given `docs/UI_MANIFEST.md` §8 documents category-aware widgets that align with what
  `WidgetPlaceholder` was clearly built for, (a) is likely the intended direction — implement
  alongside FEAT #156.
- **Files likely touched:** `src/components/WidgetPanel.jsx`, `src/components/WidgetPlaceholder.jsx`
  (either wired in or deleted), `src/components/WidgetEditor.jsx` (to let users add the new types).
- **Verification:** If wired in: confirm at least one `WidgetPlaceholder` type is selectable via
  `WidgetEditor` and renders on a service detail page. If deleted: confirm `npm run build` succeeds
  and no remaining references exist (`grep -rn "WidgetPlaceholder" src` returns nothing).

### [FEAT #156] Category → Widget mapping documented but not implemented
- **Root cause:** `docs/UI_MANIFEST.md` §8 documents a "Service Category → Widget Mapping" table
  (e.g. `security` → DNS Queries/Blocked/Query Log; `system` → CPU/Memory/Disk/Temperature), and
  `src/config/services.js` reserves a `category` field per service specifically for this (per its
  header comment, "drives monitoring widget layout"). But `src/components/WidgetPanel.jsx`'s
  `WidgetRenderer` switch (lines 22–35) only implements 5 generic, category-agnostic widget types;
  `category` is otherwise only used for Dashboard grouping/badges
  (`src/components/Dashboard.jsx` lines 21–22, 62–73), never to select widget content.
- **Fix approach:** This is a substantial feature build, not a small fix — implement incrementally
  per category from `docs/UI_MANIFEST.md` §8's table, starting with the categories that have
  live services (`security`/AdGuard, `system`/Netdata+Beszel, `containers`/Portainer). For each:
  add a new widget type to `WidgetPanel.jsx`'s `WidgetRenderer` switch that maps `service.category`
  to the documented widget set, likely fed by the existing `healthChecks.custom` HTTP checks (e.g.
  AdGuard's `status-api`/`dns-query` checks in `src/config/services.js` lines 32–36) rather than
  new data sources. Coordinate with FEAT #155 since the placeholder shimmer widgets were likely
  built as scaffolding for exactly this.
- **Files likely touched:** `src/components/WidgetPanel.jsx`, `src/config/services.js`,
  possibly new per-category widget components.
- **Verification:** Open a service with a `category` that now has a real mapped widget (e.g.
  AdGuard/`security`) and confirm the detail page shows category-specific content (e.g. DNS query
  stats) rather than the generic health-checks/latency-chart widgets, sourced from real
  `healthChecks.custom` responses.

### [FEAT #157] Notifications bell in Navbar is a non-functional stub
- **Root cause:** `src/components/Navbar.jsx` line 83,
  `<button className={styles.iconBtn} title="Notifications">🔔</button>`, renders styled
  identically to the working Settings button (line 84–90) but has no `onClick`, no badge/count
  state, and no dropdown — a visibly intended but entirely unimplemented feature.
- **Fix approach:** Define scope with the user first (no existing notification data source
  exists anywhere in the app). A reasonable minimal version: surface health-check state changes
  (a service going offline) as notification entries, reusing the existing `LoggerContext`
  (`src/context/LoggerContext.jsx`) as the data source — filter `logs` for `WARN`/`ERROR` entries
  and show them in a dropdown from the bell, with an unread-count badge. This ties naturally into
  the existing logging infra rather than inventing a new one.
- **Files likely touched:** `src/components/Navbar.jsx`, `src/components/Navbar.module.css`,
  possibly `src/context/LoggerContext.jsx` (to expose an "unread" concept).
- **Verification:** Trigger a service going offline (or force a `logger.warn`/`logger.error` call),
  confirm the bell shows an updated count/badge, and clicking it reveals the relevant entries.

---

## Summary

| Phase | Bugs | Enhancements | Features | Total |
|-------|------|--------------|----------|-------|
| 1 — Critical | 2 | 0 | 0 | 2 |
| 2 — Functional correctness | 9 | 3 | 0 | 12 |
| 3 — Hardening & cleanup | 4 | 3 | 4 | 11 |
| **Total** | **15** | **6** | **4** | **25** |
