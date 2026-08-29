"""WebSocket first-frame auth. Uses Starlette's sync TestClient (httpx has no WS).

The ``logs/stream`` route only touches the Docker client, so the in-memory DB here is
left unconnected on purpose — these tests are about the auth handshake, not the stream.
"""
import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from agent.auth import WS_CLOSE_AUTH
from agent.collector import Collector
from agent.db import Database
from agent.routes_containers_ro import router as containers_router
from tests.conftest import READ_KEY, FakeDocker


@pytest.fixture
def ws_client():
    a = FastAPI()
    a.state.db = Database(":memory:")
    a.state.docker = FakeDocker()
    a.state.collector = Collector(a.state.db, a.state.docker)
    a.include_router(containers_router)
    with TestClient(a) as c:
        yield c


def test_ws_rejects_missing_auth_frame(ws_client):
    with ws_client.websocket_connect("/api/containers/abc123/logs/stream") as ws:
        ws.send_text("not json")
        with pytest.raises(WebSocketDisconnect) as ei:
            ws.receive_text()
    assert ei.value.code == WS_CLOSE_AUTH


def test_ws_rejects_wrong_key(ws_client):
    with ws_client.websocket_connect("/api/containers/abc123/logs/stream") as ws:
        ws.send_json({"type": "auth", "key": "bogus"})
        with pytest.raises(WebSocketDisconnect) as ei:
            ws.receive_json()
    assert ei.value.code == WS_CLOSE_AUTH


def test_ws_accepts_valid_key_and_streams(ws_client):
    with ws_client.websocket_connect("/api/containers/abc123/logs/stream") as ws:
        ws.send_json({"type": "auth", "key": READ_KEY})
        first = ws.receive_json()
        assert first["type"] == "log"
        assert "line one" in first["text"]
