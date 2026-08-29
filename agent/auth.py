"""Two-tier ``X-API-Key`` auth for pi-hub-agent.

Mirrors tool-hub ``src/auth/middleware.py`` in spirit (an ``APIKeyHeader`` +
``require_*`` dependencies) but with a fixed pair of env-provided keys and constant-time
comparison — there is no key store, no rate limiter, no dev bypass.

Tiers:
  * ``require_read``  — the read key *or* the admin key is accepted.
  * ``require_admin`` — only the admin key is accepted (used by Plan 2 writes).

WebSocket auth: browsers cannot set headers on a ``WebSocket`` and a ``?key=`` query
param would leak into nginx access logs, so the first frame after connect must be
``{"type":"auth","key":"…"}`` within ``cfg.ws_auth_timeout_s`` seconds. On failure the
server closes with code 4401.
"""
from __future__ import annotations

import asyncio
import secrets

from fastapi import Depends, HTTPException, WebSocket
from fastapi.security import APIKeyHeader

from .config import cfg

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

WS_CLOSE_AUTH = 4401


def _matches(candidate: str, expected: str) -> bool:
    """Constant-time equality that never returns True for an unset expected key."""
    if not candidate or not expected:
        return False
    return secrets.compare_digest(candidate, expected)


def verify_key(api_key: str | None, *, admin: bool) -> str:
    """Return the tier name for a valid key, else raise HTTPException.

    ``admin=False`` accepts read or admin; ``admin=True`` accepts admin only.
    """
    if not api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    if _matches(api_key, cfg.admin_key):
        return "admin"
    if not admin and _matches(api_key, cfg.read_key):
        return "read"
    if _matches(api_key, cfg.read_key):
        # valid read key presented to an admin-only route
        raise HTTPException(status_code=403, detail="Admin API key required")
    raise HTTPException(status_code=401, detail="Invalid API key")


async def require_read(api_key: str | None = Depends(_api_key_header)) -> str:
    return verify_key(api_key, admin=False)


async def require_admin(api_key: str | None = Depends(_api_key_header)) -> str:
    return verify_key(api_key, admin=True)


async def ws_authenticate(ws: WebSocket, *, admin: bool = False) -> str:
    """Accept the socket, then require a first auth frame. Returns the tier name.

    Closes the socket (code 4401) and raises ``ConnectionError`` on any failure so the
    caller can simply ``return``.
    """
    await ws.accept()
    try:
        raw = await asyncio.wait_for(ws.receive_json(), timeout=cfg.ws_auth_timeout_s)
    except (asyncio.TimeoutError, Exception):  # noqa: BLE001 — malformed frame closes too
        await ws.close(code=WS_CLOSE_AUTH, reason="auth frame required")
        raise ConnectionError("ws auth: no valid first frame")

    if not isinstance(raw, dict) or raw.get("type") != "auth" or not raw.get("key"):
        await ws.close(code=WS_CLOSE_AUTH, reason="expected {type:auth,key:…}")
        raise ConnectionError("ws auth: bad frame shape")

    key = str(raw["key"])
    if _matches(key, cfg.admin_key):
        return "admin"
    if not admin and _matches(key, cfg.read_key):
        return "read"
    await ws.close(code=WS_CLOSE_AUTH, reason="invalid key")
    raise ConnectionError("ws auth: invalid key")
