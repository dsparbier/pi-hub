# Commit Code

This command runs in whatever project repo it's invoked from — that repo's layout (whether it has a `CLAUDE.md`, where its version lives, its default branch name) may not match any specific project's conventions. Detect rather than assume; skip a step gracefully (and say so in the report) rather than failing if its precondition doesn't hold.

Execute the full commit workflow in order:

1. **Update memory** — review and update relevant memory files in the project memory directory to reflect session changes.
2. **Update `Project-Tracker.md`** (in `docs/` if that folder exists, else repo root):
   - `## Current Version` / header line — bump to match step 5
   - `## Session Log` — add a dated entry summarizing what changed and why
3. **Update `Features-Tracker.md`** (in `docs/` if that folder exists, else repo root):
   - `## Feature Status` — mark items ✅ / update status
   - `## Next Planned Features (Phase 2+)` — move completed items out, add new backlog ideas surfaced this session
4. **Update `Bugs-Tracker.md`** (in `docs/` if that folder exists, else repo root):
   - `## Known Issues / Pending` — close resolved bugs and stubs, add any newly discovered ones. If the repo's `CLAUDE.md` documents a "Tracking Bugs, Enhancements & Stubs" convention, this table should already be current from the session (bugs/stubs logged as found, not deferred to commit time) — treat this step as a final verification pass, not first-time capture. If no such convention exists, populate the table directly from this session's changes.
5. **Bump version** — determine the correct semantic version bump (patch/minor/major) from the nature of the changes. Locate the project's version string(s) by searching rather than assuming a fixed path — e.g. `grep -rn "version" backend/app/main.py pyproject.toml package.json setup.py setup.cfg Cargo.toml 2>/dev/null`. Update every location found (for a FastAPI `main.py`, that's both the `version=` kwarg and any `/` root endpoint's `"version"` key) so they stay in sync. If no version string exists anywhere in the repo, skip the bump and note it in the report — don't invent a version file.
6. **Write commit message** — structure it as three lines:
   ```
   version: <version number>
   changes: <summary of what changed and why>
   files: <list of impacted files>
   ```
7. **Push and sync**:
   - Run `git status` first; if there's nothing staged or unstaged to commit, stop and report that — don't create an empty commit.
   - Determine the actual default branch (`git symbolic-ref refs/remotes/origin/HEAD` or `git branch --show-current`) instead of assuming `main`.
   - Before tagging, confirm the tag doesn't already exist (`git tag -l vX.Y.Z`); if it does, surface the conflict instead of silently overwriting it.
   - `git add` the specific files changed (never a blanket `-A`/`.` — check `git status` output for anything that looks like a secret or unrelated in-progress work before staging).
   - `git commit -m "..."`.
   - Confirm with the user before running `git push` or `git tag`/`git push --tags` — these are shared-state operations and must not happen silently, and never with `--force`.

Create `Project-Tracker.md`, `Features-Tracker.md`, and `Bugs-Tracker.md` if any are missing, placing them in `docs/` if that folder exists, else the repo root (if a prior `DELIVERY_TRACKER.md` exists, split its sections into the three files above as the template: version/session log → `Project-Tracker.md`, feature status/backlog → `Features-Tracker.md`, known issues → `Bugs-Tracker.md`). Preserve whatever section structure a tracker file already has rather than forcing it back to this template's exact headings.

Report each step as it completes, explicitly noting any step that was skipped and why.