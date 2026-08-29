"""``WS /api/tasks/{task_id}`` — admin. Progress for pull / recreate tasks.

Replays the task's whole frame buffer on connect (so a late subscriber still sees the
history), then streams live frames, then closes after the terminal
``{"type":"done"|"error"}`` frame.
"""
from __future__ import annotations

import contextlib

from fastapi import APIRouter, WebSocket

from .auth import ws_authenticate
from .deps import ws_tasks

router = APIRouter(tags=["tasks"])


@router.websocket("/api/tasks/{task_id}")
async def task_ws(ws: WebSocket, task_id: str):
    try:
        await ws_authenticate(ws, admin=True)
    except ConnectionError:
        return

    task = ws_tasks(ws).get(task_id)
    if task is None:
        with contextlib.suppress(Exception):
            await ws.send_json({"type": "error", "message": "unknown or expired task"})
            await ws.close(code=4404)
        return

    try:
        async for frame in task.subscribe():
            await ws.send_json(frame)
    except Exception:  # noqa: BLE001 — client disconnect
        pass
    finally:
        with contextlib.suppress(Exception):
            await ws.close()
