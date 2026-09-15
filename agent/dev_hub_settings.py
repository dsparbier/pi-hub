"""
Live, UI-configurable overrides for DEV-Hub Central Logs streaming — enable/
disable, minimum level, DEV-Hub host/URL, and DEV-Hub API key.

pi-hub-agent has no settings-table layer of its own and its container root
filesystem is read-only (only `/tmp`, a non-persistent tmpfs, is writable —
see docker-compose.yml) — so a local JSON file (sql-hub's approach) won't
survive a restart here. Instead this piggybacks on the metrics database's own
`meta` key/value table (db.py's `Database`/`SqlHubDatabase`, both already
expose `get_meta`/`set_meta`) — this agent already has that connection open
for its own metrics (SQL-Hub by default, per FLEET-STANDARD.md), so no new
storage or dependency is needed. One JSON blob under a single meta key, read
fresh on every call (no caching), so a change via PUT /dev-hub-stream/settings
takes effect immediately with no restart.

`set_db()` must be called once from app.py's lifespan, after the metrics DB
connects — background tasks (dev_hub_stream.py) have no request context to
pull `app.state.db` from the way HTTP routes do via deps.get_db().
"""
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_db: Any = None
_META_KEY = "dev_hub_stream_settings"
_KEYS = {"enabled", "level", "dev_hub_url", "dev_hub_api_key"}


def set_db(db: Any) -> None:
    global _db
    _db = db


async def _read() -> dict:
    if _db is None:
        return {}
    try:
        raw = await _db.get_meta(_META_KEY)
        return json.loads(raw) if raw else {}
    except Exception:
        logger.warning("Failed to read %s from meta table, using defaults", _META_KEY, exc_info=True)
        return {}


async def get_all() -> dict[str, Any]:
    """Effective settings: persisted override > env-driven default."""
    overrides = await _read()
    return {
        "enabled": overrides.get(
            "enabled", os.environ.get("DEV_HUB_LOG_STREAMING_ENABLED", "").lower() == "true"
        ),
        "level": overrides.get("level", "WARNING"),
        "dev_hub_url": overrides.get(
            "dev_hub_url", os.environ.get("DEV_HUB_URL", "http://host.docker.internal:38103")
        ),
        "dev_hub_api_key": overrides.get("dev_hub_api_key", os.environ.get("DEV_HUB_API_KEY", "")),
    }


async def update(patch: dict[str, Any]) -> dict[str, Any]:
    """Merge `patch` (any subset of enabled/level/dev_hub_url/dev_hub_api_key,
    None values ignored) into the persisted overrides. Raises ValueError on an
    unknown key, RuntimeError if set_db() was never called. Returns the new
    effective settings (see get_all)."""
    unknown = set(patch) - _KEYS
    if unknown:
        raise ValueError(f"unknown setting(s): {sorted(unknown)}")
    if _db is None:
        raise RuntimeError("dev_hub_settings.set_db() was never called — no database connection available")
    current = await _read()
    current.update({k: v for k, v in patch.items() if v is not None})
    await _db.set_meta(_META_KEY, json.dumps(current))
    return await get_all()
