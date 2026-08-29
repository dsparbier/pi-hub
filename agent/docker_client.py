"""Thin async wrapper around aiodocker over the unix socket.

Plan 1 uses read-only calls only: list, inspect, ``stats(stream=…)``, ``log(...)``.
Anything aiodocker lacks a helper for goes through ``query_json`` against the documented
Engine API. Control + image endpoints are added in Plan 2 — **do not install docker-py**.
"""
from __future__ import annotations

import inspect
from typing import Any, AsyncIterator

import aiodocker


class DockerClient:
    def __init__(self) -> None:
        self._d: aiodocker.Docker | None = None

    async def connect(self) -> None:
        self._d = aiodocker.Docker()

    async def close(self) -> None:
        if self._d is not None:
            await self._d.close()
            self._d = None

    @property
    def d(self) -> aiodocker.Docker:
        if self._d is None:
            raise RuntimeError("DockerClient.connect() was not called")
        return self._d

    # -- health ------------------------------------------------------
    async def ping(self) -> bool:
        try:
            await self.d.version()
            return True
        except Exception:
            return False

    async def version(self) -> dict[str, Any]:
        try:
            return await self.d.version()
        except Exception:
            return {}

    # -- containers ------------------------------------------------------
    async def list_containers(self, *, all: bool = True) -> list[dict[str, Any]]:
        containers = await self.d.containers.list(all=all)
        out: list[dict[str, Any]] = []
        for c in containers:
            data = c._container if isinstance(getattr(c, "_container", None), dict) else {}
            if not data:
                try:
                    data = await c.show()
                except Exception:
                    data = {}
            out.append(data)
        return out

    async def inspect(self, cid: str) -> dict[str, Any]:
        return await self.d.containers.container(cid).show()

    async def stats_once(self, cid: str) -> dict[str, Any] | None:
        container = self.d.containers.container(cid)
        res = await container.stats(stream=False)
        if isinstance(res, list):
            return res[-1] if res else None
        return res

    async def stats_stream(self, cid: str) -> AsyncIterator[dict[str, Any]]:
        container = self.d.containers.container(cid)
        async for frame in container.stats(stream=True):
            yield frame

    async def logs_once(
        self,
        cid: str,
        *,
        tail: int = 200,
        since: int | None = None,
        timestamps: bool = True,
    ) -> list[str]:
        container = self.d.containers.container(cid)
        kwargs: dict[str, Any] = {
            "stdout": True,
            "stderr": True,
            "follow": False,
            "tail": tail,
            "timestamps": timestamps,
        }
        if since:
            kwargs["since"] = since
        res = await container.log(**kwargs)
        if isinstance(res, list):
            return res
        return [res] if res else []

    async def logs_follow(
        self,
        cid: str,
        *,
        tail: int = 200,
        timestamps: bool = True,
    ) -> AsyncIterator[str]:
        container = self.d.containers.container(cid)
        async for line in container.log(
            stdout=True, stderr=True, follow=True, tail=tail, timestamps=timestamps
        ):
            yield line

    # -- container control (Plan 2) ------------------------------------
    async def start(self, cid: str) -> None:
        await self.d.containers.container(cid).start()

    async def stop(self, cid: str, *, t: int = 10) -> None:
        await self.d.containers.container(cid).stop(t=t)

    async def restart(self, cid: str, *, t: int = 10) -> None:
        # aiodocker's restart() takes `timeout=`, not **kwargs like stop()/kill()
        await self.d.containers.container(cid).restart(timeout=t)

    async def kill(self, cid: str, *, signal: str = "SIGTERM") -> None:
        await self.d.containers.container(cid).kill(signal=signal)

    async def remove(self, cid: str, *, force: bool = False, volumes: bool = False) -> None:
        await self.d.containers.container(cid).delete(force=force, v=volumes)

    async def rename(self, cid: str, new_name: str) -> None:
        await self.d.containers.container(cid).rename(new_name)

    async def create(self, config: dict[str, Any], *, name: str | None = None) -> str:
        c = await self.d.containers.create(config, name=name)
        return c.id

    async def network_connect(self, net: str, cid: str, endpoint: dict[str, Any] | None = None) -> None:
        body: dict[str, Any] = {"Container": cid}
        if endpoint:
            body["EndpointConfig"] = endpoint
        await self.d._query_json(f"networks/{net}/connect", method="POST", data=body)

    async def containers_prune(self) -> dict[str, Any]:
        return await self.d._query_json("containers/prune", method="POST") or {}

    # -- images (Plan 2) ---------------------------------------------
    async def images_list(self, *, all: bool = False) -> list[dict[str, Any]]:
        return await self.d.images.list(all="1" if all else "0")

    async def images_df(self) -> dict[str, Any]:
        return await self.d._query_json("system/df") or {}

    async def image_pull(self, from_image: str, tag: str | None = None) -> AsyncIterator[dict[str, Any]]:
        res = self.d.images.pull(from_image, tag=tag, stream=True)
        if inspect.isawaitable(res):
            res = await res
        async for frame in res:
            yield frame

    async def image_remove(self, ref: str, *, force: bool = False) -> list[dict[str, Any]]:
        return await self.d.images.delete(ref, force=force)

    async def images_prune(self, *, dangling_only: bool = True) -> dict[str, Any]:
        filters = '{"dangling":["true"]}' if dangling_only else '{"dangling":["false"]}'
        return await self.d._query_json(
            "images/prune", method="POST", params={"filters": filters}
        ) or {}

    # -- exec (Plan 2) ---------------------------------------------------
    async def exec_create(
        self, cid: str, cmd: list[str], *, tty: bool = True, user: str = "", workdir: str | None = None
    ):
        return await self.d.containers.container(cid).exec(
            cmd, stdin=True, stdout=True, stderr=True, tty=tty, user=user, workdir=workdir
        )

    # -- low-level Engine API -----------------------------------------
    async def query_json(
        self,
        path: str,
        *,
        method: str = "GET",
        params: dict[str, Any] | None = None,
        data: Any = None,
    ) -> Any:
        return await self.d._query_json(path, method=method, params=params, data=data)
