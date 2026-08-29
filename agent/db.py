"""SQLite metrics store for pi-hub-agent.

No ORM — stdlib ``sqlite3`` behind a single dedicated worker thread so every read and
write is serialised onto one connection (WAL still lets external readers in). The full
schema — including ``audit_log``, which only Plan 2 populates — is created on first open.

Public surface is async: ``await db.execute(...)``, ``await db.query(...)`` etc. The
event loop never blocks on the file; the worker thread does.
"""
from __future__ import annotations

import asyncio
import os
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Iterable, Sequence

SCHEMA_VERSION = 1

_SCHEMA = """
CREATE TABLE IF NOT EXISTS host_samples (
  ts INTEGER PRIMARY KEY,
  cpu_pct REAL, cpu_pct_percore TEXT,
  load1 REAL, load5 REAL, load15 REAL,
  mem_total INTEGER, mem_used INTEGER, mem_avail INTEGER, mem_pct REAL,
  swap_total INTEGER, swap_used INTEGER, swap_pct REAL,
  disk_total INTEGER, disk_used INTEGER, disk_pct REAL,
  disk_extra TEXT,
  net_rx_bytes INTEGER, net_tx_bytes INTEGER, net_rx_rate REAL, net_tx_rate REAL,
  disk_read_bytes INTEGER, disk_write_bytes INTEGER, disk_read_rate REAL, disk_write_rate REAL,
  temp_c REAL, uptime_s INTEGER
);

CREATE TABLE IF NOT EXISTS container_samples (
  ts INTEGER NOT NULL, cid TEXT NOT NULL, name TEXT NOT NULL,
  state TEXT, cpu_pct REAL,
  mem_used INTEGER, mem_limit INTEGER, mem_pct REAL,
  net_rx_bytes INTEGER, net_tx_bytes INTEGER, net_rx_rate REAL, net_tx_rate REAL,
  blk_read INTEGER, blk_write INTEGER, pids INTEGER,
  restart_count INTEGER, health TEXT,
  PRIMARY KEY (ts, cid)
);
CREATE INDEX IF NOT EXISTS ix_cs_cid_ts ON container_samples(cid, ts);

CREATE TABLE IF NOT EXISTS rollup_host_1h (
  ts INTEGER PRIMARY KEY,
  cpu_pct_avg REAL, cpu_pct_max REAL, load1_avg REAL, load1_max REAL,
  mem_pct_avg REAL, mem_pct_max REAL, swap_pct_avg REAL,
  disk_pct_avg REAL, disk_pct_max REAL,
  net_rx_rate_avg REAL, net_rx_rate_max REAL, net_tx_rate_avg REAL, net_tx_rate_max REAL,
  disk_read_rate_avg REAL, disk_write_rate_avg REAL,
  temp_c_avg REAL, temp_c_max REAL, sample_count INTEGER
);

CREATE TABLE IF NOT EXISTS rollup_container_1h (
  ts INTEGER NOT NULL, cid TEXT NOT NULL, name TEXT,
  cpu_pct_avg REAL, cpu_pct_max REAL, mem_pct_avg REAL, mem_pct_max REAL,
  mem_used_avg INTEGER, net_rx_rate_avg REAL, net_tx_rate_avg REAL, sample_count INTEGER,
  PRIMARY KEY (ts, cid)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL, actor TEXT, client_ip TEXT,
  action TEXT NOT NULL,
  target TEXT, params TEXT,
  result TEXT, detail TEXT, duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS ix_audit_ts ON audit_log(ts);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
"""


class Database:
    def __init__(self, path: str) -> None:
        self.path = path
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="agent-db")
        self._conn: sqlite3.Connection | None = None

    # -- lifecycle -------------------------------------------------------
    async def connect(self) -> None:
        await self._run(self._connect_sync)

    def _connect_sync(self) -> None:
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA auto_vacuum=INCREMENTAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.executescript(_SCHEMA)
        conn.execute(
            "INSERT INTO meta(k, v) VALUES('schema_version', ?) "
            "ON CONFLICT(k) DO UPDATE SET v=excluded.v",
            (str(SCHEMA_VERSION),),
        )
        conn.commit()
        self._conn = conn

    async def close(self) -> None:
        await self._run(self._close_sync)
        self._pool.shutdown(wait=True)

    def _close_sync(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    # -- helpers -------------------------------------------------------
    async def _run(self, fn, *args):
        return await asyncio.get_running_loop().run_in_executor(self._pool, fn, *args)

    @property
    def _c(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("Database.connect() was not called")
        return self._conn

    # -- writes ---------------------------------------------------------
    async def execute(self, sql: str, params: Sequence[Any] = ()) -> int:
        def _do() -> int:
            cur = self._c.execute(sql, params)
            self._c.commit()
            return cur.rowcount

        return await self._run(_do)

    async def executemany(self, sql: str, seq: Iterable[Sequence[Any]]) -> int:
        rows = list(seq)

        def _do() -> int:
            cur = self._c.executemany(sql, rows)
            self._c.commit()
            return cur.rowcount

        return await self._run(_do)

    async def executescript(self, script: str) -> None:
        def _do() -> None:
            self._c.executescript(script)
            self._c.commit()

        await self._run(_do)

    # -- reads --------------------------------------------------------
    async def query(self, sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
        def _do() -> list[dict[str, Any]]:
            return [dict(r) for r in self._c.execute(sql, params).fetchall()]

        return await self._run(_do)

    async def query_one(self, sql: str, params: Sequence[Any] = ()) -> dict[str, Any] | None:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def scalar(self, sql: str, params: Sequence[Any] = ()) -> Any:
        row = await self.query_one(sql, params)
        if not row:
            return None
        return next(iter(row.values()))

    # -- meta / maintenance ----------------------------------------------
    async def get_meta(self, key: str) -> str | None:
        return await self.scalar("SELECT v FROM meta WHERE k=?", (key,))

    async def set_meta(self, key: str, value: str) -> None:
        await self.execute(
            "INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
            (key, str(value)),
        )

    async def wal_checkpoint(self) -> None:
        await self._run(lambda: self._c.execute("PRAGMA wal_checkpoint(TRUNCATE)"))

    async def incremental_vacuum(self) -> None:
        await self._run(lambda: self._c.execute("PRAGMA incremental_vacuum"))

    async def size_bytes(self) -> int:
        if self.path == ":memory:":
            page_count = await self.scalar("PRAGMA page_count")
            page_size = await self.scalar("PRAGMA page_size")
            return int(page_count or 0) * int(page_size or 0)
        try:
            total = os.path.getsize(self.path)
            for suffix in ("-wal", "-shm"):
                p = self.path + suffix
                if os.path.exists(p):
                    total += os.path.getsize(p)
            return total
        except OSError:
            return 0

    async def ok(self) -> bool:
        try:
            return (await self.scalar("SELECT 1")) == 1
        except Exception:
            return False


def now() -> int:
    return int(time.time())
