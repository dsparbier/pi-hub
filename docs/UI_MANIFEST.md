# Pi-Hub UI/UX Manifest

> **Purpose** — This document is the single source of truth for recreating the Pi-Hub interface. Any AI agent or developer reading this should be able to reconstruct the complete visual design, component structure, and interactive behaviour from the information below.

---

## 1. Project Overview

Pi-Hub is a self-hosted front-end portal for a Raspberry Pi device. It presents all self-hosted services in a single configurable dashboard. The tech stack is **React 18 + Vite 5** with **CSS Modules** — no UI library. It is served from a Docker multi-stage build (Nginx). All styling is done via CSS custom properties (variables) and CSS Modules.

---

## 2. Top-Level Layout

```
┌─────────────────────────────────────────────────────────────┐
│  NAVBAR  (56 px tall, full width, fixed at top)             │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   SIDEBAR    │            MAIN CONTENT AREA                │
│  (220 px or  │  (flex: 1, overflow-y: auto, padding 24px)  │
│   52 px when │                                              │
│   collapsed) │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Outer shell** — `display: flex; flex-direction: column; height: 100vh; overflow: hidden`
- **Body row** — `display: flex; flex: 1; overflow: hidden`
- **Sidebar** — `flex-shrink: 0; transition: width 0.15s ease`
  - Open: `width: 220px`
  - Collapsed: `width: 52px` (icons only, no labels)
- **Main** — `flex: 1; overflow-y: auto; padding: 24px`
  - When ServiceConsole is active: `padding: 0; overflow: hidden; display: flex; flex-direction: column`

---

## 3. Color System

### 3.1 CSS Custom Properties

All colors are consumed as CSS variables. Override the variables to change the theme.

```css
/* Semantic tokens — always use these, never raw hex */
--color-bg            /* page background                     */
--color-surface       /* card / navbar / sidebar background  */
--color-surface-2     /* hover states, inputs, code blocks   */
--color-border        /* dividers, input borders, card edges */
--color-accent        /* primary interactive color (buttons, active states, links) */
--color-accent-soft   /* darker/softer variant of accent, used for hover */
--color-text          /* primary body text                   */
--color-text-muted    /* labels, placeholders, secondary info */
--color-success       /* #22c55e — online indicators, success badges */
--color-warning       /* #f59e0b — warning badges, timeout states */
--color-danger        /* #ef4444 — error, offline, delete actions */
--color-pi            /* accent highlight (lighter tint of accent) — used for active nav, badges */
```

### 3.2 Dark Theme (default)

Applied via `data-theme="dark"` on `<html>`:

| Token             | Value       |
|-------------------|-------------|
| `--color-bg`      | `#0f1117`   |
| `--color-surface` | `#1a1d26`   |
| `--color-surface-2`| `#22263a`  |
| `--color-border`  | `#2e3350`   |
| `--color-text`    | `#e2e8f0`   |
| `--color-text-muted`| `#64748b` |

### 3.3 Light Theme

Applied via `data-theme="light"` on `<html>`:

| Token             | Value       |
|-------------------|-------------|
| `--color-bg`      | `#f1f5f9`   |
| `--color-surface` | `#ffffff`   |
| `--color-surface-2`| `#f8fafc`  |
| `--color-border`  | `#e2e8f0`   |
| `--color-text`    | `#1e293b`   |
| `--color-text-muted`| `#64748b` |

### 3.4 Accent Colour Presets

The user selects one of 8 accent presets. Each preset sets three CSS variables: `--color-accent`, `--color-accent-soft`, and `--color-pi`. Stored in `localStorage` as `ph-accent` (integer index 0–7).

