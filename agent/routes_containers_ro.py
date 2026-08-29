"""Read-only container endpoints (``require_read``) + the two log/stats WebSockets.

No control actions here — those arrive in Plan 2 (docs/PLAN-container-management.md) on
``require_admin`` with ``audit_log`` writes.
"""
from __future__ import annotations

import asyncio
import contextlib
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket

from . import container_metrics as cm
from .auth import require_read, ws_authenticate
from .db import Database
from .deps import get_db, get_docker, ws_docker
from .docker_client import DockerClient

router = APIRouter(prefix="/api", tags=["containers"])


# ---------------------------------------------------------------------------
# REST — all require_read
# ---------------------------------------------------------------------------
@router.get("/containers", dependencies=[Depends(require_read)])
async def list_containers(
    db: Database = Depends(get_db),
    docker: DockerClient = Depends(get_docker),
):
    raw = await docker.list_containers(all=True)
    latest = {
        r["cid"]: r
        for r in await db.query(
            "SELECT cs.* FROM container_samples cs "
            "JOIN (SELECT cid, MAX(ts) mt FROM container_samples GROUP BY cid) g "
            "ON cs.cid = g.cid AND cs.ts = g.mt"
        )
    }
    out = []
    for c in raw:
        cid = c.get("Id") or c.get("id") or ""
        s = latest.get(cid) or {}
        labels = c.get("Labels") or {}
        out.append(
            {
                "id": cid,
                "name": _name(c),
                "image": c.get("Image"),
                "state": _state(c),
                "status": c.get("Status"),
                "health": _health(c) or (s.get("health")),
                "created": c.get("Created"),
                "ports": _ports(c.get("Ports")),
                "compose": {
                    "project": labels.get("com.docker.compose.project"),
                    "service": labels.get("com.docker.compose.service"),
                },
                "restart_count": s.get("restart_count"),
                "cpu_pct": s.get("cpu_pct"),
                "mem_used": s.get("mem_used"),
                "mem_pct": s.get("mem_pct"),
                "sample_ts": s.get("ts"),
            }
        )
    out.sort(key=lambda x: (x["state"] != "running", x["name"].lower()))
    return {"containers": out, "count": len(out)}


@router.get("/containers/{cid}", dependencies=[Depends(require_read)])
async def inspect_container(cid: str, docker: DockerClient = Depends(get_docker)):
    try:
        data = await docker.inspect(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"no such container: {exc}")
    labels = (data.get("Config") or {}).get("Labels") or {}
    # single source of truth for the recreate guards — same analysis the
    # recreate flow runs (anonymous volumes / multi-network / compose-managed).
    from .recreate import analyse

    info = analyse(data)
    return {
        **data,
        "compose_managed": bool(info["compose_project"]),
        "anonymous_volumes": info["anonymous_volumes"],
        "recreate_warnings": info["warnings"],
    }


@router.get("/containers/{cid}/logs", dependencies=[Depends(require_read)])
async def container_logs(
    cid: str,
    docker: DockerClient = Depends(get_docker),
    tail: int = Query(200, ge=1, le=5000),
    since: int | None = Query(None),
    timestamps: bool = Query(True),
):
    try:
        lines = await docker.logs_once(cid, tail=tail, since=since, timestamps=timestamps)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"no such container: {exc}")
    return {"lines": [_parse_log_line(l, timestamps) for l in lines if l.strip()]}


@router.get("/containers/{cid}/stats", dependencies=[Depends(require_read)])
async def container_stats(cid: str, docker: DockerClient = Depends(get_docker)):
    try:
        frame = await docker.stats_once(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"no such container: {exc}")
    if not frame:
        raise HTTPException(status_code=409, detail="container not running")
    flat = cm.parse(frame)
    return {"ts": int(time.time()), **flat}


@router.get("/audit", dependencies=[Depends(require_read)])
async def audit(
    db: Database = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    before: int | None = Query(None),
    action: str | None = Query(None),
):
    where = []
    params: list[Any] = []
    if before:
        where.append("ts < ?")
        params.append(before)
    if action:
        where.append("action = ?")
        params.append(action)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    params.append(limit)
    rows = await db.query(
        f"SELECT id, ts, actor, client_ip, action, target, params, result, detail, "
        f"duration_ms FROM audit_log {clause} ORDER BY id DESC LIMIT ?",
        params,
    )
    return {"entries": rows}


