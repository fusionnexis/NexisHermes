"""Tests for kanban task creation with worktree workspace binding.

TC-API-7: kanban task creation with workspace_kind="worktree" and
workspace_path validation.
"""
import json
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

from tests._pytest_port import BASE, TEST_STATE_DIR


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


def _init_git_repo(path: Path):
    """Initialize a git repo with at least one commit."""
    subprocess.run(['git', 'init'], cwd=str(path), capture_output=True, timeout=5)
    subprocess.run(['git', 'config', 'user.email', 'test@test.com'],
                    cwd=str(path), capture_output=True, timeout=5)
    subprocess.run(['git', 'config', 'user.name', 'Test'],
                    cwd=str(path), capture_output=True, timeout=5)
    (path / 'README.md').write_text('test', encoding='utf-8')
    subprocess.run(['git', 'add', 'README.md'], cwd=str(path), capture_output=True, timeout=5)
    subprocess.run(['git', 'commit', '-m', 'initial'], cwd=str(path), capture_output=True, timeout=5)


def test_kanban_task_with_worktree_binding(cleanup_test_sessions):
    """TC-API-7: Create kanban task with workspace_kind="worktree" and valid path."""
    from tests.conftest import make_session_tracked
    ws = TEST_STATE_DIR / 'kanban-wt-workspace'
    ws.mkdir(parents=True, exist_ok=True)
    if not (ws / '.git').exists():
        _init_git_repo(ws)
    sid, ws_path = make_session_tracked(cleanup_test_sessions, ws=str(ws))

    # Create a worktree
    resp_wt, _ = _post("/api/worktree/create", {
        "session_id": sid,
        "branch_name": "wt-kanban-test",
    })
    wt_path = resp_wt["path"]

    # Create a kanban task with worktree binding
    resp, status = _post("/api/kanban/tasks", {
        "title": "worktree task test",
        "workspace_kind": "worktree",
        "workspace_path": wt_path,
    })
    assert status == 200
    task = resp.get("task", {})
    assert task.get("workspace_kind") == "worktree"
    assert task.get("workspace_path") == wt_path

    _post("/api/worktree/remove", {"worktree_id": "wt-kanban-test", "session_id": sid})


def test_kanban_task_with_invalid_worktree_path():
    """TC-API-7 edge: Create kanban task with workspace_kind="worktree" and invalid path → error."""
    resp, status = _post("/api/kanban/tasks", {
        "title": "invalid worktree task",
        "workspace_kind": "worktree",
        "workspace_path": "/nonexistent/path/that/does/not/exist",
    })
    assert status == 400
    assert "error" in resp
    assert "does not exist" in resp["error"]


def test_kanban_task_with_worktree_empty_path():
    """TC-API-7 edge: Create kanban task with workspace_kind="worktree" and empty path → error."""
    resp, status = _post("/api/kanban/tasks", {
        "title": "empty worktree path",
        "workspace_kind": "worktree",
        "workspace_path": "",
    })
    assert status == 400
    assert "error" in resp
    assert "workspace_path is required" in resp["error"]


def test_kanban_task_with_scratch_workspace():
    """TC-API-7 edge: Create kanban task with workspace_kind="scratch" (default) — no validation needed."""
    resp, status = _post("/api/kanban/tasks", {
        "title": "scratch task",
        "workspace_kind": "scratch",
    })
    assert status == 200
    task = resp.get("task", {})
    assert task.get("workspace_kind") == "scratch"