| # | Name    | `--color-accent` | `--color-accent-soft` | `--color-pi` |
|---|---------|------------------|-----------------------|--------------|
| 0 | Violet  | `#7c3aed`        | `#4f46e5`             | `#c084fc`    |
| 1 | Blue    | `#2563eb`        | `#1d4ed8`             | `#93c5fd`    |
| 2 | Teal    | `#0d9488`        | `#0f766e`             | `#5eead4`    |
| 3 | Green   | `#16a34a`        | `#15803d`             | `#86efac`    |
| 4 | Orange  | `#ea580c`        | `#c2410c`             | `#fdba74`    |
| 5 | Pink    | `#db2777`        | `#be185d`             | `#f9a8d4`    |
| 6 | Rose    | `#e11d48`        | `#be123c`             | `#fda4af`    |
| 7 | Indigo  | `#4338ca`        | `#3730a3`             | `#a5b4fc`    |

The **default** accent is Violet (index 0).

---

## 4. Typography

- **Font stack** — `'Inter', 'Segoe UI', system-ui, sans-serif`
- **Base size** — `14px`, `line-height: 1.5`
- Monospace (logs, URLs) — `'Courier New', 'Consolas', monospace`
- No external font imports; relies on system Inter or fallback.

### Type Scale in Use

| Usage                        | Size   | Weight | Notes |
|------------------------------|--------|--------|-------|
| Page heading (h1)            | 20px   | 700    | |
| Section headings (h2/h3)     | 11px   | 700    | uppercase, letter-spacing 0.8px |
| Card title                   | 13px   | 600    | |
| Body / form labels           | 13px   | 400–500| |
| Secondary / meta text        | 12px   | 400    | color-text-muted |
| Micro labels / badges        | 10–11px| 600    | uppercase |
| Log viewer monospace         | 11px   | 400    | |

---

## 5. Design Tokens

```css
--nav-height:     56px   /* top navbar height          */
--sidebar-width:  220px  /* expanded sidebar width      */
--radius:         8px    /* universal border radius     */
--transition:     0.15s ease  /* universal transition   */
```

Micro-interactions use `color-mix(in srgb, var(--color-accent) N%, ...)` to tint borders, backgrounds, and fills without introducing hard-coded colors.

---

## 6. Component Inventory

### 6.1 Navbar

**File:** `src/components/Navbar.jsx`

Three-zone horizontal bar:

```
[ ☰  π Pi-Hub ]  [ ● 192.168.1.x  ● Online  ● N services ]  [ 🌙  🔔  ⚙  D ]
  Left zone               Center status pill                    Right zone
```

- **Left** — hamburger button (toggles sidebar) + π logo icon + "Pi-Hub" wordmark
- **Center** — pill-shaped status bar with 3 colored dots (success/warning/danger) and labels. Dots glow via `box-shadow: 0 0 6px <color>`
- **Right** — theme toggle button, notifications icon, settings icon, avatar circle
- Theme toggle cycles: `dark → light → system → dark` (persisted to `localStorage` as `ph-theme`)
- Avatar is a 30×30 circle with `background: var(--color-accent)`, white initial letter

### 6.2 Sidebar

**File:** `src/components/Sidebar.jsx`

Vertical navigation panel. Two width states: open (220 px) and collapsed (52 px). When collapsed, only icons show; labels and group text are hidden.

#### Structure (top to bottom):

```
[ Dashboard ]                    ← always first, no group

[ 🏗 Infrastructure  › ]         ← collapsible group header
  ·  🛡 AdGuard
  ·  🌐 NGINX
  ·  🐳 Portainer

[ 📊 Monitoring  › ]
  ·  📈 Uptime Kuma
  ...

[ 🤖 AI & Agents  › ]
[ 🗄 Data & Tools  › ]

Other                            ← label shown only when open; ungrouped services
  ·  [service]

─────────────────────────────────
MANAGE                           ← label shown only when open
  ⚙  Manage Services
  ✎  Edit Layout
  📋  Logs
─────────────────────────────────
Pi-Hub v0.1.0                    ← footer, shown only when open
```

