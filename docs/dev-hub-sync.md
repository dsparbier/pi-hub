**type:** Runbook <br>
**id:** projects/dev-hub-sync <br>
**title:** DEV-Hub Sync <br>
**description:** How to migrate a project's file-based bug/feature/enhancement tracking to DEV-Hub, and how to keep using DEV-Hub afterward. <br>
**audience:** Development, Agents <br>
**version:** 1.0.0 <br>
**timestamp:** 2026-07-11T00:00:00Z <br>

---

# DEV-Hub Sync

This is the playbook DEV-Hub's own repo used on 2026-07-11 to move its bug/feature/enhancement
tracking out of flat `.md` files and into DEV-Hub itself (see `docs/Bugs-Tracker.md` and
`docs/Features-Tracker.md` in this repo for the result). Follow the same steps in any other
project (`sql-hub`, `tool-hub`, `pi-hub`, etc.) to align it with the same convention.

## Background

Most projects in this environment track bugs, features, and enhancements as tables/lists inside
`docs/Bugs-Tracker.md` and `docs/Features-Tracker.md` (or equivalent). DEV-Hub is itself a
bug/feature/enhancement tracker with a REST API and admin UI — so instead of maintaining
duplicate, drifting bookkeeping in two places, a project should track its own issues *in*
DEV-Hub and treat its local tracker files as historical/archived at most.

This doc assumes DEV-Hub is already running and reachable — it does not cover deploying DEV-Hub
itself (see this repo's `README`/`docs/Project-Tracker.md` for that).

## Prerequisites

- DEV-Hub reachable at `http://dev-hub.pi-hub.local` (the fleet's central instance — never the
  disconnected local dev instance at `localhost:38103`) with header `X-API-Key: test-devhub-key`
  (hardcoded dev-only key, matches `dev-hub/.env`'s `DEV_HUB_API_KEY` — revisit if any of this
  ever needs to run against a non-local or shared deployment). Full connection/project-resolution
  convention: `~/.claude/dev-hub-api.md`.
- The slash commands below live in `~/.claude/commands/` (global, not per-repo), so they're
  already available in every project on this machine — nothing to install per-project.
- A project is identified in DEV-Hub by a `projects` row whose `name` matches the repo's
  directory name (`basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"`). The
  `create-*` commands create this project automatically the first time they're used if it
  doesn't exist yet.

## Available commands

| Command | Purpose |
| --- | --- |
| `/create-bug "<title>" "<description>"` | Create a bug (creates the project first if needed) |
| `/update-bug "<title>" "<update_note>"` | Update status/severity/description/resolution notes on an existing bug, found by title |
| `/delete-bug "<title>"` | Delete a bug, found by title (asks for confirmation) |
| `/create-feature "<title>" "<description>"` | Create a feature |
| `/update-feature "<title>" "<update_note>"` | Update an existing feature, found by title |
| `/delete-feature "<title>"` | Delete a feature, found by title |
| `/create-enhancement "<title>" "<description>"` | Create an enhancement |
| `/update-enhancement "<title>" "<update_note>"` | Update an existing enhancement, found by title |
| `/delete-enhancement "<title>"` | Delete an enhancement, found by title |
| `/sync-todos` | One-way: scan the repo for `TODO`/`FIXME`/`BUG`/`HACK`/`XXX` comments and create any not already tracked in DEV-Hub (never edits code or existing DEV-Hub items) |
| `/review-bugs` | Read-only: diff DEV-Hub's `open` bugs against the current code, flag which look already fixed vs. still open |
| `/review-features` | Read-only: diff DEV-Hub's `planned`/`in_progress` features against the current code, flag which look already done |
| `/review-enhancements` | Read-only: diff DEV-Hub's `proposed`/`planned`/`in_progress` enhancements against the current code, flag which look already done |

**Known caveat:** `/create-bug`, `/create-feature`, and `/create-enhancement` invoked with two
quoted arguments have a reproducible bug where `$1` resolves to the *second* argument and `$2`
comes back empty. Root cause not yet found. Workaround: after invoking, compare the loaded
template's resolved `$1`/`$2` against what you actually meant, and use the correct
title/description directly (e.g. call the REST API yourself) rather than trusting the
substitution. Don't skip the dedupe check (step 2 in each command) just because you're bypassing
the templated `$1`/`$2` — still check for an existing matching title first.

## Migration steps for a project

1. **Inventory the existing tracker file(s).** Typically `docs/Bugs-Tracker.md`'s
   "Known Issues / Pending" table and `docs/Features-Tracker.md`'s "Feature Status" +
   "Next Planned Features" sections (or whatever the project's actual filenames/headings are —
   don't assume they match this template exactly).

2. **Resolve or create the DEV-Hub project.**
   `GET http://dev-hub.pi-hub.local/api/projects` and look for one whose `name` matches the repo's
   directory name (case-insensitive). If none exists, `POST http://dev-hub.pi-hub.local/api/projects`
   with `{"name": "<repo name>", "status": "active"}` — or just let the first `/create-bug` /
   `/create-feature` call do this automatically.

3. **Migrate bugs.** For each row in the bugs table: `title` = a short summary of the issue,
   `description` = the full original "Issue" text, `resolution_notes` = the original "Notes"
   text, `status` = `open` if still unresolved, `resolved` if the notes say it was fixed/worked
   around, `severity` = your judgment (`low`/`medium`/`high`/`critical` based on impact). Check
   for an existing bug with the same title before creating (dedupe), same as `/create-bug`'s own
   step 2.

4. **Migrate features.** For each row in "Feature Status": `title`, `description` (any
   parenthetical detail from the original row), `status` = `done`/`in_progress`/`planned`
   matching the row's checkmark/state, `phase` = `phase-1` unless the project tracks phases
   differently.

5. **Migrate enhancements.** For each item in a "Next Planned"/backlog-style list that isn't a
   committed, phased feature yet: `title`, `description`, `status: proposed`,
   `priority: medium` (adjust if the source material implies otherwise).

6. **Update the project's documentation** to point at DEV-Hub instead of the files:
   - Rewrite the top of `docs/Bugs-Tracker.md` and `docs/Features-Tracker.md` with a short
     "Migrated to DEV-Hub (`<date>`)" notice naming the DEV-Hub project and the id ranges created,
     instructing readers to use the slash commands above instead of editing the file. Keep the
     original table/list content below as an archived, clearly-labeled pre-migration snapshot —
     don't delete history, just stop treating it as live.
   - If the project has its own build/instructions doc describing a "bugs/features tracked in
     `Bugs-Tracker.md`" convention (search for it — don't assume the filename), update that
     description to point at DEV-Hub too.
   - If the project has its own `.claude/commands/commit-code.md` (repo-local, not the global
     one), update its bug/feature/enhancement tracking step(s) to call the DEV-Hub slash commands
     instead of editing the tracker files, with a fallback to the file-based approach only if
     DEV-Hub is unreachable.

7. **Going forward**, log new bugs/features/enhancements via the slash commands as they're found,
   same as any other DEV-Hub-tracked project — don't add new rows to the archived files. Run
   `/review-bugs`, `/review-features`, `/review-enhancements` periodically (e.g. at the start of a
   `/commit-code` run, or whenever picking up stale work) to catch drift between what DEV-Hub
   still marks open and what the code actually shows.

## Reference implementation

See this repo's `docs/Bugs-Tracker.md` and `docs/Features-Tracker.md` for a worked example of the
end state (migration notice + archived snapshot), and `docs/Project-Tracker.md`'s 2026-07-11
session log entries for how the migration itself was carried out and reported.
