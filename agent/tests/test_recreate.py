import json
import pathlib

import pytest

from agent import recreate as rc

FIX = pathlib.Path(__file__).parent / "fixtures" / "inspect_web.json"


@pytest.fixture
def inspect():
    return json.loads(FIX.read_text())


def test_split_ref():
    assert rc.split_ref("nginx:1.27-alpine") == ("nginx", "1.27-alpine")
    assert rc.split_ref("nginx") == ("nginx", "latest")
    assert rc.split_ref("registry.local:5000/team/app:v2") == ("registry.local:5000/team/app", "v2")
    repo, ref = rc.split_ref("busybox@sha256:deadbeef")
    assert repo == "busybox" and ref.startswith("sha256:")


def test_analyse_flags_anon_volume_and_networks_and_compose(inspect):
    info = rc.analyse(inspect)
    assert info["name"] == "web"
    assert info["image"] == "nginx:1.27-alpine"
    assert info["compose_project"] == "shop"
    assert info["anonymous_volumes"] == ["/var/cache/nginx"]
    assert info["extra_networks"] == ["shop_edge"]
    # three distinct guard warnings
    joined = " ".join(info["warnings"]).lower()
    assert "anonymous volume" in joined
    assert "networks" in joined
    assert "compose-managed" in joined


def test_build_payload_carries_config_and_hostconfig(inspect):
    p = rc.build_payload(inspect)
    assert p["Image"] == "nginx:1.27-alpine"
    assert p["Cmd"] == ["nginx", "-g", "daemon off;"]
    assert p["Labels"]["com.docker.compose.project"] == "shop"
    assert p["HostConfig"]["NetworkMode"] == "shop_default"
    assert p["HostConfig"]["PortBindings"]["80/tcp"][0]["HostPort"] == "8080"
    assert p["HostConfig"]["CapDrop"] == ["ALL"]
    # primary-network endpoint keeps the real alias, drops the 12-hex id alias
    aliases = p["NetworkingConfig"]["EndpointsConfig"]["shop_default"]["Aliases"]
    assert "web" in aliases and "9f1c2b3a4d5e" not in aliases


def test_payload_strips_hostname_for_container_network_mode(inspect):
    inspect["HostConfig"]["NetworkMode"] = "container:abc123"
    inspect["Config"]["Hostname"] = "web"
    inspect["Config"]["Domainname"] = "local"
    p = rc.build_payload(inspect)
    # daemon rejects "hostname and the network mode" together
    assert "Hostname" not in p and "Domainname" not in p
    assert "ExposedPorts" not in p
    assert "PortBindings" not in p["HostConfig"]


def test_payload_keeps_hostname_for_normal_bridge_mode(inspect):
    inspect["Config"]["Hostname"] = "web"
    p = rc.build_payload(inspect)
    assert p["Hostname"] == "web"


def test_payload_still_contains_env_values_but_audit_redacts_them(inspect):
    # build_payload is faithful — redaction happens only in the audit layer
    p = rc.build_payload(inspect)
    assert "SECRET_TOKEN=hunter2" in p["Env"]
    from agent.audit import redact_env
    red = redact_env({"Env": p["Env"]})
    assert red["Env"] == ["NGINX_VERSION", "PATH", "SECRET_TOKEN"]
    assert all("=" not in e for e in red["Env"])
