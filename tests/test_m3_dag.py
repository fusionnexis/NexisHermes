"""Tests for M3 DAG enforcement — TC-API-6 through TC-API-8."""
import json
import urllib.error
import urllib.request

import pytest

from tests._pytest_port import BASE
from tests.conftest import requires_agent


def _post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        payload = e.read()
        return json.loads(payload or b"{}"), e.code


def _patch_task(task_id, body):
    return _post(f"/api/kanban/tasks/{task_id}/patch", body)


@requires_agent
def test_dag_child_ready_when_parent_done():
    """TC-API-6: Child can transition to ready when all parents are done."""
    # Create parent as 'ready' so complete_task can transition it to done
    parent_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-parent", "status": "ready"})
    child_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-child", "status": "triage"})
    parent_id = parent_resp["task"]["id"]
    child_id = child_resp["task"]["id"]

    # Link parent → child
    _post("/api/kanban/links", {"parent_id": parent_id, "child_id": child_id})

    # Move parent to done (complete_task accepts ready → done)
    done_resp, done_status = _patch_task(parent_id, {"status": "done"})
    assert done_status == 200, f"parent to done failed: {done_resp}"

    # Child should now be movable to ready
    resp, status = _patch_task(child_id, {"status": "ready"})
    assert status == 200, f"expected 200 but got {status}: {resp}"
    assert resp.get("task", {}).get("status") == "ready"

    # Cleanup
    _patch_task(child_id, {"status": "archived"})


@requires_agent
def test_dag_child_blocked_when_parent_not_done():
    """TC-API-7: Child cannot become ready when parent is in todo."""
    parent_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-block-parent", "status": "todo"})
    child_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-block-child", "status": "triage"})
    parent_id = parent_resp["task"]["id"]
    child_id = child_resp["task"]["id"]

    _post("/api/kanban/links", {"parent_id": parent_id, "child_id": child_id})

    resp, status = _patch_task(child_id, {"status": "ready"})
    assert status == 400, f"expected 400 but got {status}: {resp}"
    assert "error" in resp
    assert parent_id in resp["error"]

    # Cleanup
    _patch_task(parent_id, {"status": "archived"})
    _patch_task(child_id, {"status": "archived"})


@requires_agent
def test_dag_no_parent_can_become_ready():
    """TC-API-8: Task with no parents can freely become ready."""
    task_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-solo", "status": "triage"})
    task_id = task_resp["task"]["id"]

    resp, status = _patch_task(task_id, {"status": "ready"})
    assert status == 200, f"expected 200 but got {status}: {resp}"
    assert resp.get("task", {}).get("status") == "ready"

    _patch_task(task_id, {"status": "archived"})


@requires_agent
def test_dag_only_applies_to_ready_transition():
    """TC-API-8 edge: DAG check does NOT block non-ready transitions."""
    parent_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-non-ready-parent", "status": "todo"})
    child_resp, _ = _post("/api/kanban/tasks", {"title": "m3-dag-non-ready-child", "status": "triage"})
    parent_id = parent_resp["task"]["id"]
    child_id = child_resp["task"]["id"]

    _post("/api/kanban/links", {"parent_id": parent_id, "child_id": child_id})

    # Transitioning to todo (not ready) should succeed even with incomplete parent
    resp, status = _patch_task(child_id, {"status": "todo"})
    assert status == 200, f"expected 200 but got {status}: {resp}"

    # Cleanup
    _patch_task(parent_id, {"status": "archived"})
    _patch_task(child_id, {"status": "archived"})
