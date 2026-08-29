"""FastAPI application for pi-hub-agent.

The lifespan opens the SQLite store + the Docker client, then starts the three
collector tasks; shutdown cancels them and closes both clients. No CORS middleware —
the only ingress is the console's nginx ``/agent/`` location, so requests are
same-origin.

Plan 1 routers: health, host, read-only containers.
Plan 2 routers: container control, images, task progress WS, and (only when
``ENABLE_EXEC``) the exec WS.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import __version__
from .collector import Collector
from .config import cfg
from .db import Database
from .docker_client import DockerClient
from .routes_containers_ctl import router as containers_ctl_router
from .routes_containers_ro import router as containers_router
from .routes_exec import router as exec_router
from .routes_health import router as health_router
from .routes_host import router as host_router
from .routes_images import router as images_router
from .routes_tasks import router as tasks_router
from .tasks import TaskManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not cfg.read_key or not cfg.admin_key:
        raise RuntimeError("AGENT_READ_KEY and AGENT_ADMIN_KEY must both be set")
    if cfg.read_key == cfg.admin_key:
        raise RuntimeError("AGENT_READ_KEY and AGENT_ADMIN_KEY must differ")

    db = Database(cfg.db_path)
    await db.connect()
    docker = DockerClient()
    await docker.connect()
    collector = Collector(db, docker)
    collector.start()

    app.state.db = db
    app.state.docker = docker
    app.state.collector = collector
    app.state.tasks = TaskManager()
    log.info(
        "pi-hub-agent %s up — db=%s exec=%s", __version__, cfg.db_path, cfg.enable_exec
    )
    try:
        yield
    finally:
        await collector.stop()
        await docker.close()
        await db.close()
        log.info("pi-hub-agent stopped")


app = FastAPI(
    title="pi-hub-agent",
    version=__version__,
    summary="Native host metrics + container management for the Pi-Hub console.",
    lifespan=lifespan,
)

# Plan 1
app.include_router(health_router)
app.include_router(host_router)
app.include_router(containers_router)
# Plan 2
app.include_router(containers_ctl_router)
app.include_router(images_router)
app.include_router(tasks_router)
if cfg.enable_exec:
    app.include_router(exec_router)
