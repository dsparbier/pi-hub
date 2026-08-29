"""Recreate a container from its own inspect output — no compose context.

Flow (plan §3): inspect → rebuild create payload → optional pull → stop old → rename old
to ``{name}_old_{ts}`` → create new with the original name → reconnect extra networks →
start new. On any failure: remove the new container, rename ``_old`` back, restart it.

Guards (``recreate_warnings``, need ``force=True`` to override):
  * anonymous volumes  — a Mount of Type "volume" whose Name is 64 hex chars gets a *new*
    empty volume on recreate → silent data loss.
  * multi-network      — ``create`` binds one network; the rest need explicit connect.
  * compose-managed     — labels are preserved but ``docker compose`` will see the
    container as "created outside its run"; the UI calls this "Recreate (ad-hoc)".
"""
from __future__ import annotations

import re
import time
from typing import Any

from .docker_client import DockerClient
from .tasks import Task

_ANON_VOL = re.compile(r"^[0-9a-f]{64}$")

# Config keys worth carrying across a recreate
_CONFIG_KEYS = (
    "Image", "Env", "Cmd", "Entrypoint", "Labels", "WorkingDir", "User",
    "ExposedPorts", "Healthcheck", "Hostname", "Domainname", "AttachStdin",
    "Tty", "OpenStdin", "StdinOnce", "Volumes", "StopSignal", "StopTimeout",
)
_HOSTCONFIG_KEYS = (
    "Binds", "Mounts", "PortBindings", "RestartPolicy", "NetworkMode", "CapAdd",
    "CapDrop", "Devices", "Ulimits", "LogConfig", "GroupAdd", "Privileged",
    "SecurityOpt", "ExtraHosts", "Sysctls", "Dns", "DnsSearch", "DnsOptions",
    "Tmpfs", "ReadonlyRootfs", "ShmSize", "Runtime", "Memory", "NanoCpus",
    "PidMode", "IpcMode", "UsernsMode",
)


def analyse(inspect: dict[str, Any]) -> dict[str, Any]:
    """Return {name, image, compose_project, anonymous_volumes, extra_networks, warnings}."""
    cfg = inspect.get("Config") or {}
    labels = cfg.get("Labels") or {}
    mounts = inspect.get("Mounts") or []
    anon = [
        m.get("Destination")
        for m in mounts
        if m.get("Type") == "volume" and _ANON_VOL.match(m.get("Name", "") or "")
    ]
    nets = (inspect.get("NetworkSettings") or {}).get("Networks") or {}
    primary = (inspect.get("HostConfig") or {}).get("NetworkMode")
    extra = [n for n in nets if n != primary]

    warnings: list[str] = []
    if anon:
        warnings.append(
            f"{len(anon)} anonymous volume(s) ({', '.join(anon)}) — recreate gives them "
            "fresh empty volumes; data is lost. Pass force to proceed."
        )
    if extra:
        warnings.append(
            f"attached to {len(extra) + 1} networks — only the primary is bound at create; "
            f"{', '.join(extra)} are reconnected after."
        )
    if labels.get("com.docker.compose.project"):
        warnings.append(
            "compose-managed (project "
            f"'{labels['com.docker.compose.project']}') — this is an ad-hoc recreate; "
            "prefer the service's own deploy loop."
        )
    return {
        "name": (inspect.get("Name") or "").lstrip("/"),
        "image": cfg.get("Image"),
        "compose_project": labels.get("com.docker.compose.project"),
        "anonymous_volumes": anon,
        "extra_networks": extra,
        "warnings": warnings,
    }


