"""Tests for M4 execution policy router — TC-API-1 through TC-API-5."""
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


@requires_agent
def test_execute_small_routes_directly(cleanup_test_sessions):
    """TC-API-1: Small task routes directly to claim."""
    task_resp, _ = _post("/api/kanban/tasks", {"title": "m4-small-test", "task_size": "small", "status": "ready"})
    task_id = task_resp["task"]["id"]

    resp, status = _post("/api/kanban/execute", {"task_id": task_id})
    assert status == 200, f"unexpected: {resp}"
    assert resp["route"] == "small"
    assert resp["task"]["status"] == "running"
    assert resp["session"] is not None
    cleanup_test_sessions.append(resp["session"]["session_id"])
    _post(f"/api/kanban/tasks/{task_id}/patch", {"status": "archived"})


@requires_agent
def test_execute_null_size_defaults_to_small(cleanup_test_sessions):
    """TC-API-1 edge: task_size=null defaults to small."""
    task_resp, _ = _post("/api/kanban/tasks", {"title": "m4-null-size", "status": "ready"})
    task_id = task_resp["task"]["id"]

    resp, status = _post("/api/kanban/execute", {"task_id": task_id})
    assert status == 200
    assert resp["route"] == "small"
    cleanup_test_sessions.append(resp["session"]["session_id"])
    _post(f"/api/kanban/tasks/{task_id}/patch", {"status": "archived"})


@requires_agent
def test_execute_medium_submits_clarify(cleanup_test_sessions):
    """TC-API-2: Medium task submits plan clarify."""
    task_resp, _ = _post("/api/kanban/tasks", {"title": "m4-medium-test", "task_size": "medium", "status": "ready"})
    task_id = task_resp["task"]["id"]

    resp, status = _post("/api/kanban/execute", {
        "task_id": task_id,
        "plan_content": "## Plan\n- Step 1\n- Step 2",
    })
    assert status == 200, f"unexpected: {resp}"
    assert resp["route"] == "medium"
    assert resp.get("clarify_pending") is True
    cleanup_test_sessions.append(resp["session"]["session_id"])
    _post(f"/api/kanban/tasks/{task_id}/patch", {"status": "archived"})


@requires_agent
def test_execute_large_submits_phase1_clarify(cleanup_test_sessions):
    """TC-API-3: Large task submits Phase 1 proposal clarify."""
    task_resp, _ = _post("/api/kanban/tasks", {"title": "m4-large-test", "task_size": "large", "status": "ready"})
    task_id = task_resp["task"]["id"]

    resp, status = _post("/api/kanban/execute", {"task_id": task_id})
    assert status == 200, f"unexpected: {resp}"
    assert resp["route"] == "large"
    assert resp.get("clarify_phase") == 1
    cleanup_test_sessions.append(resp["session"]["session_id"])
    _post(f"/api/kanban/tasks/{task_id}/patch", {"status": "archived"})


def test_execute_not_found():
    """TC-API-4: Task not found returns 404."""
    resp, status = _post("/api/kanban/execute", {"task_id": "t_nonexistent"})
    assert status == 404


@requires_agent
def test_execute_already_claimed_returns_409(cleanup_test_sessions):
    """TC-API-5: Already-claimed task returns 409."""
    task_resp, _ = _post("/api/kanban/tasks", {"title": "m4-conflict", "task_size": "small", "status": "ready"})
    task_id = task_resp["task"]["id"]

    resp1, _ = _post("/api/kanban/execute", {"task_id": task_id})
    cleanup_test_sessions.append(resp1["session"]["session_id"])

    resp2, status2 = _post("/api/kanban/execute", {"task_id": task_id})
    assert status2 == 409
    _post(f"/api/kanban/tasks/{task_id}/patch", {"status": "archived"})
