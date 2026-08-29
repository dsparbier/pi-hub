"""Audit-log helper. Every admin control action writes one ``audit_log`` row.

The table is created in Plan 1 (`db.py`). ``params`` is JSON and stores **Env key names
only, never values** — see ``redact_env``.
"""
from __future__ import annotations

import json
import time
from typing import Any

from fastapi import Request

from .db import Database


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def redact_env(value: Any) -> Any:
    """Recursively replace any ``Env`` list (["K=v", …]) with just its key names."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if k in ("Env", "env") and isinstance(v, list):
                out[k] = sorted({str(e).split("=", 1)[0] for e in v})
            else:
                out[k] = redact_env(v)
        return out
    if isinstance(value, list):
        return [redact_env(v) for v in value]
    return value


async def record(
    db: Database,
    *,
    actor: str,
    ip: str,
    action: str,
    target: str | None = None,
    params: Any = None,
    result: str = "ok",
    detail: str | None = None,
    duration_ms: int | None = None,
) -> None:
    await db.execute(
        "INSERT INTO audit_log "
        "(ts, actor, client_ip, action, target, params, result, detail, duration_ms) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (
            int(time.time()), actor, ip, action, target,
            json.dumps(redact_env(params)) if params is not None else None,
            result, detail, duration_ms,
        ),
    )


class AuditSpan:
    """`async with AuditSpan(...) as span:` — records ok/error + duration on exit.
    Set ``span.detail`` / ``span.result`` inside the block to override."""

    def __init__(self, db: Database, *, actor: str, ip: str, action: str,
                 target: str | None = None, params: Any = None) -> None:
        self.db = db
        self.meta = dict(actor=actor, ip=ip, action=action, target=target, params=params)
        self.result = "ok"
        self.detail: str | None = None
        self._t0 = 0.0

    async def __aenter__(self) -> "AuditSpan":
        self._t0 = time.monotonic()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        if exc is not None and self.result == "ok":
            self.result = "error"
            self.detail = self.detail or f"{exc_type.__name__}: {exc}"
        await record(
            self.db, **self.meta, result=self.result, detail=self.detail,
            duration_ms=int((time.monotonic() - self._t0) * 1000),
        )
        return False  # never swallow
