"""In-memory task registry for long-running admin ops (image pull, recreate).

A task buffers every progress frame it emits. A subscriber (the `WS /api/tasks/{id}`
socket) first receives the whole buffer, then live frames, then the terminal
``{"type":"done"|"error", ...}`` frame — so a browser that connects late still sees the
full history. Tasks are GC'd a while after they finish.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

BUFFER_CAP = 1000
TASK_TTL_S = 3600


class Task:
    def __init__(self, kind: str) -> None:
        self.id = uuid.uuid4().hex
        self.kind = kind
        self.created = time.time()
        self.finished_at: float | None = None
        self.status = "running"          # running | done | error
        self.result: Any = None
        self.frames: list[dict[str, Any]] = []
        self._queues: set[asyncio.Queue] = set()

    def _emit(self, frame: dict[str, Any]) -> None:
        self.frames.append(frame)
        if len(self.frames) > BUFFER_CAP:
            # keep head + tail so early "layer started" lines survive
            self.frames = self.frames[:50] + self.frames[-(BUFFER_CAP - 50):]
        for q in list(self._queues):
            q.put_nowait(frame)

    def progress(self, **fields: Any) -> None:
        self._emit({"type": "progress", "ts": time.time(), **fields})

    def log(self, message: str) -> None:
        self._emit({"type": "log", "ts": time.time(), "message": message})

    def done(self, result: Any = None) -> None:
        self.status = "done"
        self.result = result
        self.finished_at = time.time()
        self._emit({"type": "done", "ts": self.finished_at, "result": result})

    def error(self, message: str, *, detail: Any = None) -> None:
        self.status = "error"
        self.finished_at = time.time()
        self._emit({"type": "error", "ts": self.finished_at, "message": message, "detail": detail})

    async def subscribe(self):
        """Yield buffered frames, then live ones, ending after a terminal frame."""
        q: asyncio.Queue = asyncio.Queue()
        # snapshot the buffer before registering so nothing is missed or doubled
        backlog = list(self.frames)
        self._queues.add(q)
        try:
            for f in backlog:
                yield f
            if backlog and backlog[-1]["type"] in ("done", "error"):
                return
            while True:
                f = await q.get()
                # skip frames already in the backlog snapshot
                if f in backlog:
                    continue
                yield f
                if f["type"] in ("done", "error"):
                    return
        finally:
            self._queues.discard(q)


class TaskManager:
    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}

    def create(self, kind: str) -> Task:
        self._gc()
        t = Task(kind)
        self._tasks[t.id] = t
        return t

    def get(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def _gc(self) -> None:
        now = time.time()
        stale = [
            tid for tid, t in self._tasks.items()
            if t.finished_at and now - t.finished_at > TASK_TTL_S
        ]
        for tid in stale:
            self._tasks.pop(tid, None)

    def run(self, kind: str, coro_factory) -> Task:
        """Create a task and drive ``coro_factory(task)`` in the background,
        turning any unhandled exception into a terminal error frame."""
        task = self.create(kind)

        async def _runner():
            try:
                await coro_factory(task)
                if task.status == "running":
                    task.done()
            except Exception as exc:  # noqa: BLE001
                task.error(str(exc), detail=type(exc).__name__)

        asyncio.create_task(_runner())
        return task