#### Group header behaviour:
- Clicking toggles collapse/expand of its service items
- Chevron rotates: expanded = `rotate(90deg)`, collapsed = `rotate(0deg)`
- When sidebar is collapsed (icon-only mode), groups are always expanded (icons still show)
- Group headers are **drag-and-drop targets** — dropping a service item onto a header moves that service into the group

#### Service nav item:
- Active item: left `2px solid var(--color-accent)` border, tinted background `color-mix(in srgb, var(--color-accent) 15%, transparent)`, text color `var(--color-pi)`
- Indented items (inside groups, open mode) have `padding-left: 16px`
- Hover: `background: var(--color-surface-2)`, `color: var(--color-text)`

#### Drag-and-drop reordering:
- Every service item is wrapped in a `draggable` container
- On drag start: item fades to 35% opacity
- On drag over another item: a 2 px solid `var(--color-accent)` line renders above (insert before) or below (insert after) depending on cursor vertical position relative to item midpoint
- On drop onto a group header: group header highlights with dashed accent border + tinted background
- After a successful drop: the moved item flashes with an accent-coloured background animation (600 ms ease-out fade)
- Reorder updates the flat `services` array in app state; group membership is inferred from the drop target's group field

### 6.3 Dashboard (Overview page)

**File:** `src/components/Dashboard.jsx`

