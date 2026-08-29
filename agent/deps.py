"""Shared-state accessors. The real objects live on ``app.state`` (set in the lifespan)."""
from __future__ import annotations

from fastapi import Request, WebSocket

from .collector import Collector
from .db import Database
from .docker_client import DockerClient


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_docker(request: Request) -> DockerClient:
    return request.app.state.docker


def get_collector(request: Request) -> Collector:
    return request.app.state.collector


def get_tasks(request: Request):
    return request.app.state.tasks


# WebSocket variants (WebSocket exposes .app)
def ws_db(ws: WebSocket) -> Database:
    return ws.app.state.db


def ws_docker(ws: WebSocket) -> DockerClient:
    return ws.app.state.docker


def ws_tasks(ws: WebSocket):
    return ws.app.state.tasks
