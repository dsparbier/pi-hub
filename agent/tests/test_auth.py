import pytest
from fastapi import HTTPException

from agent.auth import verify_key
from tests.conftest import ADMIN_KEY, READ_KEY


def test_verify_key_tiers():
    assert verify_key(READ_KEY, admin=False) == "read"
    assert verify_key(ADMIN_KEY, admin=False) == "admin"
    assert verify_key(ADMIN_KEY, admin=True) == "admin"


def test_verify_key_read_on_admin_route_is_403():
    with pytest.raises(HTTPException) as ei:
        verify_key(READ_KEY, admin=True)
    assert ei.value.status_code == 403


def test_verify_key_missing_and_bad_are_401():
    for bad in (None, "", "nope"):
        with pytest.raises(HTTPException) as ei:
            verify_key(bad, admin=False)
        assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_health_is_unauthenticated(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "pi-hub-agent"


@pytest.mark.asyncio
async def test_read_route_requires_key(client):
    assert (await client.get("/api/host/info")).status_code == 401
    assert (await client.get("/api/host/info", headers={"X-API-Key": "wrong"})).status_code == 401
    ok = await client.get("/api/host/info", headers={"X-API-Key": READ_KEY})
    assert ok.status_code == 200
    assert "hostname" in ok.json()


@pytest.mark.asyncio
async def test_containers_list_shape(client):
    r = await client.get("/api/containers", headers={"X-API-Key": READ_KEY})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    c = body["containers"][0]
    assert c["name"] == "pi-hub" and c["compose"]["project"] == "pi-hub"
