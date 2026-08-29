"""``WS /api/containers/{id}/exec`` — admin, interactive shell into a running container.

The whole route is only mounted when ``ENABLE_EXEC`` is true (see ``app.py``).

After the ``{"type":"auth","key":…}`` frame:
  client → ``{type:"stdin",data}`` | ``{type:"resize",cols,rows}`` | ``{type:"ping"}``
  server → ``{type:"stdout",data}`` | ``{type:"exit",code}`` | ``{type:"error",message}``

Caps: ``MAX_EXEC_SESSIONS`` concurrent, ``EXEC_IDLE_TIMEOUT_S`` since last I/O,
``EXEC_MAX_DURATION_S`` total. Every session opens + closes an ``audit_log`` row.
"""
from __future__ import annotations

import asyncio
import contextlib
import time

from fastapi import APIRouter, Query, WebSocket

from .audit import record
from .auth import ws_authenticate
from .config import cfg
from .deps import ws_db, ws_docker

router = APIRouter(tags=["exec"])

_active: set[str] = set()


@router.websocket("/api/containers/{cid}/exec")
async def exec_ws(
    ws: WebSocket,
    cid: str,
    cmd: str = Query("/bin/sh"),
    tty: bool = Query(True),
):
    try:
        await ws_authenticate(ws, admin=True)
    except ConnectionError:
        return

    if cmd not in cfg.exec_allowed_cmds:
        await ws.send_json({"type": "error", "message": f"cmd not allowed: {cmd}"})
        await ws.close(code=4403)
        return
    if len(_active) >= cfg.max_exec_sessions:
        await ws.send_json({"type": "error", "message": "max exec sessions reached"})
        await ws.close(code=4429)
        return

    docker = ws_docker(ws)
    db = ws_db(ws)
    ip = ws.client.host if ws.client else "unknown"
    session = f"{cid}:{time.time()}"
    _active.add(session)
    start = time.monotonic()
    last_io = time.monotonic()
    exit_code: int | None = None
    err: str | None = None

    await record(db, actor="admin", ip=ip, action="container.exec.open", target=cid,
                 params={"cmd": cmd, "tty": tty})

    try:
        ex = await docker.exec_create(cid, [cmd], tty=tty)
        stream = ex.start(detach=False)
        async with stream:
            await ws.send_json({"type": "ready", "exec_id": getattr(ex, "id", None)})

            async def pump_out():
                nonlocal last_io
                while True:
                    msg = await stream.read_out()
                    if msg is None:
                        break
                    last_io = time.monotonic()
                    data = msg.data.decode("utf-8", "replace") if isinstance(msg.data, bytes) else str(msg.data)
                    await ws.send_json({"type": "stdout", "data": data})

            async def pump_in():
                nonlocal last_io
                while True:
                    frame = await ws.receive_json()
                    last_io = time.monotonic()
                    t = frame.get("type")
                    if t == "stdin":
                        await stream.write_in(str(frame.get("data", "")).encode())
                    elif t == "resize":
                        with contextlib.suppress(Exception):
                            await ex.resize(h=int(frame.get("rows", 24)), w=int(frame.get("cols", 80)))
                    elif t == "ping":
                        await ws.send_json({"type": "pong"})

            async def watchdog():
                while True:
                    await asyncio.sleep(5)
                    now = time.monotonic()
                    if now - last_io > cfg.exec_idle_timeout_s:
                        raise TimeoutError("idle timeout")
                    if now - start > cfg.exec_max_duration_s:
                        raise TimeoutError("max session duration")

            tasks = [asyncio.create_task(c) for c in (pump_out(), pump_in(), watchdog())]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for p in pending:
                p.cancel()
            for d in done:
                exc = d.exception()
                if isinstance(exc, TimeoutError):
                    err = str(exc)

        with contextlib.suppress(Exception):
            info = await ex.inspect()
            exit_code = info.get("ExitCode")
    except Exception as exc:  # noqa: BLE001
        err = err or str(exc)
    finally:
        _active.discard(session)
        with contextlib.suppress(Exception):
            if err:
                await ws.send_json({"type": "error", "message": err})
            await ws.send_json({"type": "exit", "code": exit_code})
            await ws.close()
        await record(db, actor="admin", ip=ip, action="container.exec.close", target=cid,
                     result="error" if err else "ok",
                     detail=err or f"exit={exit_code}",
                     duration_ms=int((time.monotonic() - start) * 1000))
