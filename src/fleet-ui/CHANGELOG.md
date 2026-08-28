# fleet_ui changelog

Token / shell changes are versioned. A bump here + in `tokens.css`
(`--fleet-ui-version`) ripples to every vendored `src/fleet-ui/` copy via
`_fleet/sync.sh --ui`. See `~/projects/_fleet/FLEET-UI-STANDARD.md`.

## 1.0.0 — 2026-08-27

Initial release (FLEET-UI-STANDARD.md v1.0, Phase 1).

- `tokens.css` — full token set: light (bare `:root`), system-dark + system
  `prefers-contrast` media queries, and `light` / `dark` / `ambient` /
  `high-contrast` `[data-theme]` blocks; a `data-density="compact"` spacing axis;
  `--line-weight` (raised by `high-contrast`); the IBM Plex Sans/Mono type scale.
- `app-shell.css` — sticky Title-Bar, collapsible Side-Menu (232 ⇄ 56 px rail),
  centred `1140px` content region; primitives `.fleet-tile` / `.fleet-card` /
  `.fleet-pill` / `.fleet-filter` / `.fleet-scroll` table / `.fleet-verify`;
  focus ring, reduced-motion guard, ≤ 900 px off-canvas drawer.
- `theme.js` (ES module) + `theme-inline.min.js` (pre-paint) — `THEMES` (5),
  `DENSITIES`, `initTheme` / `setTheme` / `cycleTheme` / `applyTheme`,
  `setDensity`, `getRail` / `setRail` / `toggleRail`, `bindShell` (scroll shadow
  + drawer helpers). Keys: `fleet.theme` / `fleet.density` / `fleet.sidemenu`.
- `icons/index.js` — Lucide subset (menu, chevron-left, panel-left, sun, moon,
  monitor, contrast, circle, activity, plus, search, settings, external-link, x)
  + `svg()` / `mount()` + `THEME_ICON` map.
- `components/` — Vue 3 reference SFCs (FleetShell, TitleBar, SideMenu, NavItem,
  ThemeSwitch, DensityToggle, StatTile, AccentCard, Pill, FilterChips, DataTable,
  VerifyList, FleetIcon) + a barrel `index.js` with an `install()` plugin.
- `vuetify-bridge.js` — `vuetifyThemeConfig` for all 5 themes + `syncVuetifyTheme()`.
- `app-shell.html` — framework-free reference page.
