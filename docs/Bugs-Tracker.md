# Pi-Hub Bugs Tracker

> **Migrated to DEV-Hub (2026-07-12).** Bugs are now tracked in DEV-Hub under the `pi-hub`
> project (id 24, bug ids 89–91). Use `/create-bug`, `/update-bug`, `/delete-bug`, and
> `/review-bugs` instead of editing this file — see `docs/dev-hub-sync.md`. The content below is
> an archived pre-migration snapshot, kept for history only.

## Known Issues / Pending

- None open at this time.

## Resolved

- ✅ `package.json` version string had drifted out of sync with `src/version.js` (stuck at 1.5.5 while the app reported 1.5.6). Fixed 2026-07-11 by syncing both to 1.5.7.
- ✅ Configuration retention bug in `App.jsx` — fixed in v1.5.6.
- ✅ Sidebar did not reorder correctly after drag-and-drop — fixed prior to v1.0.0.
