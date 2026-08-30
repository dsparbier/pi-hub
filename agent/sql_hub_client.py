"""Minimal async SQL-Hub REST client.

Talks to SQL-Hub's ``/query/read`` and ``/query/write`` endpoints (see
``sql-hub/README.md``, sqlite-native ``?`` placeholders, response rows already come
back as ``list[dict]`` — no separate columns array to zip). No transaction endpoint
exists on this SQL-Hub version, so batched writes are sent as sequential calls.

Deliberately not the fleet's ``fleet_config`` package (`~/projects/_fleet`) — that
buys dynamic dev/live target-switching and an admin-config surface pi-hub-agent has
no use for (single host, one SQL-Hub instance, env-driven config already matches
every other setting in ``config.py``). This mirrors fin-hub's earlier standalone
``sql_hub_client.py`` instead, trimmed to what this agent actually calls.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Sequence

import aiohttp

log = logging.getLogger("agent.sql_hub")

_MAX_RETRIES = 3
_RETRY_DELAY = 0.5  # seconds, doubled each attempt


class SqlHubError(Exception):
    """Raised for any SQL-Hub request failure (HTTP error or connection failure)."""


class SqlHubClient:
    def __init__(self, base_url: str, api_key: str, db_name: str, *, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.db_name = db_name
        self._timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: aiohttp.ClientSession | None = None

    async def connect(self) -> None:
        self._session = aiohttp.ClientSession(timeout=self._timeout)
        await self._ensure_database()

    async def close(self) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    @property
    def _s(self) -> aiohttp.ClientSession:
        if self._session is None:
            raise RuntimeError("SqlHubClient.connect() was not called")
        return self._session

    def _headers(self) -> dict[str, str]:
        return {"x-api-key": self.api_key, "Content-Type": "application/json"}

    async def _ensure_database(self) -> None:
        """Idempotent: SQL-Hub 400s if the file already exists — that's the common case
        after the first run, so it's logged at debug rather than treated as an error."""
        try:
            async with self._s.post(
                f"{self.base_url}/databases/create",
                json={"filename": self.db_name},
                headers=self._headers(),
            ) as resp:
                if resp.status == 200:
                    log.info("created SQL-Hub database %s", self.db_name)
                else:
                    log.debug(
                        "SQL-Hub database %s create returned %s (likely already exists)",
                        self.db_name, resp.status,
                    )
        except aiohttp.ClientError as exc:
            raise SqlHubError(f"could not reach SQL-Hub at {self.base_url}: {exc}") from exc

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                async with self._s.post(
                    f"{self.base_url}{path}", json=payload, headers=self._headers()
                ) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        raise SqlHubError(f"{path} failed ({resp.status}): {text}")
                    return await resp.json()
            except SqlHubError:
                raise
            except aiohttp.ClientError as exc:
                last_error = exc
                if attempt < _MAX_RETRIES - 1:
                    wait = _RETRY_DELAY * (2 ** attempt)
                    log.warning("SQL-Hub connection error (attempt %d/%d), retrying in %.1fs: %s",
                                attempt + 1, _MAX_RETRIES, wait, exc)
                    await asyncio.sleep(wait)
        raise SqlHubError(f"connection error after {_MAX_RETRIES} attempts: {last_error}")

    async def query_read(self, sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
        resp = await self._post(
            "/query/read", {"main_db": self.db_name, "sql": sql, "params": list(params)}
        )
        return resp.get("rows", [])

    async def query_write(self, sql: str, params: Sequence[Any] = ()) -> int:
        resp = await self._post(
            "/query/write", {"main_db": self.db_name, "sql": sql, "params": list(params)}
        )
        # NB: "changes" is SQL-Hub's cumulative total_changes() on its cached connection
        # for this db file, not this call's affected-row count. No current caller relies
        # on the return value for a specific-row-affected check.
        return int(resp.get("changes", 0))