def build_payload(inspect: dict[str, Any]) -> dict[str, Any]:
    cfg = inspect.get("Config") or {}
    hostcfg = inspect.get("HostConfig") or {}
    payload: dict[str, Any] = {k: cfg[k] for k in _CONFIG_KEYS if k in cfg and cfg[k] is not None}
    hc = {k: hostcfg[k] for k in _HOSTCONFIG_KEYS if k in hostcfg and hostcfg[k] is not None}
    payload["HostConfig"] = hc

    # inspect is not a clean round-trip: `container:`/`host`/`none` network modes
    # reject a `Hostname`/`Domainname`/`MacAddress`/`ExposedPorts` in the create body
    # ("conflicting options: hostname and the network mode").
    nm = str(hostcfg.get("NetworkMode") or "")
    if nm in ("host", "none") or nm.startswith("container:"):
        for k in ("Hostname", "Domainname", "MacAddress", "ExposedPorts"):
            payload.pop(k, None)
        hc.pop("PortBindings", None)

    nets = (inspect.get("NetworkSettings") or {}).get("Networks") or {}
    primary = hostcfg.get("NetworkMode")
    if primary in nets:
        ep = nets[primary] or {}
        endpoint = {}
        if ep.get("Aliases"):
            endpoint["Aliases"] = [a for a in ep["Aliases"] if not _looks_like_id(a)]
        if ep.get("IPAMConfig"):
            endpoint["IPAMConfig"] = ep["IPAMConfig"]
        if endpoint:
            payload["NetworkingConfig"] = {"EndpointsConfig": {primary: endpoint}}
    return payload


def _looks_like_id(s: str) -> bool:
    return bool(re.match(r"^[0-9a-f]{12}$", s or ""))


def split_ref(image: str) -> tuple[str, str]:
    """'nginx:1.27-alpine' -> ('nginx', '1.27-alpine'); digest refs keep the digest."""
    if not image:
        return "", "latest"
    if "@" in image:
        repo, digest = image.split("@", 1)
        return repo, digest
    # split tag only after the last '/', so a registry:port host isn't mistaken for a tag
    last = image.rsplit("/", 1)[-1]
    if ":" in last:
        repo, tag = image.rsplit(":", 1)
        return repo, tag
    return image, "latest"


async def run_recreate(
    task: Task,
    docker: DockerClient,
    cid: str,
    *,
    pull: bool,
    force: bool,
) -> dict[str, Any]:
    task.log("inspecting container")
    inspect = await docker.inspect(cid)
    info = analyse(inspect)
    name = info["name"]
    old_cid = inspect.get("Id") or cid
    old_image_id = (inspect.get("Image") or "")[:19]

    if info["warnings"] and not force:
        task.error("blocked by guard — pass force to override", detail={"warnings": info["warnings"]})
        return {"result": "blocked", "warnings": info["warnings"]}

    payload = build_payload(inspect)
    repo, tag = split_ref(info["image"])
    renamed = f"{name}_old_{int(time.time())}"

    if pull and repo:
        task.log(f"pulling {repo}:{tag}")
        async for fr in docker.image_pull(repo, tag=tag if "@" not in tag else None):
            status = fr.get("status") or ""
            task.progress(layer=fr.get("id"), status=status, detail=fr.get("progress"))
        task.log("pull complete")

    task.log("stopping old container")
    try:
        await docker.stop(cid, t=10)
    except Exception as exc:  # already stopped is fine
        task.log(f"stop: {exc}")

    task.log(f"renaming old → {renamed}")
    await docker.rename(cid, renamed)

    new_id = None
    try:
        task.log(f"creating new container '{name}'")
        new_id = await docker.create(payload, name=name)
        for net in info["extra_networks"]:
            ep = ((inspect.get("NetworkSettings") or {}).get("Networks") or {}).get(net) or {}
            endpoint = {"Aliases": [a for a in (ep.get("Aliases") or []) if not _looks_like_id(a)]}
            task.log(f"connecting network {net}")
            await docker.network_connect(net, new_id, endpoint or None)
        task.log("starting new container")
        await docker.start(new_id)
    except Exception as exc:
        task.log(f"failure: {exc} — rolling back")
        if new_id:
            try:
                await docker.remove(new_id, force=True)
            except Exception:
                pass
        try:
            await docker.rename(renamed, name)
            await docker.start(name)
        except Exception as rb:
            task.log(f"rollback also failed: {rb}")
        task.error("recreate failed, rolled back", detail={"error": str(exc), "warnings": info["warnings"]})
        return {"result": "rolled_back", "error": str(exc), "warnings": info["warnings"]}

    new_inspect = await docker.inspect(new_id)
    result = {
        "result": "recreated",
        "old_id": old_cid[:19],
        "new_id": new_id[:19],
        "image_old": old_image_id,
        "image_new": (new_inspect.get("Image") or "")[:19],
        "renamed_old_to": renamed,
        "warnings": info["warnings"],
        "compose_project": info["compose_project"],
    }
    task.done(result)
    return result