**Active view = `'dashboard'`** renders `DashboardOverview`:
- Groups services by `category` field into labeled sections
- Each section has a small-caps heading and a CSS grid of `ServiceCard` components
- Grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px`

**Active view = any service id** renders `ServiceDetail`:
- Page header with service name, category badge, and action buttons
- Action buttons: **Refresh**, **Open Console** (if `url` set), **Open in Browser** (if any URL set)
  - "Open Console" opens the service URL in an embedded iframe (ServiceConsole)
  - "Open in Browser" opens in a new browser tab; URL priority: `homeUrl → dashboardUrl → adminUrl → url`
- Body: `HealthPanel` displaying live health checks

### 6.4 ServiceCard

**File:** `src/components/ServiceCard.jsx`

Reusable card with header + body:

```
┌─────────────────────────────────────┐
│ [icon] Title            [badge] [⋯] │  ← header
├─────────────────────────────────────┤
│  children / placeholder content     │  ← body (flex: 1)
└─────────────────────────────────────┘
```

Size variants via `size` prop (sets `grid-column` span and `min-height`):
- `small` — min-height 140px
- `medium` — min-height 200px (default)
- `large` — min-height 300px
- `wide` — `grid-column: span 2`, min-height 200px

Status badge colors:
- `online` — green tint background, `var(--color-success)` text
- `offline` — red tint, `var(--color-danger)` text
- `warning` — amber tint, `var(--color-warning)` text
- `loading` — muted tint, `var(--color-text-muted)` text

### 6.5 HealthPanel

**File:** `src/components/HealthPanel.jsx`

Renders inside a service detail page. Shows 2-column grid of `CheckCard` components.

Standard checks (always present):
1. **IP Ping** — `fetch()` with `mode: 'no-cors'` and 6 s AbortController timeout; measures latency via `performance.now()`
2. **DNS Resolve** — same mechanism on the hostname

Optional custom checks defined per service in `services.js` under `healthChecks.custom[]`:
- Each has `{ id, label, method: 'GET'|'POST', url, body? }`
- Minimum 2 custom slots always displayed; empty slots show as "unconfigured"

Check card statuses and indicators:
- `pending` — pulsing dot animation
- `online` — green glowing dot + latency in ms
- `offline` — red dot
- `timeout` — amber dot
- `unconfigured` — faded border, italic "Configure in Manage Services" text

Re-check button (↺) in panel header spins while checks are running.

### 6.6 ServiceConsole

**File:** `src/components/ServiceConsole.jsx`

Full-area iframe viewer. Replaces the dashboard content area:

```
[ ← ServiceName ]  [ 🔒  http://...  ]  [ ↺  ↗ ]   ← 44 px toolbar
─────────────────────────────────────────────────────
                       iframe                         ← flex: 1
─────────────────────────────────────────────────────
```

- Toolbar height: 44 px, `background: var(--color-surface)`, bottom border
- URL bar is a read-only display of the current URL (with lock icon)
- ↺ reloads the iframe; ↗ opens URL in a new browser tab
- Loading spinner overlay shown until iframe fires `onLoad`
- Warning banner shown if `onError` fires (X-Frame-Options block)

### 6.7 ManageServices Drawer

**File:** `src/components/ManageServices.jsx`

Right-side drawer (420 px wide). Backdrop overlay on left.

#### Service form fields:

| Field          | Type   | Notes |
|----------------|--------|-------|
| Icon           | text   | maxLength 4, centered emoji input, 50 px wide |
| Label *        | text   | required |
| Description    | text   | |
| Console URL    | url    | used for iframe embed and as fallback for Open in Browser |
| Dashboard Page | url    | site's main dashboard URL |
| Default Page   | url    | site's home/landing URL |
| Admin Page     | url    | site's admin panel URL |
| Group          | select | options from `groups.js`; "— Ungrouped —" is default |
| Status         | select | `online / offline / warning / loading` |

Service row (list view) shows: icon · label + group badge · console URL · status badge · edit/delete buttons. If `dashboardUrl`, `homeUrl`, or `adminUrl` are set, small chips are shown below the URL.

### 6.8 Edit Layout Drawer

**File:** `src/components/EditLayout.jsx`

Right-side drawer (360 px wide). Three sections:

#### Section 1 — Theme
Three toggle buttons (Dark / Light / System). Active button has accent-colored border and tinted background. Stores selection to `localStorage` as `ph-theme`.

#### Section 2 — Accent Colour
4×2 grid of square swatches. Active swatch has white `✓` and box-shadow. Row below shows current accent chip + name + hex code. Stores selection to `localStorage` as `ph-accent`.

#### Section 3 — Sidebar Groups
Full CRUD for sidebar groups:
- "＋ Add Group" button triggers inline form
- Inline form: small icon emoji input (42 px) + label text input + save (✓) + cancel (✕) buttons
- Each group row: icon · label · edit (✎) · delete (✕) buttons
- Deleting a group automatically moves all its services to "ungrouped"

### 6.9 LogViewer Drawer

**File:** `src/components/LogViewer.jsx`

Right-side drawer (700 px wide). Monospace font throughout.

Controls:
- **Min level (emit)** — sets the minimum log level that the logger will record: DEBUG / INFO / WARN / ERROR
- **Filter view** — filters the displayed entries without discarding logs: DEBUG / INFO / WARN / ERROR
- **Service dropdown** — filters by originating service name or "All services"
- **Search input** — filters by message or service text
- **Auto-scroll checkbox** — when checked, scrolls to bottom as new entries arrive

Log entry grid columns: `170px (timestamp) | 34px (level) | 100px (service) | 1fr (message) | auto (expand)`

Level colors:
- DEBUG — `var(--color-text-muted)`
- INFO — `var(--color-accent)`
- WARN — `var(--color-warning)`
- ERROR — `var(--color-danger)`

WARN entries have a subtle amber background tint; ERROR entries have a red tint. Clicking an entry with a `data` payload expands a `<pre>` block with formatted JSON.

---

## 7. Data Models

### Service Object

```js
{
  id:          'unique-slug',           // string, kebab-case
  label:       'Display Name',          // string
  icon:        '🔧',                    // emoji string
  description: 'Short blurb',          // string
  category:    'security',             // drives monitoring widget type (see §8)
  group:       'infrastructure',       // id from groups.js, or '' / undefined for ungrouped
  status:      'online',               // 'online' | 'offline' | 'warning' | 'loading'
  url:         'http://host:port',     // console/iframe URL
  dashboardUrl:'http://host/dashboard',// optional: opens in browser (Dashboard Page)
  homeUrl:     'http://host/',         // optional: opens in browser (Default Page)
  adminUrl:    'http://host/admin',    // optional: opens in browser (Admin Page)
  healthChecks: {
    custom: [
      { id: 'check-1', label: 'API', method: 'GET', url: 'http://...' },
      { id: 'check-2', label: 'Auth', method: 'POST', url: 'http://...', body: '{}' },
    ]
  }
}
```

### Group Object

```js
{
  id:    'infrastructure',    // string, kebab-case
  label: 'Infrastructure',   // display name
  icon:  '🏗',               // emoji
}
```

---

## 8. Service Category → Widget Mapping

The `category` field on a service determines which monitoring widget layout is displayed on the detail page. This is reserved for Phase 2 data integration.

| Category     | Primary widgets |
|--------------|-----------------|
| `security`   | DNS Queries, Blocked, Active Clients, Query Log chart |
| `monitoring` | Service Uptime grid, Response Times chart, Incidents list |
| `system`     | CPU stat, Memory bar, Disk bar, Temperature stat, Network I/O chart |
| `network`    | Download/Upload/Ping stats, Speed History chart |
| `containers` | Running/Stopped/Images stats, Container list |
| `automation` | Active Workflows, Executions, Errors stats, Execution Log list |
| `ai`         | Loaded Models, Active Sessions, VRAM bar, Request Volume chart |
| `ai-agent`   | Agent Status, Messages Today, Memory bar, Activity Log list |
| `database`   | Collections, Total Records, Storage bar, Query Activity chart |
| `proxy`      | Proxy Hosts, Req/min, SSL Certs stats, Traffic chart |

---

## 9. State Architecture

All state lives in `App.jsx`. Drawers are controlled by boolean flags.

```
App state
├── services[]          ← flat array; order = sidebar order
├── groups[]            ← array; order = sidebar group order
├── activeView          ← 'dashboard' | service.id
├── sidebarOpen         ← boolean
├── collapsedGroups     ← Set of group ids
├── manageOpen          ← boolean (Manage Services drawer)
├── editLayoutOpen      ← boolean (Edit Layout drawer)
├── logViewerOpen       ← boolean (Log Viewer drawer)
└── consoleService      ← null | service object (ServiceConsole mode)
```

Drawers render as `{flag && <Drawer />}` — they unmount on close (no hidden state retained).

---

## 10. Functional Behaviours

### Theme switching
- Three modes: Dark / Light / System
- "System" reads `window.matchMedia('(prefers-color-scheme: light)')` and listens for OS changes
- Applied as `data-theme="dark"|"light"` on `<html>`; CSS variable overrides handle the rest
- Cycle order on navbar button: dark → light → system → dark

### Accent colour
- User picks from 8 presets (§3.4)
- Three CSS variables are patched on `document.documentElement` via `style.setProperty`
- Persisted to `localStorage` key `ph-accent` as index integer

### Group management (Edit Layout)
- Add: inline form with icon + label; saved as `{ id: slugify(label), icon, label }`
- Edit: replaces the matching group in state
- Delete: removes group from state AND sets `group: ''` on all services in that group (they become ungrouped)

### Service management (Manage Services)
- Add: slugifies label to create id; appended to services array
- Edit: merges changed fields into matching service
- Delete: removes service from array; if that service was the active view, switches to dashboard

### Sidebar drag-and-drop
- Source: any service nav item (`draggable` attribute)
- Target A (between items): 2 px accent line indicator; drop position is before/after based on cursor vs item midpoint
- Target B (group header): header highlights with dashed accent border; drop moves service to that group
- After drop: inserted service's `group` field updated to match target context; 600 ms flash animation on moved item

### Service console
- Triggered by "Open Console" button or ServiceCard "Open ↗" button
- Replaces main content area entirely (no overlay); sidebar remains
- Toolbar has back button (← service name), URL display, reload (↺), open-in-new-tab (↗)
- X-Frame-Options blocked iframes show a warning banner instead of an error

### Logging (LogViewer)
- `LoggerContext` provides `debug / info / warn / error` functions to all components
- Max 2000 entries retained in memory (oldest purged)
- Two-tier filtering: emit level (what gets recorded) vs view level (what is displayed)
- Console mirror: each log entry also calls the corresponding `console.*` method

---

## 11. Interaction Patterns

| Pattern | Implementation |
|---------|----------------|
| Hover feedback | `background: var(--color-surface-2)` |
| Active/selected | Left border `2px solid accent` + tinted background |
| Danger hover (delete) | `color: var(--color-danger)` + `background: color-mix(in srgb, danger 10%, transparent)` |
| Accent fill buttons | `background: var(--color-accent); color: #fff` |
| Dashed add button | `border: 1px dashed color-mix(in srgb, accent 40%, border)` |
| Badge pills | `border-radius: 999px; font-size: 10px; font-weight: 600; text-transform: uppercase` |
| Drawer animation | `animation: slideIn 0.2s ease` — `translateX(100%) → translateX(0)` |
| Backdrop | `position: fixed; inset: 0; background: rgba(0,0,0,0.45); animation: fadeIn 0.15s ease` |
| Glowing status dot | `box-shadow: 0 0 6px <color>` |
| Spinning loader | `border-top-color: accent; animation: spin 0.7s linear infinite` |

---

## 12. CSS Conventions

- **CSS Modules** — every component has a co-located `.module.css` file; class names are locally scoped
- **`color-mix(in srgb, X Y%, transparent)`** — used universally for tinted backgrounds, hover states, focus rings; avoids hardcoded alpha values
- **No media queries** — layout is currently desktop-first; no responsive breakpoints defined
- **Custom scrollbar** — 6 px width, `var(--color-border)` thumb, `var(--color-bg)` track; defined globally
- **`--transition`** applied to `background`, `color`, `border-color` on interactive elements; transform animations defined separately

---

## 13. File Structure Reference

```
src/
├── App.jsx                  # Root component, all state
├── App.module.css           # Layout shell (navbar + sidebar + main)
├── main.jsx                 # Entry point, LoggerProvider wrapper
├── config/
│   ├── services.js          # Service registry (18 services)
│   └── groups.js            # Group definitions (4 groups)
├── context/
│   └── LoggerContext.jsx    # Logger (debug/info/warn/error, max 2000 entries)
├── hooks/
│   ├── useTheme.js          # Theme + accent state, localStorage persistence
│   └── useHealthCheck.js    # Health check runner (fetch + AbortController)
├── components/
│   ├── Navbar.jsx / .module.css
│   ├── Sidebar.jsx / .module.css
│   ├── Dashboard.jsx / .module.css
│   ├── ServiceCard.jsx / .module.css
│   ├── ServiceConsole.jsx / .module.css
│   ├── HealthPanel.jsx / .module.css
│   ├── ManageServices.jsx / .module.css
│   ├── EditLayout.jsx / .module.css
│   ├── LogViewer.jsx / .module.css
│   └── WidgetPlaceholder.jsx / .module.css  # Phase 2 placeholder
└── styles/
    ├── index.css            # Global reset, CSS variables, typography
    └── themes.css           # Dark / light theme variable overrides
```

---

## 14. Current Service Registry

18 services across 4 groups:

| Group          | Services |
|----------------|----------|
| Infrastructure | AdGuard (🛡), NGINX (🌐), Portainer (🐳) |
| Monitoring     | Uptime Kuma (📈), Netdata (💻), Beszel (📊), Speedtest Tracker (⚡), OpenSpeedTest (🚀) |
| AI & Agents    | Open WebUI (🧠), Jarvis (🎯), Derek (💡), Lois (🌸), Pepper (🌶), Alfred (🎩) |
| Data & Tools   | N8N (⚡), Sql-Hub (🗄), PocketBase (🗃), Tool-Hub (🔧) |

---

*Generated: 2026-04-29 | Pi-Hub v0.1.0*
