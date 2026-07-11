# Pi-Hub Project Tracker

## Current Version
1.5.8

## Overview
Pi-Hub is a self-hosted front-end portal for a Raspberry Pi device (React 18 + Vite 5, CSS Modules, no UI library), served via a Docker multi-stage build (Nginx). See [UI_MANIFEST.md](./UI_MANIFEST.md) for the full design spec.

## Session Log

### 2026-07-11 (2)
- Versioned the `.claude/commands/` slash-command definitions (`clean-project.md`, `commit-code.md`) that had been left untracked by the prior session — the user asked for these to be committed manually.

### 2026-07-11
- Ran `/clean-project`: reviewed folder structure (no drift found, nothing to move or purge), added `.vscode/` and `*.code-workspace` to `.gitignore` since those files hold personal Peacock/editor color settings rather than shared project config.
- Fixed a version-string desync: `package.json` had been left at `1.5.5` since the `v1.5.6` commit while `src/version.js` was bumped; both are now synced and bumped to `1.5.7`.
- Picked up an in-progress `docker-compose.yml` change (pending from before this session): container port mapping changed from `3030:80` to `0.0.0.0:31106:80` (and the commented-out dev override updated to match), binding explicitly to all interfaces on the new host port.
- Created `Project-Tracker.md`, `Features-Tracker.md`, and `Bugs-Tracker.md` (none existed previously) to track ongoing work going forward.

### Prior history (reconstructed from git log, pre-dates this tracker)
- `v1.5.6` — Fixed configuration retention bug in `App.jsx`.
- `v1.5.5` — Version bump.
- `d4e8fdd` — Service-specific links with tabbed console view.
- `v1.5.0` — Chore version bump.
- `dc14dd0` — Dashboard modernization: compact cards and widget management.
- `v1.0.0` — Stable release.
- Port changed from 3000 to 3030 (chore).
- `v0.1.0` — Initial versioned bump.
- UI/UX manifest added for AI-agent replication.
- Sidebar drag-and-drop reordering, fixed reorder-after-drop bug.
- Service detail simplified to health panel only.
- Console fills viewport; health panel spans full grid width.
- Group management in Edit Layout, extra URLs, "Open in Browser".
- Dynamic sidebar groups, Pi-Hub logger, service health panels (initial feature set).
