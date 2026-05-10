"""Tests for M2 session role field — TC-API-1, TC-API-2, TC-API-3."""
import json
import urllib.error
import urllib.request

from tests._pytest_port import BASE


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


def test_session_role_defaults_to_coder(cleanup_test_sessions):
    """TC-API-1: Session created without role defaults to coder."""
    resp, status = _post("/api/session/new", {})
    assert status == 200
    session = resp.get("session", {})
    cleanup_test_sessions.append(session["session_id"])
    assert "role" in session
    assert session["role"] == "coder"


def test_session_role_explicit_qa(cleanup_test_sessions):
    """TC-API-2: Session created with role=qa returns qa."""
    resp, status = _post("/api/session/new", {"role": "qa"})
    assert status == 200
    session = resp.get("session", {})
    cleanup_test_sessions.append(session["session_id"])
    assert session["role"] == "qa"


def test_session_role_explicit_planner(cleanup_test_sessions):
    """TC-API-2 edge: role=planner."""
    resp, status = _post("/api/session/new", {"role": "planner"})
    assert status == 200
    session = resp.get("session", {})
    cleanup_test_sessions.append(session["session_id"])
    assert session["role"] == "planner"


def test_session_role_explicit_reviewer(cleanup_test_sessions):
    """TC-API-2 edge: role=reviewer."""
    resp, status = _post("/api/session/new", {"role": "reviewer"})
    assert status == 200
    session = resp.get("session", {})
    cleanup_test_sessions.append(session["session_id"])
    assert session["role"] == "reviewer"


def test_session_role_invalid_rejected(cleanup_test_sessions):
    """TC-API-3: Invalid role returns 400."""
    resp, status = _post("/api/session/new", {"role": "superagent"})
    assert status == 400
    assert "error" in resp


def test_session_role_empty_string_defaults_to_coder(cleanup_test_sessions):
    """TC-API-3 edge: Empty role string falls back to profile default (coder)."""
    resp, status = _post("/api/session/new", {"role": ""})
    # Empty string treated as no role — derives from profile config (defaults coder)
    assert status == 200
    session = resp.get("session", {})
    cleanup_test_sessions.append(session["session_id"])
    assert session["role"] == "coder"
