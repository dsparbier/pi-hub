"""Live configuration for DEV-Hub Central Logs streaming — enable/disable,
minimum level, and the DEV-Hub host/API-key it streams to. No env-var or file
edit required: persisted via dev_hub_settings.py (a small local JSON file —
this agent has no settings-table layer of its own, same as sql-hub), and the
stream restarts immediately on change. See dev_hub_stream.py's docstring.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import dev_hub_settings, dev_hub_stream
from .auth import require_admin, require_read

router = APIRouter(tags=["dev-hub-stream"])


@router.get("/dev-hub-stream/status")
async def get_status(_key: str = Depends(require_read)):
    return await dev_hub_stream.status()


class StreamingSettingsUpdate(BaseModel):
    enabled: bool | None = None
    level: str | None = None
    dev_hub_url: str | None = None
    # Omit (or send blank) to leave the current key unchanged — never echoed back.
    dev_hub_api_key: str | None = None


@router.put("/dev-hub-stream/settings")
async def update_settings(body: StreamingSettingsUpdate, _key: str = Depends(require_admin)):
    patch: dict = {}
    if body.enabled is not None:
        patch["enabled"] = body.enabled
    if body.level is not None and body.level.strip():
        patch["level"] = body.level.strip().upper()
    if body.dev_hub_url is not None and body.dev_hub_url.strip():
        patch["dev_hub_url"] = body.dev_hub_url.strip()
    if body.dev_hub_api_key is not None and body.dev_hub_api_key.strip():
        patch["dev_hub_api_key"] = body.dev_hub_api_key.strip()

    if not patch:
        return await dev_hub_stream.status()

    try:
        await dev_hub_settings.update(patch)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    await dev_hub_stream.apply_live_settings()
    return await dev_hub_stream.status()
