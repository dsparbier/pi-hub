# DEV-Hub Auto-Logging Scaffolding

> Companion to [`READ-ME.ui-scaffolding.md`](READ-ME.ui-scaffolding.md). That document defines
> the shared sidebar/section layout every app in the Pi-Hub family already follows; this document
> is the practical, copy-paste checklist for adding DEV-Hub's **Auto-Logging** capability — watch
> this app's own log files, auto-file an open bug in DEV-Hub for anything at `WARNING`/`ERROR`/
> `CRITICAL` — to any of them, under their existing Configurations section. It also covers the
> **manual "Report to DEV-Hub" menu** (§3a) — a standalone sidebar item for filing a bug, feature,
> or enhancement by hand — since it shares all of Auto-Logging's backend plumbing (DEV-Hub
> URL/key, the project-list proxy) and should be added alongside it rather than as a separate
> effort.

Use this when a user says something like "add DEV-Hub auto-logging to sql-hub/tool-hub/pi-hub" or
similar. It assumes DEV-Hub is already reachable and that the target app already conforms to
`READ-ME.ui-scaffolding.md` (i.e. it has a Configurations section with a save/status pattern).

---

## 1. Before you start

Confirm these — they're the per-app customization points:

- [ ] **DEV-Hub reachable at** what URL/port from the target app? (this repo's DEV-Hub defaults
      to `http://localhost:38103` with header `X-API-Key: test-devhub-key` — a different host may
      need a different URL/key; make both configurable via the target app's own env vars, don't
      hardcode DEV-Hub's dev key into a different project.)
- [ ] **What DEV-Hub project should bugs be filed against?** Two options — **default to the
      dropdown** unless you have a specific reason not to (see below):
      1. **Dropdown, like DEV-Hub's own implementation** (`GET /api/projects`, populate a
         `<select>`) — **recommended default.** Best UX (the user picks explicitly and can see/
         change it later), and matches DEV-Hub's own Configurations UI exactly, so anyone who's
         used one app's Auto-Logging panel already knows the other's. First built this way in
         `dev-hub` itself; validated as the standard pattern in `ai-hub` (see §6) after an
         earlier implicit-by-name version was replaced specifically to get this dropdown.
         **Caveat for every app except `dev-hub` itself:** the browser must never receive the
         DEV-Hub API key, so a foreign app cannot call `GET {DEV_HUB_URL}/api/projects` directly
         from its frontend the way `dev-hub/app/admin.html` does — it needs a small server-side
         proxy endpoint first. See the "Project list proxy" piece in §2.
      2. **Implicit, by app name** — resolve/create the project by the app's own repo name (same
         convention the `/create-bug` slash command uses:
         `basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"`), no dropdown or proxy
         endpoint needed. Only reach for this if you specifically want zero Configurations
         surface for project selection (e.g. a throwaway/internal tool) — it trades away the
         ability to ever retarget or see which project is active from the UI.
- [ ] **Does this app already log to a file, or only stdout?** If only stdout (common for a
      single-process container), you'll need the `logging_setup.py` piece below first.
- [ ] **How many processes does this app run** (API server, a separate UI/frontend process,
      workers, etc.)? Each one should get its own log file — this is what makes "multiple log
      file watching" actually useful instead of a single-path formality.
- [ ] **Does this app's log format put the level name as a plain word before the message** (e.g.
      Python `logging`'s default `%(levelname)s`, like
      `2026-07-11 10:00:00 ERROR app.module: ...`)? The `_line_level()` helper in §2 assumes that.
      Structured/JSON logs need a different parser — see §4.

## 2. Backend pieces to add

```
app/
  logging_setup.py   # NEW — FileHandler helper, generic, copy verbatim
                      # (skip if the app already writes to a known rotating log file —
                      # e.g. ai-hub's existing logging_manager.py — just point
                      # auto_logging_paths at that file instead of adding a second one)
  log_watcher.py      # NEW — tails files, matches level, dedupes, files a bug
                      # + create_dev_hub_item() (§3a) — the manual-menu POST helper,
                      # same file since it shares DEV_HUB_URL/_headers()
  routers/settings.py # EXTEND — 4 persisted keys (5 if using the dropdown — see below)
                      # + restart-on-change
  routers/system.py   # EXTEND (dropdown option, non-dev-hub apps only) — proxy endpoint
                       # so the frontend never needs the DEV-Hub API key directly
                       # + POST /dev-hub-item (§3a) — backs the manual menu
  main.py              # EXTEND — start/stop watchers in lifespan
```

