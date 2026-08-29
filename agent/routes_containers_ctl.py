"""Container lifecycle control — admin tier, every action audited (Plan 2)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from .audit import AuditSpan, client_ip
from .auth import require_admin
from .db import Database
from .deps import get_db, get_docker, get_tasks
from .docker_client import DockerClient
from .recreate import run_recreate
from .tasks import TaskManager

router = APIRouter(prefix="/api/containers", tags=["containers-ctl"])


async def _simple_action(request, db, docker, cid, action, coro, **params):
    ip = client_ip(request)
    async with AuditSpan(db, actor="admin", ip=ip, action=action, target=cid, params=params or None) as span:
        try:
            await coro
        except Exception as exc:  # noqa: BLE001
            span.result = "error"
            span.detail = str(exc)
            raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True, "action": action, "id": cid}


@router.post("/{cid}/start")
async def start(cid: str, request: Request, _: str = Depends(require_admin),
                db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker)):
    return await _simple_action(request, db, docker, cid, "container.start", docker.start(cid))


@router.post("/{cid}/stop")
async def stop(cid: str, request: Request, t: int = 10, _: str = Depends(require_admin),
               db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker)):
    return await _simple_action(request, db, docker, cid, "container.stop", docker.stop(cid, t=t), t=t)


@router.post("/{cid}/restart")
async def restart(cid: str, request: Request, t: int = 10, _: str = Depends(require_admin),
                  db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker)):
    return await _simple_action(request, db, docker, cid, "container.restart", docker.restart(cid, t=t), t=t)


@router.post("/{cid}/kill")
async def kill(cid: str, request: Request, signal: str = "SIGTERM", _: str = Depends(require_admin),
               db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker)):
    return await _simple_action(request, db, docker, cid, "container.kill", docker.kill(cid, signal=signal), signal=signal)


@router.post("/{cid}/remove")
async def remove(cid: str, request: Request, force: bool = False, volumes: bool = False,
                 _: str = Depends(require_admin), db: Database = Depends(get_db),
                 docker: DockerClient = Depends(get_docker)):
    return await _simple_action(
        request, db, docker, cid, "container.remove",
        docker.remove(cid, force=force, volumes=volumes), force=force, volumes=volumes,
    )


@router.post("/prune")
async def prune_containers(request: Request, _: str = Depends(require_admin),
                           db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker)):
    ip = client_ip(request)
    async with AuditSpan(db, actor="admin", ip=ip, action="containers.prune") as span:
        res = await docker.containers_prune()
        span.detail = f"deleted={len(res.get('ContainersDeleted') or [])} reclaimed={res.get('SpaceReclaimed', 0)}"
    return res


@router.post("/{cid}/recreate", status_code=202)
async def recreate(cid: str, request: Request, body: dict = Body(default={}),
                   _: str = Depends(require_admin), db: Database = Depends(get_db),
                   docker: DockerClient = Depends(get_docker), tasks: TaskManager = Depends(get_tasks)):
    pull = bool(body.get("pull", True))
    force = bool(body.get("force", False))
    ip = client_ip(request)

    async def _job(task):
        async with AuditSpan(db, actor="admin", ip=ip, action="container.recreate",
                             target=cid, params={"pull": pull, "force": force}) as span:
            result = await run_recreate(task, docker, cid, pull=pull, force=force)
            span.result = "ok" if result.get("result") == "recreated" else "error"
            span.detail = str({k: result[k] for k in ("result", "image_old", "image_new", "error")
                               if k in result})

    task = tasks.run("recreate", _job)
    return {"task_id": task.id, "ws": f"/api/tasks/{task.id}"}
