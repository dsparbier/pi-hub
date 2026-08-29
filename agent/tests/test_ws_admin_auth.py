"""First-frame auth on the admin WebSockets (task progress + exec). Sync TestClient."""
import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from agent.auth import WS_CLOSE_AUTH
from agent.db import Database
from agent.routes_exec import router as exec_router
from agent.routes_tasks import router as tasks_router
from agent.tasks import TaskManager
from tests.conftest import ADMIN_KEY, READ_KEY, FakeDocker


@pytest.fixture
def ws_app():
    a = FastAPI()
    a.state.db = Database(":memory:")
    a.state.docker = FakeDocker()
    a.state.tasks = TaskManager()
    a.include_router(tasks_router)
    a.include_router(exec_router)
    with TestClient(a) as c:
        yield c, a


def test_task_ws_rejects_read_key(ws_app):
    client, app = ws_app
    t = app.state.tasks.create("pull")
    t.done({"ok": True})
    with client.websocket_connect(f"/api/tasks/{t.id}") as ws:
        ws.send_json({"type": "auth", "key": READ_KEY})
        with pytest.raises(WebSocketDisconnect) as ei:
            ws.receive_json()
    assert ei.value.code == WS_CLOSE_AUTH


def test_task_ws_admin_replays_buffer(ws_app):
    client, app = ws_app
    t = app.state.tasks.create("pull")
    t.progress(status="Downloading", layer="l1")
    t.done({"ref": "x"})
    with client.websocket_connect(f"/api/tasks/{t.id}") as ws:
        ws.send_json({"type": "auth", "key": ADMIN_KEY})
        f1 = ws.receive_json()
        f2 = ws.receive_json()
    assert f1["type"] == "progress" and f2["type"] == "done"


def test_task_ws_unknown_task(ws_app):
    client, _ = ws_app
    with client.websocket_connect("/api/tasks/does-not-exist") as ws:
        ws.send_json({"type": "auth", "key": ADMIN_KEY})
        f = ws.receive_json()
    assert f["type"] == "error"


def test_exec_ws_rejects_missing_auth_frame(ws_app):
    client, _ = ws_app
    with client.websocket_connect("/api/containers/abc/exec") as ws:
        ws.send_text("garbage")
        with pytest.raises(WebSocketDisconnect) as ei:
            ws.receive_json()
    assert ei.value.code == WS_CLOSE_AUTH


def test_exec_ws_rejects_read_key(ws_app):
    client, _ = ws_app
    with client.websocket_connect("/api/containers/abc/exec") as ws:
        ws.send_json({"type": "auth", "key": READ_KEY})
        with pytest.raises(WebSocketDisconnect) as ei:
            ws.receive_json()
    assert ei.value.code == WS_CLOSE_AUTH


def test_exec_ws_rejects_disallowed_cmd(ws_app):
    client, _ = ws_app
    with client.websocket_connect("/api/containers/abc/exec?cmd=/bin/evil") as ws:
        ws.send_json({"type": "auth", "key": ADMIN_KEY})
        f = ws.receive_json()
        assert f["type"] == "error" and "not allowed" in f["message"]
