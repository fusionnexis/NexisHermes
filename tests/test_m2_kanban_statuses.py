"""Tests for M2 kanban status extensions — TC-API-4 through TC-API-8.

Requires hermes_cli.kanban_db (uses requires_agent marker).
"""
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


def _get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        payload = e.read()
        return json.loads(payload or b"{}"), e.code


def _patch_task(task_id, body):
    return _post(f"/api/kanban/tasks/{task_id}/patch", body)


def _force_status(task_id, status):
    """Force a task to a specific status via direct DB — needed to set 'running' for tests."""
    # We can set triage/todo/ready via PATCH; for 'running' we bypass via a
    # supported reachable status sequence.
    resp, _ = _patch_task(task_id, {"status": status})
    return resp


@requires_agent
def test_kanban_board_returns_9_columns():
    """TC-API-4: GET /api/kanban/board returns 9 columns."""
    resp, status = _get("/api/kanban/board")
    assert status == 200
    cols = resp.get("columns", [])
    col_names = [c["name"] for c in cols]
    assert len(cols) == 9
    for expected in ("triage", "todo", "ready", "running", "in_review", "qa_verify",
                     "blocked", "release_ready", "done"):
        assert expected in col_names, f"column {expected!r} missing"


@requires_agent
def test_kanban_config_returns_9_columns():
    """TC-API-4 edge: GET /api/kanban/config returns 9 columns."""
    resp, status = _get("/api/kanban/config")
    assert status == 200
    assert "in_review" in resp.get("columns", [])
    assert "qa_verify" in resp.get("columns", [])
    assert "release_ready" in resp.get("columns", [])


@requires_agent
def test_task_size_create_medium():
    """TC-API-5: Create task with task_size=medium."""
    resp, status = _post("/api/kanban/tasks", {"title": "size-test-medium", "task_size": "medium"})
    assert status == 200
    task = resp.get("task", {})
    assert task.get("task_size") == "medium"
    _post(f"/api/kanban/tasks/{task['id']}/patch", {"status": "archived"})


@requires_agent
def test_task_size_create_small():
    """TC-API-5 edge: Create task with task_size=small."""
    resp, status = _post("/api/kanban/tasks", {"title": "size-test-small", "task_size": "small"})
    assert status == 200
    task = resp.get("task", {})
    assert task.get("task_size") == "small"
    _post(f"/api/kanban/tasks/{task['id']}/patch", {"status": "archived"})


@requires_agent
def test_task_size_defaults_null():
    """TC-API-5 edge: Create task without task_size → null."""
    resp, status = _post("/api/kanban/tasks", {"title": "size-test-null"})
    assert status == 200
    task = resp.get("task", {})
    assert task.get("task_size") is None
    _post(f"/api/kanban/tasks/{task['id']}/patch", {"status": "archived"})


@requires_agent
def test_task_size_invalid_rejected():
    """TC-API-5 edge: Invalid task_size → 400."""
    resp, status = _post("/api/kanban/tasks", {"title": "size-test-bad", "task_size": "huge"})
    assert status == 400
    assert "error" in resp


@requires_agent
def test_task_size_patch_update():
    """TC-API-8: PATCH task_size on existing task."""
    create_resp, _ = _post("/api/kanban/tasks", {"title": "size-patch-test"})
    task_id = create_resp["task"]["id"]
    # Patch to large
    resp, status = _patch_task(task_id, {"task_size": "large"})
    assert status == 200
    assert resp.get("task", {}).get("task_size") == "large"
    # Patch back to null
    resp2, status2 = _patch_task(task_id, {"task_size": None})
    assert status2 == 200
    assert resp2.get("task", {}).get("task_size") is None
    _patch_task(task_id, {"status": "archived"})


@requires_agent
def test_transition_todo_to_in_review_rejected():
    """TC-API-6 edge: todo → in_review invalid transition → 400."""
    create_resp, _ = _post("/api/kanban/tasks", {"title": "transition-test-1", "status": "todo"})
    task_id = create_resp["task"]["id"]
    resp, status = _patch_task(task_id, {"status": "in_review"})
    assert status == 400
    assert "error" in resp
    _patch_task(task_id, {"status": "archived"})


@requires_agent
def test_transition_ready_to_qa_verify_rejected():
    """TC-API-6 edge: ready → qa_verify invalid transition → 400."""
    create_resp, _ = _post("/api/kanban/tasks", {"title": "transition-test-2", "status": "ready"})
    task_id = create_resp["task"]["id"]
    resp, status = _patch_task(task_id, {"status": "qa_verify"})
    assert status == 400
    assert "error" in resp
    _patch_task(task_id, {"status": "archived"})
