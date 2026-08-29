import time

import pytest

from agent.collector import DAY, HOUR, Collector
from agent.host_metrics import HOST_SAMPLE_COLUMNS


async def _insert_host(db, ts, cpu):
    cols = ",".join(HOST_SAMPLE_COLUMNS)
    ph = ",".join("?" for _ in HOST_SAMPLE_COLUMNS)
    row = {c: None for c in HOST_SAMPLE_COLUMNS}
    row.update(ts=ts, cpu_pct=cpu, load1=0.5, mem_pct=40.0, swap_pct=0.0,
               disk_pct=50.0, net_rx_rate=1.0, net_tx_rate=2.0,
               disk_read_rate=0.0, disk_write_rate=0.0, temp_c=45.0)
    await db.execute(f"INSERT INTO host_samples ({cols}) VALUES ({ph})",
                     [row[c] for c in HOST_SAMPLE_COLUMNS])


@pytest.mark.asyncio
async def test_retention_prunes_raw_and_builds_rollups(db):
    col = Collector(db, docker=None)
    now = int(time.time())
    old_hour = ((now - 5 * DAY) // HOUR) * HOUR
    # two samples in one old hour bucket + one fresh sample
    await _insert_host(db, old_hour + 10, 20.0)
    await _insert_host(db, old_hour + 40, 40.0)
    await _insert_host(db, now - 120, 12.0)

    await db.execute(
        "INSERT INTO container_samples (ts, cid, name, state, cpu_pct, mem_pct, "
        "net_rx_rate, net_tx_rate, mem_used) VALUES (?,?,?,?,?,?,?,?,?)",
        (old_hour + 10, "c1", "svc", "running", 5.0, 10.0, 1.0, 1.0, 1000),
    )

    await col._run_retention()

    # raw older than 48h is gone; the fresh row survives
    remaining = await db.query("SELECT ts FROM host_samples ORDER BY ts")
    assert [r["ts"] for r in remaining] == [now - 120]
    assert await db.scalar("SELECT COUNT(*) FROM container_samples") == 0

    # the old hour was rolled up (avg 30, max 40)
    roll = await db.query_one("SELECT * FROM rollup_host_1h WHERE ts=?", (old_hour,))
    assert roll is not None
    assert round(roll["cpu_pct_avg"], 1) == 30.0
    assert roll["cpu_pct_max"] == 40.0
    assert roll["sample_count"] == 2

    croll = await db.query_one("SELECT * FROM rollup_container_1h WHERE ts=?", (old_hour,))
    assert croll is not None and croll["cid"] == "c1"

    assert await db.get_meta("last_prune_ts") is not None
    assert await db.get_meta("last_rollup_ts") == str(((now) // HOUR) * HOUR)


@pytest.mark.asyncio
async def test_rollup_retention_drops_ancient_buckets(db):
    col = Collector(db, docker=None)
    now = int(time.time())
    ancient = ((now - 200 * DAY) // HOUR) * HOUR
    await db.execute(
        "INSERT INTO rollup_host_1h (ts, cpu_pct_avg, sample_count) VALUES (?,?,?)",
        (ancient, 10.0, 1),
    )
    await col._run_retention()
    assert await db.query_one("SELECT * FROM rollup_host_1h WHERE ts=?", (ancient,)) is None
