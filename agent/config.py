"""Environment-driven configuration for pi-hub-agent.

All knobs come from the container environment (set in docker-compose.yml). Values are
read once at import time; there is no reload. See docs/AGENT.md for the full table.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return list(default)
    return [p.strip() for p in raw.split(",") if p.strip()]


@dataclass(frozen=True)
class Config:
    # --- auth -------------------------------------------------------------
    read_key: str = os.environ.get("AGENT_READ_KEY", "")
    admin_key: str = os.environ.get("AGENT_ADMIN_KEY", "")

    # --- host visibility ------------------------------------------------
    host_root: str = os.environ.get("HOST_ROOT", "/host")
    disk_mounts: list[str] = field(default_factory=lambda: _list("DISK_MOUNTS", ["/host"]))

    # --- sampling ----------------------------------------------------------
    sample_interval_host: int = _int("SAMPLE_INTERVAL_HOST", 15)
    sample_interval_containers: int = _int("SAMPLE_INTERVAL_CONTAINERS", 30)

    # --- retention -------------------------------------------------------
    raw_retention_hours: int = _int("RAW_RETENTION_HOURS", 48)
    rollup_retention_days: int = _int("ROLLUP_RETENTION_DAYS", 90)
    retention_interval_s: int = _int("RETENTION_INTERVAL_S", 1800)  # 30 min

    # --- Plan 2 — container control + exec ------------------------------
    enable_exec: bool = _bool("ENABLE_EXEC", True)
    max_exec_sessions: int = _int("MAX_EXEC_SESSIONS", 3)
    exec_idle_timeout_s: int = _int("EXEC_IDLE_TIMEOUT_S", 300)      # 5 min no I/O
    exec_max_duration_s: int = _int("EXEC_MAX_DURATION_S", 3600)     # 1 h hard cap
    exec_allowed_cmds: list[str] = field(
        default_factory=lambda: _list("EXEC_ALLOWED_CMDS", ["/bin/sh", "/bin/bash", "sh", "bash"])
    )

    # --- storage --------------------------------------------------------
    # SQL-Hub is the production backend (fleet-wide default: SQL database sources go
    # through SQL-Hub over a local/embedded DB, see ~/projects/CLAUDE.md). db_path is
    # now only the local-sqlite *fallback* path, used when SQL_HUB_URL isn't set
    # (tests set AGENT_DB_PATH=":memory:" and leave SQL_HUB_URL unset — see
    # tests/conftest.py and db.py's open_database()).
    sql_hub_url: str = os.environ.get("SQL_HUB_URL", "")
    sql_hub_api_key: str = os.environ.get("SQL_HUB_API_KEY", "")
    sql_hub_db_name: str = os.environ.get("SQL_HUB_DB_NAME", "pi-hub-agent.db")
    db_path: str = os.environ.get("AGENT_DB_PATH", "/data/metrics.db")

    # --- misc ----------------------------------------------------------
    ws_auth_timeout_s: float = float(os.environ.get("WS_AUTH_TIMEOUT_S", "2"))
    stats_stream_interval_s: float = float(os.environ.get("STATS_STREAM_INTERVAL_S", "2"))
    container_stats_concurrency: int = _int("CONTAINER_STATS_CONCURRENCY", 4)

    @property
    def audit_max_rows(self) -> int:
        return 5000


cfg = Config()
