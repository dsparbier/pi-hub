"""Pure functions that turn a Docker ``/containers/{id}/stats`` frame into flat numbers.

Kept dependency-free and side-effect-free so it is trivially unit-testable. Rates that
need two points in time (net, blkio) are computed by the caller from the cumulative
counters this module returns.
"""
from __future__ import annotations

from typing import Any


def _cpu_pct(frame: dict[str, Any]) -> float | None:
    cpu = frame.get("cpu_stats") or {}
    pre = frame.get("precpu_stats") or {}
    try:
        cpu_total = cpu["cpu_usage"]["total_usage"]
        pre_total = pre["cpu_usage"]["total_usage"]
        system = cpu["system_cpu_usage"]
        pre_system = pre.get("system_cpu_usage", 0)
    except (KeyError, TypeError):
        return None
    cpu_delta = cpu_total - pre_total
    system_delta = system - pre_system
    online = cpu.get("online_cpus") or len(cpu["cpu_usage"].get("percpu_usage") or []) or 1
    if cpu_delta > 0 and system_delta > 0:
        return round((cpu_delta / system_delta) * online * 100.0, 2)
    return 0.0


def _mem(frame: dict[str, Any]) -> tuple[int | None, int | None, float | None]:
    mem = frame.get("memory_stats") or {}
    usage = mem.get("usage")
    limit = mem.get("limit")
    if usage is None:
        return None, limit, None
    # match `docker stats`: subtract page cache
    cache = (mem.get("stats") or {}).get("inactive_file")
    if cache is None:
        cache = (mem.get("stats") or {}).get("cache", 0)
    used = max(0, usage - (cache or 0))
    pct = round(used / limit * 100.0, 2) if limit else None
    return used, limit, pct


def _net(frame: dict[str, Any]) -> tuple[int, int]:
    rx = tx = 0
    for iface in (frame.get("networks") or {}).values():
        rx += iface.get("rx_bytes", 0)
        tx += iface.get("tx_bytes", 0)
    return rx, tx


def _blk(frame: dict[str, Any]) -> tuple[int, int]:
    read = write = 0
    for entry in (frame.get("blkio_stats") or {}).get("io_service_bytes_recursive") or []:
        op = (entry.get("op") or "").lower()
        if op == "read":
            read += entry.get("value", 0)
        elif op == "write":
            write += entry.get("value", 0)
    return read, write


def parse(frame: dict[str, Any]) -> dict[str, Any]:
    """Flatten one stats frame. Cumulative counters + a computed cpu_pct/mem."""
    used, limit, pct = _mem(frame)
    rx, tx = _net(frame)
    blk_read, blk_write = _blk(frame)
    return {
        "cpu_pct": _cpu_pct(frame),
        "mem_used": used,
        "mem_limit": limit,
        "mem_pct": pct,
        "net_rx_bytes": rx,
        "net_tx_bytes": tx,
        "blk_read": blk_read,
        "blk_write": blk_write,
        "pids": (frame.get("pids_stats") or {}).get("current"),
    }


def rate(cur: int | None, prev: int | None, dt: float | None) -> float | None:
    if cur is None or prev is None or not dt or dt <= 0:
        return None
    return max(0.0, (cur - prev) / dt)
