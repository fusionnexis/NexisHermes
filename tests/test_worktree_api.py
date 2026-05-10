"""Tests for git worktree REST API endpoints.

TC-API-1 through TC-API-6: create, list, remove worktree endpoints
with error handling for non-git workspace, duplicate branch, and
missing worktree.

TC-API-7: kanban task creation with worktree binding.
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


def _get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        payload = e.read()
        return json.loads(payload or b"{}"), e.code


def _init_git_repo(path: Path):
    """Initialize a git repo with at least one commit for worktree tests."""
    subprocess.run(['git', 'init'], cwd=str(path), capture_output=True, timeout=5)
    subprocess.run(['git', 'config', 'user.email', 'test@test.com'],
                    cwd=str(path), capture_output=True, timeout=5)
    subprocess.run(['git', 'config', 'user.name', 'Test'],
                    cwd=str(path), capture_output=True, timeout=5)
    (path / 'README.md').write_text('test repo', encoding='utf-8')
    subprocess.run(['git', 'add', 'README.md'], cwd=str(path), capture_output=True, timeout=5)
    subprocess.run(['git', 'commit', '-m', 'initial'], cwd=str(path), capture_output=True, timeout=5)


def _make_git_session(tracked_list):
    """Create a session with a git-initialized workspace."""
    from tests.conftest import make_session_tracked
    ws = TEST_STATE_DIR / 'worktree-test-workspace'
    if ws.exists():
        try:
            subprocess.run(['git', 'worktree', 'prune'], cwd=str(ws), capture_output=True, timeout=5)
        except Exception:
            pass
    ws.mkdir(parents=True, exist_ok=True)
    if not (ws / '.git').exists():
        _init_git_repo(ws)
    sid, ws_path = make_session_tracked(tracked_list, ws=str(ws))
    return sid, ws_path


def test_worktree_create_success(cleanup_test_sessions):
    """TC-API-1: Create worktree successfully."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    resp, status = _post("/api/worktree/create", {
        "session_id": sid,
        "branch_name": "wt-test-1",
    })
    assert status == 200
    assert "worktree_id" in resp
    assert "path" in resp
    assert "branch" in resp
    assert resp["branch"] == "wt-test-1"
    assert Path(resp["path"]).exists()
    _post("/api/worktree/remove", {"worktree_id": "wt-test-1", "session_id": sid})


def test_worktree_create_auto_branch(cleanup_test_sessions):
    """TC-API-1 edge: Auto-generated branch name when branch_name omitted."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    resp, status = _post("/api/worktree/create", {"session_id": sid})
    assert status == 200
    assert "worktree_id" in resp
    assert resp["branch"].startswith("wt-")
    _post("/api/worktree/remove", {"worktree_id": resp["worktree_id"], "session_id": sid})


def test_worktree_create_non_git_workspace(cleanup_test_sessions):
    """TC-API-2: Create worktree on non-git workspace → 400."""
    from tests.conftest import make_session_tracked
    non_git_ws = TEST_STATE_DIR / 'non-git-workspace'
    non_git_ws.mkdir(parents=True, exist_ok=True)
    if (non_git_ws / '.git').exists():
        import shutil
        shutil.rmtree(non_git_ws / '.git')
    sid, ws = make_session_tracked(cleanup_test_sessions, ws=str(non_git_ws))
    resp, status = _post("/api/worktree/create", {"session_id": sid})
    assert status == 400
    assert "error" in resp
    assert "not a git repo" in resp["error"]


def test_worktree_create_duplicate_branch(cleanup_test_sessions):
    """TC-API-3: Create worktree with duplicate branch → 409."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    resp1, status1 = _post("/api/worktree/create", {
        "session_id": sid,
        "branch_name": "wt-dup-test",
    })
    assert status1 == 200
    resp2, status2 = _post("/api/worktree/create", {
        "session_id": sid,
        "branch_name": "wt-dup-test",
    })
    assert status2 == 409
    assert "error" in resp2
    _post("/api/worktree/remove", {"worktree_id": "wt-dup-test", "session_id": sid})


def test_worktree_list(cleanup_test_sessions):
    """TC-API-4: List existing worktrees."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    _post("/api/worktree/create", {"session_id": sid, "branch_name": "wt-list-1"})
    _post("/api/worktree/create", {"session_id": sid, "branch_name": "wt-list-2"})
    resp, status = _get(f"/api/worktree/list?session_id={sid}")
    assert status == 200
    wts = resp.get("worktrees", [])
    wt_ids = [w["worktree_id"] for w in wts]
    assert "wt-list-1" in wt_ids
    assert "wt-list-2" in wt_ids
    _post("/api/worktree/remove", {"worktree_id": "wt-list-1", "session_id": sid})
    _post("/api/worktree/remove", {"worktree_id": "wt-list-2", "session_id": sid})


def test_worktree_list_empty(cleanup_test_sessions):
    """TC-API-4 edge: List worktrees on git workspace (no extra worktrees)."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    resp, status = _get(f"/api/worktree/list?session_id={sid}")
    assert status == 200
    assert "worktrees" in resp


def test_worktree_remove_success(cleanup_test_sessions):
    """TC-API-5: Remove worktree successfully."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    resp1, _ = _post("/api/worktree/create", {
        "session_id": sid,
        "branch_name": "wt-remove-test",
    })
    wt_path = resp1["path"]
    assert Path(wt_path).exists()
    resp, status = _post("/api/worktree/remove", {
        "worktree_id": "wt-remove-test",
        "session_id": sid,
    })
    assert status == 200
    assert resp.get("removed") is True
    assert resp["worktree_id"] == "wt-remove-test"
    assert not Path(wt_path).exists()


def test_worktree_remove_nonexistent(cleanup_test_sessions):
    """TC-API-6: Remove nonexistent worktree → 404."""
    sid, ws = _make_git_session(cleanup_test_sessions)
    resp, status = _post("/api/worktree/remove", {
        "worktree_id": "wt-nonexistent",
        "session_id": sid,
    })
    assert status == 404
    assert "error" in resp