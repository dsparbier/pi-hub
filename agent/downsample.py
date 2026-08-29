"""Server-side downsampling for ``/api/host/metrics/range``.

Pure functions — unit-tested in ``tests/test_downsample.py``. Given raw or hourly rows
already fetched from SQLite, bucket them to at most ``points`` points and aggregate each
numeric column (AVG, with MAX available). Gaps stay gaps: an empty bucket is simply
absent from the series, never interpolated.
"""
from __future__ import annotations

from typing import Any, Iterable

DEFAULT_POINTS = 300
MAX_POINTS = 2000
RAW_SPAN_LIMIT_S = 48 * 3600

# requested metric name -> (raw column, rollup avg column, rollup max column)
METRIC_MAP: dict[str, list[tuple[str, str, str]]] = {
    "cpu": [("cpu_pct", "cpu_pct_avg", "cpu_pct_max")],
    "mem": [("mem_pct", "mem_pct_avg", "mem_pct_max")],
    "swap": [("swap_pct", "swap_pct_avg", "swap_pct_avg")],
    "load": [("load1", "load1_avg", "load1_max")],
    "disk": [("disk_pct", "disk_pct_avg", "disk_pct_max")],
    "temp": [("temp_c", "temp_c_avg", "temp_c_max")],
    "net": [
        ("net_rx_rate", "net_rx_rate_avg", "net_rx_rate_max"),
        ("net_tx_rate", "net_tx_rate_avg", "net_tx_rate_max"),
    ],
    "diskio": [
        ("disk_read_rate", "disk_read_rate_avg", "disk_read_rate_avg"),
        ("disk_write_rate", "disk_write_rate_avg", "disk_write_rate_avg"),
    ],
}


def resolve_metrics(requested: Iterable[str]) -> list[str]:
    out: list[str] = []
    for name in requested:
        name = name.strip().lower()
        if name in METRIC_MAP:
            out.append(name)
    return out or ["cpu", "mem"]


def choose_resolution(span_s: int, bucket_s: float) -> str:
    """raw when the window is short AND the bucket is sub-hour, else the 1h rollup."""
    if span_s <= RAW_SPAN_LIMIT_S and bucket_s < 3600:
        return "raw"
    return "1h"


def bucket_size(span_s: int, points: int) -> float:
    points = max(1, min(points, MAX_POINTS))
    return max(1.0, span_s / points)


def downsample(
    rows: list[dict[str, Any]],
    columns: list[str],
    *,
    ts_from: int,
    bucket_s: float,
    agg: str = "avg",
) -> dict[str, list[list[float]]]:
    """Bucket ``rows`` (each a dict with ``ts`` + the requested columns).

    Returns ``{column: [[bucket_ts, value], ...]}`` — one entry per non-empty bucket.
    """
    acc: dict[int, dict[str, list[float]]] = {}
    order: list[int] = []
    for row in rows:
        ts = row.get("ts")
        if ts is None:
            continue
        b = ts_from + int((ts - ts_from) // bucket_s) * int(bucket_s) if bucket_s >= 1 else ts
        if b not in acc:
            acc[b] = {c: [] for c in columns}
            order.append(b)
        for c in columns:
            v = row.get(c)
            if v is not None:
                acc[b][c].append(float(v))

    series: dict[str, list[list[float]]] = {c: [] for c in columns}
    for b in sorted(order):
        for c in columns:
            vals = acc[b][c]
            if not vals:
                continue
            value = max(vals) if agg == "max" else sum(vals) / len(vals)
            series[c].append([b, round(value, 3)])
    return series
