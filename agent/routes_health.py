"""``/health``, ``/ready`` — unauthenticated. Shapes chosen so the console's
``useFleetHealth.js`` can poll ``/agent/health`` with zero hook changes (it reads
``body.version``); the rest of the payload is a superset for the Host Metrics view.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Response

from . import __version__
from .collector import Collector
from .db import Database
from .deps import get_collector, get_db, get_docker
from .docker_client import DockerClient

router = APIRouter(tags=["health"])
_STARTED = time.time()


@router.get("/health")
async def health(
    db: Database = Depends(get_db),
    docker: DockerClient = Depends(get_docker),
    collector: Collector = Depends(get_collector),
):
    ver = await docker.version()
    db_ok = await db.ok()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "pi-hub-agent",
        "version": __version__,
        "uptime_s": int(time.time() - _STARTED),
        "docker": {"ok": bool(ver), "api_version": ver.get("ApiVersion")},
        "db": {"ok": db_ok, "size_bytes": await db.size_bytes()},
        "collector": {
            "last_host_sample_ts": collector.last_host_sample_ts,
            "last_container_sample_ts": collector.last_container_sample_ts,
            "lag_s": collector.lag_s(),
        },
    }


@router.get("/ready")
async def ready(
    response: Response,
    db: Database = Depends(get_db),
    docker: DockerClient = Depends(get_docker),
    collector: Collector = Depends(get_collector),
):
    has_sample = collector.last_host_sample_ts is not None
    docker_ok = await docker.ping()
    ok = has_sample and docker_ok and await db.ok()
    if not ok:
        response.status_code = 503
    return {"ready": ok, "has_sample": has_sample, "docker_ok": docker_ok}