# ---------------------------------------------------------------------------
# WebSockets — first frame must be {"type":"auth","key":"…"}
# ---------------------------------------------------------------------------
@router.websocket("/containers/{cid}/logs/stream")
async def logs_stream(
    ws: WebSocket,
    cid: str,
    tail: int = Query(200, ge=0, le=5000),
    timestamps: bool = Query(True),
):
    try:
        await ws_authenticate(ws, admin=False)
    except ConnectionError:
        return
    docker: DockerClient = ws_docker(ws)
    try:
        async for line in docker.logs_follow(cid, tail=tail, timestamps=timestamps):
            if not line.strip():
                continue
            frame = _parse_log_line(line, timestamps)
            await ws.send_json({"type": "log", **frame})
    except (asyncio.CancelledError, Exception):  # noqa: BLE001 — client disconnect
        pass
    finally:
        with contextlib.suppress(Exception):
            await ws.send_json({"type": "end"})
        with contextlib.suppress(Exception):
            await ws.close()


@router.websocket("/containers/{cid}/stats/stream")
async def stats_stream(ws: WebSocket, cid: str):
    try:
        await ws_authenticate(ws, admin=False)
    except ConnectionError:
        return
    from .config import cfg

    docker: DockerClient = ws_docker(ws)
    prev: dict[str, Any] | None = None
    prev_ts: float | None = None
    last_emit = 0.0
    try:
        async for raw in docker.stats_stream(cid):
            flat = cm.parse(raw)
            nowt = time.time()
            dt = (nowt - prev_ts) if prev_ts else None
            payload = {
                "type": "stats",
                "ts": int(nowt),
                "cpu_pct": flat["cpu_pct"],
                "mem_used": flat["mem_used"],
                "mem_limit": flat["mem_limit"],
                "mem_pct": flat["mem_pct"],
                "net_rx_rate": cm.rate(flat["net_rx_bytes"], (prev or {}).get("net_rx_bytes"), dt),
                "net_tx_rate": cm.rate(flat["net_tx_bytes"], (prev or {}).get("net_tx_bytes"), dt),
                "blk_read_rate": cm.rate(flat["blk_read"], (prev or {}).get("blk_read"), dt),
                "blk_write_rate": cm.rate(flat["blk_write"], (prev or {}).get("blk_write"), dt),
                "pids": flat["pids"],
            }
            prev, prev_ts = flat, nowt
            if nowt - last_emit >= cfg.stats_stream_interval_s:
                await ws.send_json(payload)
                last_emit = nowt
    except (asyncio.CancelledError, Exception):  # noqa: BLE001
        pass
    finally:
        with contextlib.suppress(Exception):
            await ws.send_json({"type": "end"})
        with contextlib.suppress(Exception):
            await ws.close()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _name(c: dict[str, Any]) -> str:
    names = c.get("Names") or []
    if names:
        return names[0].lstrip("/")
    return (c.get("Name") or c.get("Id", "")[:12]).lstrip("/")


def _state(c: dict[str, Any]) -> str:
    st = c.get("State")
    if isinstance(st, dict):
        return (st.get("Status") or "").lower()
    return (st or "").lower()


def _health(c: dict[str, Any]) -> str | None:
    st = c.get("State")
    if isinstance(st, dict) and isinstance(st.get("Health"), dict):
        return st["Health"].get("Status")
    status = c.get("Status") or ""
    if "(healthy)" in status:
        return "healthy"
    if "(unhealthy)" in status:
        return "unhealthy"
    return None


def _ports(ports: Any) -> list[dict[str, Any]]:
    if not ports:
        return []
    if isinstance(ports, list):  # /containers/json shape
        seen = []
        for p in ports:
            entry = {
                "private": p.get("PrivatePort"),
                "public": p.get("PublicPort"),
                "type": p.get("Type"),
                "ip": p.get("IP"),
            }
            if entry not in seen:
                seen.append(entry)
        return seen
    return []


def _parse_log_line(line: str, timestamps: bool) -> dict[str, Any]:
    text = line.rstrip("\n")
    ts = None
    if timestamps and text[:4].isdigit() and "T" in text[:20]:
        head, _, rest = text.partition(" ")
        ts = head
        text = rest
    return {"ts": ts, "stream": "stdout", "text": text}
