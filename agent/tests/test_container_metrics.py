from agent import container_metrics as cm


def _frame():
    return {
        "cpu_stats": {
            "cpu_usage": {"total_usage": 200_000, "percpu_usage": [100_000, 100_000]},
            "system_cpu_usage": 2_000_000,
            "online_cpus": 2,
        },
        "precpu_stats": {
            "cpu_usage": {"total_usage": 100_000},
            "system_cpu_usage": 1_000_000,
        },
        "memory_stats": {
            "usage": 300 * 1024 * 1024,
            "limit": 1024 * 1024 * 1024,
            "stats": {"inactive_file": 50 * 1024 * 1024},
        },
        "networks": {
            "eth0": {"rx_bytes": 1000, "tx_bytes": 2000},
            "eth1": {"rx_bytes": 500, "tx_bytes": 0},
        },
        "blkio_stats": {"io_service_bytes_recursive": [
            {"op": "Read", "value": 4096}, {"op": "Write", "value": 8192},
            {"op": "Sync", "value": 999},
        ]},
        "pids_stats": {"current": 12},
    }


def test_parse_cpu_pct():
    # cpu_delta=100k, system_delta=1M, online=2 -> 0.1*2*100 = 20%
    assert cm.parse(_frame())["cpu_pct"] == 20.0


def test_parse_mem_subtracts_page_cache():
    flat = cm.parse(_frame())
    assert flat["mem_used"] == 250 * 1024 * 1024          # 300 - 50 inactive_file
    assert flat["mem_limit"] == 1024 * 1024 * 1024
    assert flat["mem_pct"] == round(250 / 1024 * 100, 2)


def test_parse_net_and_blk_sum():
    flat = cm.parse(_frame())
    assert flat["net_rx_bytes"] == 1500 and flat["net_tx_bytes"] == 2000
    assert flat["blk_read"] == 4096 and flat["blk_write"] == 8192
    assert flat["pids"] == 12


def test_parse_handles_missing_precpu():
    f = _frame()
    f["precpu_stats"] = {}
    assert cm.parse(f)["cpu_pct"] is None


def test_rate_helper():
    assert cm.rate(100, 40, 2.0) == 30.0
    assert cm.rate(100, None, 2.0) is None
    assert cm.rate(100, 40, 0) is None
    assert cm.rate(10, 50, 2.0) == 0.0  # counter reset -> clamp to 0
