"""``/api/host/*`` and ``/api/collector/status`` — all ``require_read``."""
from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends, Query

from . import downsample as ds
from .auth import require_read
from .collector import Collector
from .db import Database
from .deps import get_collector, get_db

router = APIRouter(prefix="/api", tags=["host"], dependencies=[Depends(require_read)])


@router.get("/host/info")
async def host_info(collector: Collector = Depends(get_collector)):
    return collector.host.info()


@router.get("/host/metrics/current")
async def host_metrics_current(
    db: Database = Depends(get_db),
    collector: Collector = Depends(get_collector),
):
    row = await db.query_one("SELECT * FROM host_samples ORDER BY ts DESC LIMIT 1")
    if not row:
        return {"sample": None, "sources": {}, "age_s": None}
    row["cpu_pct_percore"] = _loads(row.get("cpu_pct_percore"), [])
    row["disk_extra"] = _loads(row.get("disk_extra"), {})
    _, sources = collector.host.read()
    return {
        "sample": row,
        "sources": sources,
        "age_s": max(0, int(time.time()) - row["ts"]),
    }


@router.get("/host/metrics/range")
async def host_metrics_range(
    db: Database = Depends(get_db),
    from_: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    metrics: str = Query("cpu,mem"),
    points: int = Query(ds.DEFAULT_POINTS, ge=1, le=ds.MAX_POINTS),
    agg: str = Query("avg", pattern="^(avg|max)$"),
):
    now = int(time.time())
    to = to or now
    from_ = from_ or (to - 24 * 3600)
    if from_ >= to:
        from_ = to - 3600
    span = to - from_
    bucket = ds.bucket_size(span, points)
    resolution = ds.choose_resolution(span, bucket)
    wanted = ds.resolve_metrics(metrics.split(","))

    # Series are ALWAYS keyed by the canonical raw column name (cpu_pct, mem_pct,
    # load1, disk_pct, temp_c, net_rx_rate, net_tx_rate) so the client reads the
    # same keys whether it got raw rows or the hourly rollup. When hitting the
    # rollup table the rollup columns are aliased back to those names in SQL.
    triples = [t for name in wanted for t in ds.METRIC_MAP[name]]
    seen: set[str] = set()
    cols: list[str] = []
    exprs: list[str] = []
    for raw_col, avg_col, max_col in triples:
        if raw_col in seen:
            continue
        seen.add(raw_col)
        cols.append(raw_col)
        if resolution == "raw":
            exprs.append(raw_col)
        else:
            src = max_col if agg == "max" else avg_col
            exprs.append(f"{src} AS {raw_col}")
    table = "host_samples" if resolution == "raw" else "rollup_host_1h"

    select = ", ".join(["ts", *exprs])
    rows = await db.query(
        f"SELECT {select} FROM {table} WHERE ts >= ? AND ts <= ? ORDER BY ts ASC",
        (from_, to),
    )
    series = ds.downsample(rows, cols, ts_from=from_, bucket_s=bucket, agg=agg)
    return {
        "from": from_,
        "to": to,
        "resolution": resolution,
        "bucket_s": int(bucket),
        "agg": agg,
        "metrics": wanted,
        "series": series,
    }


@router.get("/collector/status")
async def collector_status(collector: Collector = Depends(get_collector)):
    return await collector.status()


@router.get("/logs/streaming/status")
async def logs_streaming_status():
    """Live Central Logs streaming status — FLEET-LOGGING-STANDARD.md §3.3's
    standardized status shape. Enable/disable is env-var-only
    (DEV_HUB_LOG_STREAMING_ENABLED) — see dev_hub_stream.py's docstring."""
    import os
    from .dev_hub_stream import status as stream_status
    return {
        "enabled": os.environ.get("DEV_HUB_LOG_STREAMING_ENABLED", "").lower() == "true",
        **stream_status(),
    }


def _loads(raw, default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return default
