import pytest

from tests.conftest import ADMIN_KEY, READ_KEY


@pytest.mark.asyncio
async def test_control_requires_admin(client):
    # no key -> 401, read key -> 403, admin -> ok
    assert (await client.post("/api/containers/abc/start")).status_code == 401
    r = await client.post("/api/containers/abc/start", headers={"X-API-Key": READ_KEY})
    assert r.status_code == 403
    r = await client.post("/api/containers/abc/start", headers={"X-API-Key": ADMIN_KEY})
    assert r.status_code == 200 and r.json()["action"] == "container.start"


@pytest.mark.asyncio
async def test_actions_are_audited(client, db, app):
    await client.post("/api/containers/abc/stop?t=3", headers={"X-API-Key": ADMIN_KEY})
    await client.post("/api/containers/abc/kill?signal=SIGKILL", headers={"X-API-Key": ADMIN_KEY})
    rows = await db.query("SELECT action, target, params, result FROM audit_log ORDER BY id")
    actions = [r["action"] for r in rows]
    assert "container.stop" in actions and "container.kill" in actions
    stop_row = next(r for r in rows if r["action"] == "container.stop")
    assert stop_row["target"] == "abc" and '"t": 3' in stop_row["params"]
    assert stop_row["result"] == "ok"
    assert ("stop", "abc", 3) in app.state.docker.calls


@pytest.mark.asyncio
async def test_audit_filter_by_action(client, db):
    for _ in range(2):
        await client.post("/api/containers/abc/start", headers={"X-API-Key": ADMIN_KEY})
    await client.post("/api/containers/abc/restart", headers={"X-API-Key": ADMIN_KEY})
    r = await client.get("/api/audit?action=container.start", headers={"X-API-Key": READ_KEY})
    entries = r.json()["entries"]
    assert entries and all(e["action"] == "container.start" for e in entries)


@pytest.mark.asyncio
async def test_images_list_and_df_are_read_tier(client):
    r = await client.get("/api/images", headers={"X-API-Key": READ_KEY})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    dangling = [i for i in body["images"] if i["dangling"]]
    assert len(dangling) == 1
    assert body["images"][0]["containers_using"] >= 0

    r = await client.get("/api/images/df", headers={"X-API-Key": READ_KEY})
    assert r.status_code == 200 and r.json()["images_reclaimable"] == 50


@pytest.mark.asyncio
async def test_image_pull_returns_task_then_ws_replays(client, app):
    r = await client.post("/api/images/pull", json={"ref": "nginx:1.27-alpine"},
                          headers={"X-API-Key": ADMIN_KEY})
    assert r.status_code == 202
    tid = r.json()["task_id"]
    # let the background job finish
    import asyncio
    for _ in range(20):
        t = app.state.tasks.get(tid)
        if t and t.status in ("done", "error"):
            break
        await asyncio.sleep(0.02)
    t = app.state.tasks.get(tid)
    assert t.status == "done"
    types = [f["type"] for f in t.frames]
    assert "progress" in types and types[-1] == "done"


@pytest.mark.asyncio
async def test_prune_admin_only_and_audited(client, db):
    assert (await client.post("/api/images/prune", headers={"X-API-Key": READ_KEY})).status_code == 403
    r = await client.post("/api/images/prune", json={"dangling_only": True},
                          headers={"X-API-Key": ADMIN_KEY})
    assert r.status_code == 200 and r.json()["space_reclaimed"] == 50
    row = await db.query_one("SELECT * FROM audit_log WHERE action='images.prune'")
    assert row is not None and row["result"] == "ok"


@pytest.mark.asyncio
async def test_recreate_blocked_by_guard_without_force(client, app):
    # FakeDocker.inspect returns a compose-managed container -> at least one warning
    r = await client.post("/api/containers/abc123/recreate", json={"pull": False, "force": False},
                          headers={"X-API-Key": ADMIN_KEY})
    assert r.status_code == 202
    tid = r.json()["task_id"]
    import asyncio
    for _ in range(20):
        t = app.state.tasks.get(tid)
        if t and t.status in ("done", "error"):
            break
        await asyncio.sleep(0.02)
    t = app.state.tasks.get(tid)
    assert t.status == "error"
    assert t.frames[-1]["type"] == "error"
