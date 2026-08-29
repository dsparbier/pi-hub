"""Image management — list/df are read tier; pull/prune are admin + audited (Plan 2)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from .audit import AuditSpan, client_ip
from .auth import require_admin, require_read
from .db import Database
from .deps import get_db, get_docker, get_tasks
from .docker_client import DockerClient
from .recreate import split_ref
from .tasks import TaskManager

router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("", dependencies=[Depends(require_read)])
async def list_images(docker: DockerClient = Depends(get_docker)):
    raw = await docker.images_list(all=False)
    # map image id -> count of containers using it
    using: dict[str, int] = {}
    try:
        for c in await docker.list_containers(all=True):
            img = c.get("ImageID") or c.get("Image")
            if img:
                using[img] = using.get(img, 0) + 1
    except Exception:
        pass
    out = []
    for im in raw:
        iid = im.get("Id")
        tags = im.get("RepoTags") or []
        out.append({
            "id": iid,
            "repo_tags": [t for t in tags if t != "<none>:<none>"],
            "size": im.get("Size"),
            "created": im.get("Created"),
            "containers_using": using.get(iid, 0),
            "dangling": not tags or tags == ["<none>:<none>"],
        })
    out.sort(key=lambda x: (-(x["size"] or 0)))
    return {"images": out, "count": len(out)}


@router.get("/df", dependencies=[Depends(require_read)])
async def images_df(docker: DockerClient = Depends(get_docker)):
    df = await docker.images_df()

    def _sum(section, key="Size"):
        return sum((row.get(key) or 0) for row in (df.get(section) or []))

    def _reclaim(section):
        return sum((row.get("Size") or 0) for row in (df.get(section) or [])
                   if not (row.get("Containers") or row.get("ContainersCount")))

    return {
        "layers_size": df.get("LayersSize"),
        "images_total": _sum("Images"),
        "images_reclaimable": _reclaim("Images"),
        "containers_size": _sum("Containers", "SizeRw"),
        "volumes_size": _sum("Volumes"),
        "build_cache_size": _sum("BuildCache"),
        "raw": {k: len(df.get(k) or []) for k in ("Images", "Containers", "Volumes", "BuildCache")},
    }


@router.post("/pull", status_code=202)
async def pull_image(request: Request, body: dict = Body(...), _: str = Depends(require_admin),
                     db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker),
                     tasks: TaskManager = Depends(get_tasks)):
    ref = (body.get("ref") or "").strip()
    if not ref:
        raise HTTPException(status_code=422, detail="body.ref required, e.g. 'nginx:1.27-alpine'")
    repo, tag = split_ref(ref)
    ip = client_ip(request)

    async def _job(task):
        async with AuditSpan(db, actor="admin", ip=ip, action="image.pull", target=ref) as span:
            task.log(f"pulling {repo}:{tag}")
            count = 0
            async for fr in docker.image_pull(repo, tag=tag if "@" not in tag else None):
                count += 1
                task.progress(layer=fr.get("id"), status=fr.get("status"), detail=fr.get("progress"))
                if fr.get("error"):
                    raise RuntimeError(fr["error"])
            span.detail = f"{count} progress frames"
            task.done({"ref": ref, "frames": count})

    task = tasks.run("pull", _job)
    return {"task_id": task.id, "ws": f"/api/tasks/{task.id}"}


@router.post("/prune")
async def prune_images(request: Request, body: dict = Body(default={}), _: str = Depends(require_admin),
                       db: Database = Depends(get_db), docker: DockerClient = Depends(get_docker)):
    dangling_only = bool(body.get("dangling_only", True))
    ip = client_ip(request)
    async with AuditSpan(db, actor="admin", ip=ip, action="images.prune",
                         params={"dangling_only": dangling_only}) as span:
        res = await docker.images_prune(dangling_only=dangling_only)
        span.detail = f"deleted={len(res.get('ImagesDeleted') or [])} reclaimed={res.get('SpaceReclaimed', 0)}"
    return {
        "deleted": len(res.get("ImagesDeleted") or []),
        "space_reclaimed": res.get("SpaceReclaimed", 0),
    }
