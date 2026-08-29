"""Shared fixtures. Keys are set in the environment *before* ``agent.config`` imports.

Nothing here touches a real Docker socket — a ``FakeDocker`` is placed on ``app.state``.
Tests that do need the socket are marked ``@pytest.mark.integration``.
"""
from __future__ import annotations

import os

os.environ.setdefault("AGENT_READ_KEY", "test-read-key")
os.environ.setdefault("AGENT_ADMIN_KEY", "test-admin-key")
os.environ.setdefault("AGENT_DB_PATH", ":memory:")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from agent.collector import Collector  # noqa: E402
from agent.db import Database  # noqa: E402
from agent.routes_containers_ctl import router as containers_ctl_router  # noqa: E402
from agent.routes_containers_ro import router as containers_router  # noqa: E402
from agent.routes_exec import router as exec_router  # noqa: E402
from agent.routes_health import router as health_router  # noqa: E402
from agent.routes_host import router as host_router  # noqa: E402
from agent.routes_images import router as images_router  # noqa: E402
from agent.routes_tasks import router as tasks_router  # noqa: E402
from agent.tasks import TaskManager  # noqa: E402

READ_KEY = "test-read-key"
ADMIN_KEY = "test-admin-key"


class FakeDocker:
    async def connect(self): ...
    async def close(self): ...

    async def version(self):
        return {"ApiVersion": "1.45", "Version": "27.0.0"}

    async def ping(self):
        return True

    async def list_containers(self, *, all: bool = True):
        return [
            {
                "Id": "abc123",
                "Names": ["/pi-hub"],
                "Image": "pi-hub:latest",
                "State": "running",
                "Status": "Up 2 hours (healthy)",
                "Created": 1_700_000_000,
                "Ports": [{"PrivatePort": 80, "PublicPort": 31106, "Type": "tcp"}],
                "Labels": {"com.docker.compose.project": "pi-hub",
                           "com.docker.compose.service": "pi-hub"},
            }
        ]

    async def inspect(self, cid):
        return {"Id": cid, "Config": {"Labels": {"com.docker.compose.project": "pi-hub"}},
                "Mounts": [], "HostConfig": {}}

    async def stats_once(self, cid):
        return _stats_frame()

    async def logs_once(self, cid, **kw):
        return ["2026-08-29T10:00:00.000000000Z hello world"]

    async def logs_follow(self, cid, **kw):
        for line in ("2026-08-29T10:00:00.000000000Z line one",):
            yield line

    async def stats_stream(self, cid):
        yield _stats_frame()

    # -- control (Plan 2) --------------------------------------------
    calls: list = []

    async def start(self, cid): self.calls.append(("start", cid))
    async def stop(self, cid, *, t=10): self.calls.append(("stop", cid, t))
    async def restart(self, cid, *, t=10): self.calls.append(("restart", cid, t))
    async def kill(self, cid, *, signal="SIGTERM"): self.calls.append(("kill", cid, signal))
    async def remove(self, cid, *, force=False, volumes=False):
        self.calls.append(("remove", cid, force, volumes))
    async def rename(self, cid, new): self.calls.append(("rename", cid, new))
    async def create(self, config, *, name=None):
        self.calls.append(("create", name))
        return "new" + (name or "")
    async def network_connect(self, net, cid, endpoint=None):
        self.calls.append(("net_connect", net, cid))
    async def containers_prune(self):
        return {"ContainersDeleted": ["x"], "SpaceReclaimed": 123}

    async def images_list(self, *, all=False):
        return [{"Id": "sha256:img1", "RepoTags": ["nginx:1.27"], "Size": 1000, "Created": 1},
                {"Id": "sha256:img2", "RepoTags": [], "Size": 50, "Created": 2}]

    async def images_df(self):
        return {"LayersSize": 2000, "Images": [{"Size": 1000, "Containers": 1},
                                               {"Size": 50, "Containers": 0}],
                "Containers": [], "Volumes": [], "BuildCache": []}

    async def image_pull(self, from_image, tag=None):
        for st in ("Pulling from library", "Downloading", "Pull complete"):
            yield {"status": st, "id": "layer1"}

    async def images_prune(self, *, dangling_only=True):
        return {"ImagesDeleted": [{"Deleted": "sha256:img2"}], "SpaceReclaimed": 50}


def _stats_frame():
    return {
        "cpu_stats": {"cpu_usage": {"total_usage": 200, "percpu_usage": [100, 100]},
                      "system_cpu_usage": 2000, "online_cpus": 2},
        "precpu_stats": {"cpu_usage": {"total_usage": 100}, "system_cpu_usage": 1000},
        "memory_stats": {"usage": 200 * 1024 * 1024, "limit": 1024 * 1024 * 1024,
                         "stats": {"inactive_file": 20 * 1024 * 1024}},
        "networks": {"eth0": {"rx_bytes": 5000, "tx_bytes": 3000}},
        "blkio_stats": {"io_service_bytes_recursive": [
            {"op": "read", "value": 100}, {"op": "write", "value": 50}]},
        "pids_stats": {"current": 7},
    }


@pytest_asyncio.fixture
async def db():
    d = Database(":memory:")
    await d.connect()
    yield d
    await d.close()


@pytest_asyncio.fixture
async def app(db):
    a = FastAPI()
    a.state.db = db
    a.state.docker = FakeDocker()
    a.state.docker.calls = []
    a.state.collector = Collector(db, a.state.docker)
    a.state.tasks = TaskManager()
    a.include_router(health_router)
    a.include_router(host_router)
    a.include_router(containers_router)
    a.include_router(containers_ctl_router)
    a.include_router(images_router)
    a.include_router(tasks_router)
    a.include_router(exec_router)
    return a


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        yield c
