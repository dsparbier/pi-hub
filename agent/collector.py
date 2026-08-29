"""Background sampling + retention for pi-hub-agent.

Three asyncio tasks, started from the FastAPI lifespan:

  * host sampler       — one ``host_samples`` row every ``SAMPLE_INTERVAL_HOST`` s.
  * container sampler  — one ``container_samples`` row per *running* container every
                         ``SAMPLE_INTERVAL_CONTAINERS`` s (``stats(stream=false)`` fanned
                         out under a semaphore). First row after a container appears
                         writes NULL rates; gaps are never interpolated.
  * retention/rollup   — every ``RETENTION_INTERVAL_S`` s: roll complete past hours into
                         ``rollup_*_1h`` (AVG+MAX), delete raw > 48 h and rollups > 90 d,
                         container-churn guard, trim ``audit_log``, WAL checkpoint,
                         weekly ``incremental_vacuum``.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from . import container_metrics as cm
from .config import cfg
from .db import Database, now
from .docker_client import DockerClient
from .host_metrics import HOST_SAMPLE_COLUMNS, HostMetricsReader

log = logging.getLogger("agent.collector")

HOUR = 3600
DAY = 86400


class Collector:
    def __init__(self, db: Database, docker: DockerClient) -> None:
        self.db = db
        self.docker = docker
        self.host = HostMetricsReader()
        self.last_host_sample_ts: int | None = None
        self.last_container_sample_ts: int | None = None
        self.last_error: str | None = None
        self._prev_container: dict[str, dict[str, Any]] = {}
        self._tasks: list[asyncio.Task] = []

    # -- lifecycle -------------------------------------------------------
    def start(self) -> None:
        self._tasks = [
            asyncio.create_task(self._loop("host", cfg.sample_interval_host, self._sample_host)),
            asyncio.create_task(
                self._loop("containers", cfg.sample_interval_containers, self._sample_containers)
            ),
            asyncio.create_task(
                self._loop("retention", cfg.retention_interval_s, self._run_retention)
            ),
        ]

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        self._tasks = []

    async def _loop(self, name: str, interval: int, fn) -> None:
        # small stagger so the three loops don't all fire on the same tick
        await asyncio.sleep({"host": 0, "containers": 2, "retention": 5}.get(name, 0))
        while True:
            t0 = time.monotonic()
            try:
                await fn()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                self.last_error = f"{name}: {exc}"
                log.warning("collector %s loop error: %s", name, exc)
            elapsed = time.monotonic() - t0
            await asyncio.sleep(max(1.0, interval - elapsed))

    # -- host ------------------------------------------------------------
    async def _sample_host(self) -> None:
        row, _sources = self.host.read()
        cols = ",".join(HOST_SAMPLE_COLUMNS)
        placeholders = ",".join("?" for _ in HOST_SAMPLE_COLUMNS)
        await self.db.execute(
            f"INSERT OR REPLACE INTO host_samples ({cols}) VALUES ({placeholders})",
            [row.get(c) for c in HOST_SAMPLE_COLUMNS],
        )
        self.last_host_sample_ts = row["ts"]

    # -- containers ----------------------------------------------------
    async def _sample_containers(self) -> None:
        try:
            containers = await self.docker.list_containers(all=False)
        except Exception as exc:  # noqa: BLE001
            self.last_error = f"containers: docker list failed: {exc}"
            return

        running = [c for c in containers if (c.get("State") or "").lower() == "running"
                   or _state_str(c) == "running"]
        ts = now()
        sem = asyncio.Semaphore(cfg.container_stats_concurrency)
        seen: set[str] = set()

        async def one(c: dict[str, Any]) -> list[Any] | None:
            cid = c.get("Id") or c.get("id")
            if not cid:
                return None
            seen.add(cid)
            name = _name_of(c)
            async with sem:
                try:
                    frame = await self.docker.stats_once(cid)
                except Exception:
                    return None
            if not frame:
                return None
            flat = cm.parse(frame)
            prev = self._prev_container.get(cid)
            dt = (ts - prev["ts"]) if prev else None
            row = [
                ts, cid, name, "running", flat["cpu_pct"],
                flat["mem_used"], flat["mem_limit"], flat["mem_pct"],
                flat["net_rx_bytes"], flat["net_tx_bytes"],
                cm.rate(flat["net_rx_bytes"], prev["net_rx_bytes"] if prev else None, dt),
                cm.rate(flat["net_tx_bytes"], prev["net_tx_bytes"] if prev else None, dt),
                flat["blk_read"], flat["blk_write"], flat["pids"],
                _restart_count(c), _health_of(c),
            ]
            self._prev_container[cid] = {"ts": ts, **flat}
            return row

        rows = [r for r in await asyncio.gather(*(one(c) for c in running)) if r]
        if rows:
            await self.db.executemany(
                "INSERT OR REPLACE INTO container_samples "
                "(ts, cid, name, state, cpu_pct, mem_used, mem_limit, mem_pct, "
                " net_rx_bytes, net_tx_bytes, net_rx_rate, net_tx_rate, "
                " blk_read, blk_write, pids, restart_count, health) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                rows,
            )
        # forget counters for containers that went away (avoid unbounded growth)
        for cid in list(self._prev_container):
            if cid not in seen:
                self._prev_container.pop(cid, None)
        self.last_container_sample_ts = ts

    # -- retention / rollup -------------------------------------------
    async def _run_retention(self) -> None:
        t = now()
        current_hour = (t // HOUR) * HOUR
        last_rollup = int(await self.db.get_meta("last_rollup_ts") or 0)
        roll_from = max(last_rollup, current_hour - cfg.rollup_retention_days * DAY)

        await self._rollup_host(roll_from, current_hour)
        await self._rollup_containers(roll_from, current_hour)
        await self.db.set_meta("last_rollup_ts", current_hour)

        raw_cutoff = t - cfg.raw_retention_hours * HOUR

        # (4) container-churn guard — drop every raw row for a cid that has produced
        # no sample in the last RAW_RETENTION_HOURS (container removed / renamed).
        # Run before the plain age delete so a churned cid clears in one pass.
        await self.db.execute(
            "DELETE FROM container_samples WHERE cid NOT IN "
            "(SELECT DISTINCT cid FROM container_samples WHERE ts >= ?)",
            (raw_cutoff,),
        )
        await self.db.execute("DELETE FROM host_samples WHERE ts < ?", (raw_cutoff,))
        await self.db.execute("DELETE FROM container_samples WHERE ts < ?", (raw_cutoff,))

        rollup_cutoff = current_hour - cfg.rollup_retention_days * DAY
        await self.db.execute("DELETE FROM rollup_host_1h WHERE ts < ?", (rollup_cutoff,))
        await self.db.execute("DELETE FROM rollup_container_1h WHERE ts < ?", (rollup_cutoff,))

        # trim audit_log to max(5000 rows, 1 year)
        await self.db.execute(
            "DELETE FROM audit_log WHERE ts < ? AND id NOT IN "
            "(SELECT id FROM audit_log ORDER BY id DESC LIMIT ?)",
            (t - 365 * DAY, cfg.audit_max_rows),
        )

        await self.db.set_meta("last_prune_ts", t)
        await self.db.wal_checkpoint()

        last_vacuum = int(await self.db.get_meta("last_vacuum_ts") or 0)
        if t - last_vacuum > 7 * DAY:
            await self.db.incremental_vacuum()
            await self.db.set_meta("last_vacuum_ts", t)

    async def _rollup_host(self, ts_from: int, ts_to: int) -> None:
        await self.db.execute(
            """
            INSERT OR REPLACE INTO rollup_host_1h
            SELECT (ts/3600)*3600 AS bucket,
                   AVG(cpu_pct), MAX(cpu_pct), AVG(load1), MAX(load1),
                   AVG(mem_pct), MAX(mem_pct), AVG(swap_pct),
                   AVG(disk_pct), MAX(disk_pct),
                   AVG(net_rx_rate), MAX(net_rx_rate), AVG(net_tx_rate), MAX(net_tx_rate),
                   AVG(disk_read_rate), AVG(disk_write_rate),
                   AVG(temp_c), MAX(temp_c), COUNT(*)
            FROM host_samples
            WHERE ts >= ? AND ts < ?
            GROUP BY bucket
            """,
            (ts_from, ts_to),
        )

    async def _rollup_containers(self, ts_from: int, ts_to: int) -> None:
        await self.db.execute(
            """
            INSERT OR REPLACE INTO rollup_container_1h
            SELECT (ts/3600)*3600 AS bucket, cid, MAX(name),
                   AVG(cpu_pct), MAX(cpu_pct), AVG(mem_pct), MAX(mem_pct),
                   AVG(mem_used), AVG(net_rx_rate), AVG(net_tx_rate), COUNT(*)
            FROM container_samples
            WHERE ts >= ? AND ts < ?
            GROUP BY bucket, cid
            """,
            (ts_from, ts_to),
        )

    # -- status for /health & /api/collector/status --------------------
    def lag_s(self) -> int | None:
        if self.last_host_sample_ts is None:
            return None
        return max(0, now() - self.last_host_sample_ts)

    async def status(self) -> dict[str, Any]:
        counts = {}
        for table in (
            "host_samples", "container_samples", "rollup_host_1h",
            "rollup_container_1h", "audit_log",
        ):
            counts[table] = await self.db.scalar(f"SELECT COUNT(*) FROM {table}")
        last_prune = int(await self.db.get_meta("last_prune_ts") or 0)
        last_rollup = int(await self.db.get_meta("last_rollup_ts") or 0)
        return {
            "rows": counts,
            "db_size_bytes": await self.db.size_bytes(),
            "last_host_sample_ts": self.last_host_sample_ts,
            "last_container_sample_ts": self.last_container_sample_ts,
            "lag_s": self.lag_s(),
            "last_prune_ts": last_prune or None,
            "last_rollup_ts": last_rollup or None,
            "next_prune_due": (last_prune + cfg.retention_interval_s) if last_prune else None,
            "last_error": self.last_error,
        }


def _state_str(c: dict[str, Any]) -> str:
    st = c.get("State")
    if isinstance(st, dict):
        return (st.get("Status") or "").lower()
    return (st or "").lower()


def _name_of(c: dict[str, Any]) -> str:
    names = c.get("Names")
    if names:
        return names[0].lstrip("/")
    name = c.get("Name") or ""
    return name.lstrip("/") or (c.get("Id", "")[:12])


def _restart_count(c: dict[str, Any]) -> int | None:
    rp = c.get("RestartCount")
    if rp is not None:
        return rp
    st = c.get("State")
    return st.get("RestartCount") if isinstance(st, dict) else None


def _health_of(c: dict[str, Any]) -> str | None:
    st = c.get("State")
    if isinstance(st, dict):
        h = st.get("Health")
        if isinstance(h, dict):
            return h.get("Status")
    status = c.get("Status") or ""
    if "(healthy)" in status:
        return "healthy"
    if "(unhealthy)" in status:
        return "unhealthy"
    return None