### Project list proxy (dropdown option, skip if using implicit-by-name)

Every app except `dev-hub` itself needs a tiny server-side proxy so the browser can populate
the Target project `<select>` without ever holding the DEV-Hub API key:

```python
# app/routers/system.py (or wherever this app's misc/system endpoints live)
@router.get("/dev-hub-projects")
async def get_dev_hub_projects():
    try:
        return await log_watcher.list_dev_hub_projects()
    except Exception as e:
        raise HTTPException(502, f"Failed to reach DEV-Hub: {e}")
```

```python
# app/log_watcher.py
async def list_dev_hub_projects() -> list[dict]:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{DEV_HUB_URL}/api/projects", headers=_headers())
        resp.raise_for_status()
        return resp.json()
```

The frontend calls this local endpoint (e.g. `GET /api/system/dev-hub-projects`), never
`{DEV_HUB_URL}/api/projects` directly — see §3.

### `app/logging_setup.py` (copy verbatim)

```python
import logging
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"


def configure_file_logging(filename: str, level: str) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / filename
    handler = logging.FileHandler(path)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.getLogger().addHandler(handler)
    return path
```

Call `configure_file_logging("<process-name>.log", level)` once per process at startup, right
after `logging.basicConfig(...)` — one call per entry point (API server, frontend process,
worker, ...), each with a distinct filename, so every process gets its own watchable file.

### `app/log_watcher.py` (copy, then adjust the two constants)

