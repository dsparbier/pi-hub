"""Host metric collection via psutil, with container-visibility handling.

Linux does not virtualise system-wide ``/proc``, so inside a container psutil already
reads **host** values for CPU / load / mem / swap / uptime / disk-IO. The gaps we patch
here (see docs/PLAN §3):

  * disk usage  — container sees its own rootfs, so we ``disk_usage(HOST_ROOT/…)``.
  * network     — container netns hides real NICs, so we parse ``HOST_ROOT/proc/net/dev``.
  * cpu temp    — try ``/sys/class/thermal`` then ``HOST_ROOT/sys/...``.

Every value carries a ``source`` in the returned ``sources`` map:
``"host"`` | ``"container"`` | ``"unavailable"``.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

import psutil

from .config import cfg

_THERMAL_PATHS = (
    "/sys/class/thermal/thermal_zone0/temp",
    os.path.join(cfg.host_root, "sys/class/thermal/thermal_zone0/temp"),
)


def _read_temp_c() -> float | None:
    # psutil first (works when /sys is visible and labelled)
    try:
        temps = psutil.sensors_temperatures()
        for label in ("cpu_thermal", "cpu-thermal", "coretemp", "soc_thermal"):
            if label in temps and temps[label]:
                return round(float(temps[label][0].current), 1)
        for entries in temps.values():
            if entries:
                return round(float(entries[0].current), 1)
    except Exception:
        pass
    for path in _THERMAL_PATHS:
        try:
            with open(path) as fh:
                milli = int(fh.read().strip())
            return round(milli / 1000.0, 1)
        except (OSError, ValueError):
            continue
    return None


def _parse_net_dev() -> tuple[int, int] | None:
    """Sum rx/tx bytes across real host NICs from HOST_ROOT/proc/net/dev.

    Skips ``lo`` and virtual interfaces (docker/veth/br-/kube). Returns
    ``(rx_bytes, tx_bytes)`` or ``None`` if the file is not readable.
    """
    path = os.path.join(cfg.host_root, "proc/net/dev")
    skip_prefix = ("lo", "docker", "veth", "br-", "virbr", "kube", "cni", "flannel", "tailscale")
    try:
        with open(path) as fh:
            lines = fh.readlines()
    except OSError:
        return None
    rx_total = tx_total = 0
    for line in lines:
        if ":" not in line:
            continue
        name, _, rest = line.partition(":")
        name = name.strip()
        if name.startswith(skip_prefix):
            continue
        fields = rest.split()
        if len(fields) < 16:
            continue
        try:
            rx_total += int(fields[0])
            tx_total += int(fields[8])
        except ValueError:
            continue
    return rx_total, tx_total


class HostMetricsReader:
    """Stateful reader — rates are derived from the delta since the previous read."""

    def __init__(self) -> None:
        self._prev_net: tuple[int, int] | None = None
        self._prev_diskio: tuple[int, int] | None = None
        self._prev_ts: float | None = None
        # prime psutil's internal cpu-percent baseline
        psutil.cpu_percent(interval=None)
        psutil.cpu_percent(interval=None, percpu=True)

    # -- static info ---------------------------------------------------
    def info(self) -> dict[str, Any]:
        uname = os.uname()
        vm = psutil.virtual_memory()
        try:
            freq = psutil.cpu_freq()
        except Exception:
            freq = None
        sample, sources = self.read()
        return {
            "hostname": uname.nodename,
            "kernel": uname.release,
            "os": f"{uname.sysname} {uname.machine}",
            "cpu_model": _cpu_model(),
            "cpu_cores": psutil.cpu_count(logical=True),
            "cpu_cores_physical": psutil.cpu_count(logical=False),
            "cpu_freq_mhz": round(freq.current, 0) if freq else None,
            "mem_total": vm.total,
            "boot_time": int(psutil.boot_time()),
            "host_root": cfg.host_root,
            "disk_mounts": cfg.disk_mounts,
            "sources": sources,
        }

    # -- sample ------------------------------------------------------
    def read(self) -> tuple[dict[str, Any], dict[str, str]]:
        now = time.time()
        dt = (now - self._prev_ts) if self._prev_ts else None
        sources: dict[str, str] = {}
        row: dict[str, Any] = {"ts": int(now)}

        # CPU / load -------------------------------------------------------
        row["cpu_pct"] = psutil.cpu_percent(interval=None)
        row["cpu_pct_percore"] = json.dumps(psutil.cpu_percent(interval=None, percpu=True))
        sources["cpu"] = "host"
        try:
            l1, l5, l15 = os.getloadavg()
            row["load1"], row["load5"], row["load15"] = l1, l5, l15
            sources["load"] = "host"
        except OSError:
            row["load1"] = row["load5"] = row["load15"] = None
            sources["load"] = "unavailable"

        # Memory / swap -------------------------------------------------
        vm = psutil.virtual_memory()
        row.update(
            mem_total=vm.total, mem_used=vm.total - vm.available,
            mem_avail=vm.available, mem_pct=vm.percent,
        )
        sources["mem"] = "host"
        sw = psutil.swap_memory()
        row.update(swap_total=sw.total, swap_used=sw.used, swap_pct=sw.percent)
        sources["swap"] = "host"

        # Disk usage --------------------------------------------------------
        extra: dict[str, dict[str, Any]] = {}
        primary_set = False
        for i, mount in enumerate(cfg.disk_mounts):
            try:
                du = psutil.disk_usage(mount)
            except OSError:
                continue
            if i == 0:
                row.update(disk_total=du.total, disk_used=du.used, disk_pct=du.percent)
                primary_set = True
            else:
                extra[mount] = {"total": du.total, "used": du.used, "pct": du.percent}
        row["disk_extra"] = json.dumps(extra) if extra else None
        if not primary_set:
            row.update(disk_total=None, disk_used=None, disk_pct=None)
            sources["disk"] = "unavailable"
        else:
            sources["disk"] = "host" if cfg.host_root in cfg.disk_mounts[0] else "container"

        # Network throughput ---------------------------------------------
        net = _parse_net_dev()
        if net is not None:
            row["net_rx_bytes"], row["net_tx_bytes"] = net
            if self._prev_net and dt and dt > 0:
                row["net_rx_rate"] = max(0.0, (net[0] - self._prev_net[0]) / dt)
                row["net_tx_rate"] = max(0.0, (net[1] - self._prev_net[1]) / dt)
            else:
                row["net_rx_rate"] = row["net_tx_rate"] = None
            self._prev_net = net
            sources["net"] = "host"
        else:
            row.update(net_rx_bytes=None, net_tx_bytes=None, net_rx_rate=None, net_tx_rate=None)
            sources["net"] = "unavailable"

        # Disk IO --------------------------------------------------------
        try:
            dio = psutil.disk_io_counters()
        except Exception:
            dio = None
        if dio is not None:
            cur = (dio.read_bytes, dio.write_bytes)
            row["disk_read_bytes"], row["disk_write_bytes"] = cur
            if self._prev_diskio and dt and dt > 0:
                row["disk_read_rate"] = max(0.0, (cur[0] - self._prev_diskio[0]) / dt)
                row["disk_write_rate"] = max(0.0, (cur[1] - self._prev_diskio[1]) / dt)
            else:
                row["disk_read_rate"] = row["disk_write_rate"] = None
            self._prev_diskio = cur
            sources["disk_io"] = "host"
        else:
            row.update(
                disk_read_bytes=None, disk_write_bytes=None,
                disk_read_rate=None, disk_write_rate=None,
            )
            sources["disk_io"] = "unavailable"

        # Temp / uptime ------------------------------------------------
        temp = _read_temp_c()
        row["temp_c"] = temp
        sources["temp"] = "host" if temp is not None else "unavailable"
        row["uptime_s"] = int(now - psutil.boot_time())
        sources["uptime"] = "host"

        self._prev_ts = now
        return row, sources


def _cpu_model() -> str | None:
    """Best-effort CPU/board name. x86: `model name`. Raspberry Pi: `Model` (board)
    or `Hardware` (SoC). Never return the bare numeric `model` field."""
    for path in (os.path.join(cfg.host_root, "proc/cpuinfo"), "/proc/cpuinfo"):
        try:
            with open(path) as fh:
                text = fh.read()
        except OSError:
            continue
        by_key: dict[str, str] = {}
        for line in text.splitlines():
            if ":" not in line:
                continue
            key, _, val = line.partition(":")
            by_key.setdefault(key.strip().lower(), val.strip())
        for key in ("model name", "hardware", "model"):
            val = by_key.get(key)
            if val and not val.isdigit():
                return val
    return None


HOST_SAMPLE_COLUMNS = (
    "ts", "cpu_pct", "cpu_pct_percore", "load1", "load5", "load15",
    "mem_total", "mem_used", "mem_avail", "mem_pct",
    "swap_total", "swap_used", "swap_pct",
    "disk_total", "disk_used", "disk_pct", "disk_extra",
    "net_rx_bytes", "net_tx_bytes", "net_rx_rate", "net_tx_rate",
    "disk_read_bytes", "disk_write_bytes", "disk_read_rate", "disk_write_rate",
    "temp_c", "uptime_s",
)
