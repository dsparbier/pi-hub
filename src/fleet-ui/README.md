# fleet_ui — the shared look & feel for every hub frontend

**Version 1.0.0.** Spec: `~/projects/_fleet/FLEET-UI-STANDARD.md`. This directory
is the **master template**; each frontend gets a vendored copy at
`<repo>/<frontend-ctx>/src/fleet-ui/` via `_fleet/sync.sh --ui`, and that copy is
**committed** in the app repo (not gitignored) so Pi-Hub builds from `git pull`
alone.

## What's in the box

| File | Purpose |
|---|---|
| `tokens.css` | The complete token set — 5 themes (`system` via media query + `light`/`dark`/`ambient`/`high-contrast` blocks) + a `data-density="compact"` axis — plus the IBM Plex type scale. **Zero component rules.** |
| `app-shell.css` | Title-Bar + Side-Menu + centred content region + every primitive (`.fleet-tile`, `.fleet-card`, `.fleet-pill`, `.fleet-filter`, `.fleet-scroll` table, `.fleet-verify`). Colours only via tokens. |
| `theme.js` | ES module — `initTheme` / `setTheme` / `cycleTheme` / `setDensity` / `toggleRail` / `bindShell` + the `THEMES` / `DENSITIES` constants. **Read the mode list from `THEMES`, never hard-code it.** |
| `theme-inline.min.js` | The smallest possible pre-paint theme+density snippet, for inlining in `<head>` of static / Jinja pages. |
| `icons/index.js` | A vendored Lucide subset (ISC licence) as inline-SVG strings + `svg(name, size)`. Add a glyph by pasting its Lucide markup — don't pull the whole set. |
| `app-shell.html` | Framework-free reference page — copy it for pi-hub / excalibur. |
| `components/*.vue` | Vue 3 reference implementation — `FleetShell`, `TitleBar`, `SideMenu`, `NavItem`, `ThemeSwitch`, `DensityToggle`, `StatTile`, `AccentCard`, `Pill`, `FilterChips`, `DataTable`, `VerifyList`, `FleetIcon`. **Not a runtime dependency** — use them or re-wrap the CSS locally. |
| `vuetify-bridge.js` | `vuetifyThemeConfig` + `syncVuetifyTheme()` for Vuetify apps (tool-hub). |
| `CHANGELOG.md` | Token / shell changes are versioned; a bump ripples to every vendored copy via `sync.sh --ui`. |

## Adopting it in a frontend

1. **Vendor**: `_fleet/sync.sh --ui <repo>` → `src/fleet-ui/`. `git add` it (do **not** gitignore).
2. **Load order**: `fleet-ui/tokens.css` → `fleet-ui/app-shell.css` → *then* your app CSS.
   Run `initTheme()` before first paint (`main.js` before `mount()`, or the inline
   snippet in `<head>` for static pages).
3. **Wrap** the app in `<FleetShell>` (Vue) or the `.fleet-shell` markup from
   `app-shell.html` (static / Jinja).
4. **Nav**: move existing navigation into Side-Menu groups. Wire the Title-Bar
   context pill (e.g. the active SQL-Hub target from `/api/admin/config`) and the
   `/health` status dot.
5. **Delete** the now-dead local colour / typography / layout CSS. No frontend
   ships its own palette or font stack.
6. **Verify**: all five theme modes × both densities, the ≤ 900 px drawer, rail
   mode, keyboard focus. Screenshot each of the five modes in the PR.
7. **Note it**: add a line to that repo's `.claude/memory.md`.

## Per-app rollout order (FLEET-UI-STANDARD.md §9)

| # | App | Stack | Note |
|---|---|---|---|
| 1 | pi-hub | static Vite site | **pilot** — pure token + shell swap |
| 2 | knowledge-hub `web/` | Vue 3 + tokens.css | already token-based; replace `assets/tokens.css`, wrap `App.vue` |
| 3 | excalibur | Flask + Jinja | 2 CSS files + `app-shell.html` partial + inline snippet; no build step |
| 4 | dev-hub | confirm at kickoff | context pill = active SQL-Hub target |
| 5 | fin-hub | Vue | also drop the stale `.env` service-URL list |
| 6 | invest-hub | Vue | "Local / Remote (SQL-Hub)" card → nav entry + `db-target` card |
| 7 | ai-hub | confirm at kickoff | — |
| 8 | tool-hub | Vue 3 + Vuetify + Pinia | biggest lift — `vuetify-bridge.js`; rail-slot gotcha; gut Vite starter `style.css` |

## Changing tokens or the shell

Edit here, bump `CHANGELOG.md` + `--fleet-ui-version` in `tokens.css`, then
`sync.sh --ui` (no repo arg) to fan out. Before shipping a token change, check
body contrast in **all five modes at both densities** (`tokens.css` §2 rules).

## localStorage keys

`fleet.theme` · `fleet.density` · `fleet.sidemenu` — identical in every app.