Base this on `dev-hub/app/log_watcher.py` in this repo. The parts every app can copy **verbatim,
unmodified**: the tailing loop (`_tail_file`, seek-to-end so history isn't replayed as a flood of
bugs on every restart), `_line_level()` (see the critical warning below — do not "simplify" this),
and the dedupe-by-title-and-path check before creating a bug (same convention `/sync-todos` uses —
don't just dedupe on title alone, or identical error text in two different files will falsely
satisfy each other's "already tracked" check).

> ⚠️ **Do not match a level as "this word appears anywhere in the line."** The first version of
> this feature in `dev-hub` did exactly that
> (`re.compile(r"\b(CRITICAL|ERROR|WARNING)\b").search(line)`) and it created a real, live
> feedback loop within minutes of being enabled: the watcher's own `INFO "filed bug from X:
> <title>"` summary log echoed a previously-matched title containing the word `ERROR`, which
> matched again on the very next poll — and separately, an unrelated `INFO httpx` line logging a
> request to `.../api/logs?level=WARNING` matched on the word `WARNING` sitting in the URL's query
> string. Both flooded the tracker with bogus bugs before being caught and disabled. **Any
> self-monitoring watcher will eventually log something that mentions a trigger keyword without
> being that severity — assume this will happen, don't treat it as an edge case.**
>
> The fix, `_line_level()`, searches for **all** level names (`CRITICAL|ERROR|WARNING|INFO|DEBUG`)
> and takes whichever one is matched **first** in the line — for the standard
> `%(asctime)s %(levelname)s %(name)s: %(message)s` layout (or Python's default
> `LEVEL:name:message` style), the line's real level always appears before any message content,
> so a keyword mentioned later in the message body is correctly ignored:
>
> ```python
> _ANY_LEVEL_PATTERN = re.compile(r"\b(CRITICAL|ERROR|WARNING|INFO|DEBUG)\b")
>
> def _line_level(line: str) -> str | None:
>     match = _ANY_LEVEL_PATTERN.search(line)
>     return match.group(1) if match else None
> ```
>
> Copy this exact function, not a `search()` restricted to only the watchable levels — matching
> `INFO`/`DEBUG` too is what lets it correctly recognize "this line's real level is something we
> don't watch" instead of blindly matching the first *watchable* word it happens to see.

Adjust for the target app:
- **Where bugs get created.** DEV-Hub's own version writes directly to its local SQL-Hub-backed
  `bugs` table (it *is* the tracker). A different app should instead call DEV-Hub's REST API:
  `POST {DEV_HUB_URL}/api/bugs` with header `X-API-Key: {DEV_HUB_API_KEY}` and body
  `{"project_id": <id>, "title": "<line, truncated to 80 chars>", "description": "Auto-detected via log watch of \`<path>\` (<LEVEL>). Full line: <line>", "status": "open", "severity": "<mapped>"}`.
  Do the dedupe check the same way, but as `GET {DEV_HUB_URL}/api/bugs?project_id=<id>` filtered
  client-side on title + description containing the path, since a foreign app has no direct SQL
  access to DEV-Hub's data.
- **Project resolution (dropdown — default).** `restart_watchers` just reads the configured
  `auto_logging_project_id` setting (parsed to `int`, skip watching with a logged warning if
  it's empty/invalid) — same as DEV-Hub's own version. No caching, no resolve-or-create call;
  the user's dropdown selection is the source of truth. This is the only project-resolution
  logic `log_watcher.py` needs when using the dropdown.
- **Project resolution (implicit-by-name — only if you skipped the dropdown).** Resolve/create
  the project once (cache the id) before starting the tail tasks, instead of reading
  `auto_logging_project_id`.
- **Severity mapping** — keep as-is unless the app has stronger opinions:
  `{"WARNING": "low", "ERROR": "medium", "CRITICAL": "high"}`.

### `routers/settings.py` (or wherever this app persists settings)

Add 4 keys to whatever key/value settings mechanism the app already has (DEV-Hub itself uses a
generic `settings` table via `/api/settings` — see `dev-hub/app/routers/settings.py`):

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `auto_logging_enabled` | `"true"`/`"false"` string | `"false"` | Master on/off |
| `auto_logging_project_id` | string | `""` | DEV-Hub project id (omit if using implicit-by-name resolution) |
| `auto_logging_paths` | newline-separated string | `""` | One absolute log file path per line — this is what makes multi-file watching configurable |
| `auto_logging_levels` | comma-separated string | `"WARNING,ERROR,CRITICAL"` | Never include `INFO`/`DEBUG` — they don't carry issues worth filing |

After a successful settings update, if any `auto_logging_*` key changed, call
`log_watcher.restart_watchers(<merged settings dict>)` so changes take effect immediately without
a restart.

### `main.py` (or the app's entry point)

In the startup/lifespan hook: `await log_watcher.restart_watchers(<current settings>)`. On
shutdown: `await log_watcher.stop_watchers()`.

## 3. Frontend: Configurations section addition

Add a new panel under the app's existing `#section-configurations` (per
`READ-ME.ui-scaffolding.md`, this is the right home — the litmus test there is "does the wrong
value break connectivity to something outside the app?", and this feature both reads local files
and writes to an external service, so it qualifies):

```html
<div class="panel">
  <h3 style="margin-top: 0;">Auto-Logging</h3>
  <p style="color: var(--text-muted); font-size: 13px; margin-top: -6px;">
    Watches local log files and automatically files an open bug in DEV-Hub for any line matching
    the selected levels. Information-level lines are never watched.
  </p>
  <label><input type="checkbox" id="auto-logging-enabled" onchange="saveAutoLogging()" /> Enabled</label>
  <br /><br />
  <label>Target project <select id="auto-logging-project"></select></label>
  <br /><br />
  <label>Levels to watch</label><br />
  <label style="display: inline-block; margin-right: 12px;"><input type="checkbox" id="auto-logging-level-warning" /> Warning</label>
  <label style="display: inline-block; margin-right: 12px;"><input type="checkbox" id="auto-logging-level-error" /> Error</label>
  <label style="display: inline-block;"><input type="checkbox" id="auto-logging-level-critical" /> Critical</label>
  <br /><br />
  <label>Log files to watch (one absolute path per line)
    <textarea id="auto-logging-paths" rows="4" style="width: 100%; font-family: monospace;"></textarea>
  </label>
  <br />
  <button class="primary" onclick="saveAutoLogging()">Save</button>
  <div id="auto-logging-status" style="font-size: 12px; margin-top: 8px;"></div>
</div>
```

Plus `loadAutoLoggingSettings()` and `saveAutoLogging()` — mirror `dev-hub/app/admin.html`'s
versions of these functions, with one required change for every app except `dev-hub` itself:
populate the project `<select>` from **this app's own** `GET /api/system/dev-hub-projects` proxy
(§2), not `GET {DEV_HUB_URL}/api/projects` directly — `dev-hub`'s version calls DEV-Hub's API
straight from the browser because it *is* DEV-Hub; every other app must not, or the DEV-Hub API
key would need to ship to the browser. Populate the rest of the fields from this app's own
`GET /api/settings`, and have `saveAutoLogging()` `PUT` all keys (4, or 5 including
`auto_logging_project_id` for the dropdown option) to this app's own `/api/settings`. If you
chose implicit-by-name instead, drop the `<select>` and its load/save wiring entirely — there's
no project field for the user to set. Wire `loadAutoLoggingSettings()` into whatever function
shows the Configurations section (e.g. `showSection('configurations')`) or this tab specifically
(e.g. an `onclick` on the tab button, as ai-hub does — see §6), alongside that section's existing
load call.

## 3a. Frontend: manual "Report to DEV-Hub" menu

Add a standalone top-level sidebar item (not nested under Configurations — this is a one-off
action a user takes, not a persisted connectivity setting, so the litmus test from
`READ-ME.ui-scaffolding.md` doesn't apply the same way):

```html
<div class="nav-item" onclick="showSection('devhub')" id="nav-devhub">
  <span class="icon">🐞</span><span class="label">Report to DEV-Hub</span>
</div>
```

Backing section: a single form — Type (`bug` / `enhancement` / `feature`), Target project (same
`<select>`, populated from this app's own `GET /api/system/dev-hub-projects` proxy — reuse the
Auto-Logging panel's proxy endpoint, don't add a second one), Title, a type-specific field
(Severity for bugs, Priority for enhancements, Phase for features — show/hide with the Type
`<select>`'s `onchange`), and a Description textarea.

**Auto-prepopulate the Description** with where the report came from, so the user isn't stuck
writing repro context from scratch:

```js
function devHubContextLabel() {
  if (state.currentAgentId) {
    const agent = state.agents.find(a => a.id === state.currentAgentId);
    if (agent) return `"${agent.name}" agent console`;
  }
  return `${_lastNonAgentSection} section`;   // or this app's equivalent of "which section is open"
}
```

Track `_lastNonAgentSection` in whatever function switches sections (`showSection` in ai-hub),
updating it on every section except the reporting form itself and any per-item console/detail
view — otherwise navigating to the reporting section overwrites the very context it's supposed to
capture. Only write the prepopulated text if the textarea hasn't been hand-edited yet
(`textarea.dataset.userEdited`, set from an `oninput` handler) — don't clobber a user's in-progress
write-up if they navigate away and back.

**Backend** — one new endpoint plus one new `log_watcher.py` function, both trivial wrappers
around the same DEV-Hub REST calls `/create-bug`, `/create-feature`, `/create-enhancement` (the
Claude Code slash commands) already use:

```python
# app/log_watcher.py
_KIND_ENDPOINTS = {"bug": "bugs", "feature": "features", "enhancement": "enhancements"}

async def create_dev_hub_item(kind: str, payload: dict) -> dict:
    endpoint = _KIND_ENDPOINTS[kind]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"{DEV_HUB_URL}/api/{endpoint}", headers=_headers(), json=payload)
        resp.raise_for_status()
        return resp.json()
```

```python
# app/routers/system.py
class DevHubItemRequest(BaseModel):
    kind: str
    project_id: int
    title: str
    description: str = ""
    severity: str = "medium"    # bug
    priority: str = "medium"    # enhancement
    phase: str = "phase-1"      # feature

@router.post("/dev-hub-item")
async def post_dev_hub_item(req: DevHubItemRequest):
    if req.kind not in ("bug", "feature", "enhancement"):
        raise HTTPException(400, "kind must be one of: bug, feature, enhancement")
    payload = {"project_id": req.project_id, "title": req.title, "description": req.description}
    if req.kind == "bug":
        payload.update(status="open", severity=req.severity)
    elif req.kind == "feature":
        payload.update(status="planned", phase=req.phase)
    else:
        payload.update(status="proposed", priority=req.priority)
    try:
        return await log_watcher.create_dev_hub_item(req.kind, payload)
    except Exception as e:
        raise HTTPException(502, f"Failed to reach DEV-Hub: {e}")
```

Note the per-kind field/status mapping matches the three DEV-Hub REST shapes exactly (bugs get
`severity`+`status: open`, enhancements get `priority`+`status: proposed`, features get
`phase`+`status: planned`) — this is the same mapping `/create-bug`, `/create-enhancement`, and
`/create-feature` use, so items filed from this menu look identical to ones filed by the slash
commands or by a human using DEV-Hub's own UI directly.

## 4. Customization points (per app)

- **DEV-Hub URL/API key** — parameterize via env var, don't hardcode a different project's dev
  key.
- **Target project resolution** — dropdown vs. implicit-by-name, per §1.
- **Log line format** — `_line_level()`'s regex assumes level names appear as plain words, in the
  order timestamp → level → message. A JSON-logging app needs to parse the level field directly
  instead (e.g. `json.loads(line)["level"]`) — replace `_line_level()`'s body with that, but keep
  its contract (return the line's *own* level, never a keyword mentioned in the message).
- **Log file locations** — one file per process; there's no universal default, this depends on
  the app's own logging setup from §1.
- **Poll interval / missing-file retry** — `1s` poll, `5s` retry-if-missing in DEV-Hub's own
  version; adjust if the target app expects faster/slower detection.

## 5. Verification checklist

- [ ] Rebuild/restart the app after code changes — a `git pull` alone does **not** update an
      already-running container if its logging/watcher code is baked into the image at build
      time (same caveat as DEV-Hub's own deploy — see `docs/Bugs-Tracker.md`'s archived snapshot
      in this repo for the incident that surfaced this).
  - [ ] `GET /api/settings` (or equivalent) round-trips the new keys (4, or 5 with
        `auto_logging_project_id` for the dropdown option) with sane defaults.
- [ ] Enable, point at one real, currently-empty log file, write a line containing `ERROR`,
      confirm a bug appears in DEV-Hub with the right project/title/description/severity.
- [ ] Write the exact same line again — confirm no duplicate bug is created.
- [ ] Write a line containing `INFO` — confirm nothing is filed, even with all three levels
      selected.
- [ ] Point at a second file simultaneously — confirm both are watched (check the watcher's own
      startup log line, e.g. `"auto-logging watching 2 file(s) for levels [...] -> project N"`).
- [ ] **Feedback-loop test — do not skip this one.** With the watcher running against its own
      process's log file, manually append a line that *echoes* a watchable keyword inside an
      `INFO`-level line (e.g. `INFO some.logger: previously filed bug titled "... ERROR ..."`),
      and separately a line like `INFO httpx: HTTP Request: GET .../some/path?level=WARNING`.
      Confirm **neither** files a bug. This is exactly how the bug in dev-hub's own first version
      was found — test it explicitly, don't assume a passing "genuine ERROR line" test means
      you're safe from this.
- [ ] Disable — confirm the watcher tasks stop (no more bugs filed even if the file keeps
      growing).
- [ ] **Manual menu (§3a).** Open an agent console (or equivalent per-item view), then navigate to
      "Report to DEV-Hub" — confirm the Description prefills with that agent's/item's name, not a
      stale or generic label. Submit one of each kind (bug, enhancement, feature) and confirm each
      lands in DEV-Hub with the right status/severity-or-priority-or-phase field set, matching what
      `/create-bug` / `/create-enhancement` / `/create-feature` would produce for the same inputs.

## 6. Reference implementation

This repo (`dev-hub`) is the canonical example — see `dev-hub/app/logging_setup.py`,
`dev-hub/app/log_watcher.py`, `dev-hub/app/routers/settings.py`, `dev-hub/app/main.py`,
`dev-hub/app/frontend.py`, and the "Auto-Logging" panel in `dev-hub/app/admin.html`'s
Configurations section for a fully worked, tested implementation (it watches its own two
processes' log files and files bugs against its own DEV-Hub project — full dogfooding).

`ai-hub` is the reference implementation for every **other** app (a foreign app calling DEV-Hub
over REST rather than writing to its DB directly) — see `ai-hub/app/log_watcher.py` (REST calls +
`list_dev_hub_projects()` for the proxy), `ai-hub/app/routers/system.py`'s
`GET /api/system/dev-hub-projects` (the proxy endpoint), `ai-hub/app/routers/settings.py` (restart
watchers on `auto_logging_*` change), and the "Auto-Logging" tab in `ai-hub/app/admin.html`'s
Configurations section. It originally shipped with implicit-by-name project resolution (simpler,
no dropdown) and was deliberately switched to the dropdown + proxy pattern shortly after, to match
`dev-hub`'s own UI — that's why the dropdown is this doc's recommended default in §1, not the
implicit option.

`ai-hub` is also the reference implementation for the manual "Report to DEV-Hub" menu (§3a) —
see `ai-hub/app/log_watcher.py`'s `create_dev_hub_item()`, `ai-hub/app/routers/system.py`'s
`POST /api/system/dev-hub-item`, and the "Report to DEV-Hub" section in `ai-hub/app/admin.html`
(nav item `#nav-devhub`, `devHubContextLabel()`/`prefillDevHubDescription()` for the
context-aware Description prefill, `submitDevHubItem()`). Built directly on top of Auto-Logging's
existing DEV-Hub connection and project-list proxy — no new backend config or DEV-Hub credentials
needed, just the one new endpoint and one new `log_watcher.py` function.
