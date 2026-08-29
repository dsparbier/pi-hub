from agent import downsample as ds


def test_bucket_size_respects_points_cap():
    assert ds.bucket_size(3600, 1) == 3600.0
    assert ds.bucket_size(2000, 4000) == 1.0  # points capped to MAX_POINTS (2000)
    # never below 1s even if points > span
    assert ds.bucket_size(10, 100) == 1.0
    # points cap at MAX_POINTS
    assert ds.bucket_size(ds.MAX_POINTS * 10, 10**9) == 10.0


def test_choose_resolution():
    assert ds.choose_resolution(3600, 60) == "raw"
    assert ds.choose_resolution(ds.RAW_SPAN_LIMIT_S, 3599) == "raw"
    assert ds.choose_resolution(ds.RAW_SPAN_LIMIT_S + 1, 60) == "1h"
    # even inside the span, an hour+ bucket goes to the rollup
    assert ds.choose_resolution(3600, 3600) == "1h"


def test_downsample_avg_and_max():
    rows = [
        {"ts": 0, "cpu_pct": 10.0},
        {"ts": 30, "cpu_pct": 20.0},
        {"ts": 60, "cpu_pct": 60.0},
        {"ts": 90, "cpu_pct": 100.0},
    ]
    avg = ds.downsample(rows, ["cpu_pct"], ts_from=0, bucket_s=60, agg="avg")
    assert avg["cpu_pct"] == [[0, 15.0], [60, 80.0]]
    mx = ds.downsample(rows, ["cpu_pct"], ts_from=0, bucket_s=60, agg="max")
    assert mx["cpu_pct"] == [[0, 20.0], [60, 100.0]]


def test_downsample_leaves_gaps_uninterpolated():
    rows = [{"ts": 0, "cpu_pct": 5.0}, {"ts": 300, "cpu_pct": 9.0}]
    out = ds.downsample(rows, ["cpu_pct"], ts_from=0, bucket_s=60, agg="avg")
    # two points only — the empty buckets between are absent, not zero-filled
    assert out["cpu_pct"] == [[0, 5.0], [300, 9.0]]


def test_downsample_skips_none_values():
    rows = [{"ts": 0, "temp_c": None}, {"ts": 10, "temp_c": 50.0}]
    out = ds.downsample(rows, ["temp_c"], ts_from=0, bucket_s=60, agg="avg")
    assert out["temp_c"] == [[0, 50.0]]


def test_resolve_metrics_filters_unknown_and_defaults():
    assert ds.resolve_metrics(["cpu", "bogus", "net"]) == ["cpu", "net"]
    assert ds.resolve_metrics(["nope"]) == ["cpu", "mem"]
