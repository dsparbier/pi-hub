"""
DEV-Hub Central Logs streaming for pi-hub-agent's own operational logs —
FLEET-LOGGING-STANDARD.md §3. This is deliberately narrow, per that doc's
§5 decision for pi-hub: the agent's *own* logging is console-only
(`logging.basicConfig` in app.py, captured by `docker logs`) and stays that
way — pi-hub-agent is a low-volume sidecar; a dedicated file/rotation/
retention/viewer stack (§2 + §4's 3-sub-item UX) would be more machinery
than the log volume justifies, and pi-hub's own React frontend already ships
a more valuable, broader capability for the *fleet's* logs
(LogViewer.jsx/LogStream.jsx, streaming host + every container's logs — a
superset of "one app's own file," not a competing mechanism). What IS worth
the small extra cost: mirroring the agent's own WARNING+ lines into DEV-Hub's
Central Logs, same as every other app, so an agent-side problem is visible
in one place instead of requiring `docker logs pi-hub-agent` specifically.

Uses aiohttp (already a pinned dependency here, via sql_hub_client.py) rather
than httpx, to avoid adding a second HTTP client library for one small module.
"""
import asyncio
import json
import logging
import os
import queue
from datetime import datetime, timezone

import aiohttp
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatus

logger = logging.getLogger("agent.dev_hub_stream")

_SOURCE_NAME = "pi-hub-agent"
_QUEUE_MAXSIZE = 500  # this agent logs far less than the FastAPI apps
_RECONNECT_SECONDS = 5

_queue: "queue.Queue[dict]" = queue.Queue(maxsize=_QUEUE_MAXSIZE)
_task: "asyncio.Task | None" = None
_handler: "DevHubStreamHandler | None" = None
_connected = False
_last_error: "str | None" = None
_token: str = ""


class DevHubStreamHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = {
                "level": record.levelname,
                "message": record.getMessage()[:10_000],
                "logger": record.name,
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            }
        except Exception:
            return
        try:
            _queue.put_nowait(entry)
        except queue.Full:
            try:
                _queue.get_nowait()
                _queue.put_nowait(entry)
            except Exception:
                pass


def _dev_hub_url() -> str:
    return os.environ.get("DEV_HUB_URL", "http://host.docker.internal:38103").rstrip("/")


def _dev_hub_api_key() -> str:
    return os.environ.get("DEV_HUB_API_KEY", "")


def _headers() -> dict:
    return {"X-API-Key": _dev_hub_api_key(), "Content-Type": "application/json"}


def _ws_url(http_url: str) -> str:
    return http_url.replace("https://", "wss://", 1).replace("http://", "ws://", 1).rstrip("/")


async def _get_or_create_token() -> str:
    global _token
    if _token:
        return _token

    base_url = _dev_hub_url()
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{base_url}/api/log-sources", headers=_headers(), timeout=10) as resp:
            resp.raise_for_status()
            sources = await resp.json()
        existing = next((s for s in sources if s.get("name") == _SOURCE_NAME), None)

        if existing:
            async with session.post(
                f"{base_url}/api/log-sources/{existing['id']}/rotate-token", headers=_headers(), timeout=10
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
        else:
            async with session.post(
                f"{base_url}/api/log-sources",
                headers=_headers(),
                json={"name": _SOURCE_NAME, "description": "pi-hub-agent centralized log stream"},
                timeout=10,
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
        _token = data["token"]

    return _token


def _invalidate_token() -> None:
    global _token
    _token = ""


async def _stream_loop() -> None:
    global _connected, _last_error
    while True:
        try:
            token = await _get_or_create_token()
            url = f"{_ws_url(_dev_hub_url())}/ws/logs?token={token}"
            async with websockets.connect(url, open_timeout=10, ping_interval=20) as ws:
                _connected = True
                _last_error = None
                logger.info("[DEV-HUB-STREAM] connected to %s", _dev_hub_url())
                try:
                    while True:
                        entry = await asyncio.to_thread(_queue.get)
                        await ws.send(json.dumps(entry))
                finally:
                    _connected = False
        except asyncio.CancelledError:
            _connected = False
            raise
        except ConnectionClosed as e:
            _connected = False
            if e.code == 1008:
                logger.warning("[DEV-HUB-STREAM] token rejected — re-provisioning on next attempt")
                _last_error = "token rejected — re-provisioning"
                _invalidate_token()
            else:
                logger.info("[DEV-HUB-STREAM] connection closed (code=%s), reconnecting", e.code)
                _last_error = f"connection closed (code {e.code})"
            await asyncio.sleep(_RECONNECT_SECONDS)
        except InvalidStatus as e:
            _connected = False
            status_code = e.response.status_code
            if status_code in (401, 403):
                logger.warning(
                    "[DEV-HUB-STREAM] token rejected (HTTP %s) — re-provisioning on next attempt", status_code
                )
                _last_error = f"token rejected (HTTP {status_code}) — re-provisioning"
                _invalidate_token()
            else:
                logger.warning("[DEV-HUB-STREAM] handshake rejected (HTTP %s), retrying in %ss", status_code, _RECONNECT_SECONDS)
                _last_error = f"HTTP {status_code} from DEV-Hub"
            await asyncio.sleep(_RECONNECT_SECONDS)
        except Exception as e:
            _connected = False
            logger.warning("[DEV-HUB-STREAM] connect failed, retrying in %ss: %s", _RECONNECT_SECONDS, e)
            _last_error = f"{type(e).__name__}: {e}"[:200]
            await asyncio.sleep(_RECONNECT_SECONDS)


def is_running() -> bool:
    return _task is not None and not _task.done()


def status() -> dict:
    return {"connected": _connected, "last_error": _last_error}


async def start() -> None:
    global _task, _handler
    if is_running():
        return
    root = logging.getLogger()
    if _handler is None:
        _handler = DevHubStreamHandler()
    _handler.setLevel(logging.WARNING)  # this agent's log volume is low; stream WARNING+ only
    if _handler not in root.handlers:
        root.addHandler(_handler)
    _task = asyncio.create_task(_stream_loop())
    logger.info("[DEV-HUB-STREAM] started")


async def stop() -> None:
    global _task, _handler, _connected, _last_error
    root = logging.getLogger()
    if _handler is not None:
        try:
            root.removeHandler(_handler)
        except Exception:
            pass
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
    _connected = False
    _last_error = None
