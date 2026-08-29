"""Range endpoint: series keys must be canonical (cpu_pct, not cpu_pct_avg)
whether the data came from raw rows or the hourly rollup."""
import time

import pytest

from agent.collector import HOUR
from agent.host_metrics import HOST_SAMPLE_COLUMNS
from tests.conftest import READ_KEY


async def _insert_host(db, ts, cpu, mem):
    cols = ",".join(HOST_SAMPLE_COLUMNS)
    ph = ",".join("?" for _ in HOST_SAMPLE_COLUMNS)
    row = {c: None for c in HOST_SAMPLE_COLUMNS}
    row.update(ts=ts, cpu_pct=cpu, mem_pct=mem, net_rx_rate=10.0, net_tx_rate=5.0)
    await db.execute(f"INSERT INTO host_samples ({cols}) VALUES ({ph})",
                     [row[c] for c in HOST_SAMPLE_COLUMNS])


@pytest.mark.asyncio
async def test_range_raw_keys(client, db):
    now = int(time.time())
    for i in range(6):
        await _insert_host(db, now - 300 + i * 50, 10 + i, 40 + i)
    r = await client.get(
        f"/api/host/metrics/range?from={now - 600}&to={now}&metrics=cpu,mem,net&points=300",
        headers={"X-API-Key": READ_KEY},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["resolution"] == "raw"
    assert set(body["series"]) == {"cpu_pct", "mem_pct", "net_rx_rate", "net_tx_rate"}
    assert len(body["series"]["cpu_pct"]) >= 1


@pytest.mark.asyncio
async def test_range_rollup_keys_are_canonical(client, db):
    now = int(time.time())
    bucket = ((now - 5 * 86400) // HOUR) * HOUR
    await db.execute(
        "INSERT INTO rollup_host_1h (ts, cpu_pct_avg, cpu_pct_max, mem_pct_avg, "
        "net_rx_rate_avg, net_tx_rate_avg, sample_count) VALUES (?,?,?,?,?,?,?)",
        (bucket, 22.0, 40.0, 55.0, 9.0, 4.0, 30),
    )
    # span > 48h forces the hourly rollup regardless of points
    frm = now - 6 * 86400
    to = now
    r = await client.get(
        f"/api/host/metrics/range?from={frm}&to={to}&metrics=cpu,mem,net&points=10",
        headers={"X-API-Key": READ_KEY},
    )
    body = r.json()
    assert body["resolution"] == "1h"
    assert set(body["series"]) == {"cpu_pct", "mem_pct", "net_rx_rate", "net_tx_rate"}
    assert body["series"]["cpu_pct"][0][1] == 22.0
