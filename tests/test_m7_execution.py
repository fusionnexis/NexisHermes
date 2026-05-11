"""Tests for M7 execution status API and scheduler config."""
import json
import urllib.request
import urllib.error

from tests._pytest_port import BASE


def _get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}"), e.code


def test_execution_status_endpoint():
    """TC-API-4: /api/execution/status returns correct fields."""
    resp, status = _get("/api/execution/status")
    assert status == 200
    assert "enabled" in resp
    assert "active_workers" in resp
    assert "max_concurrent" in resp
    assert "queue_depth" in resp
    assert "scheduler_interval" in resp
    assert "uptime_seconds" in resp


def test_execution_status_disabled_by_default():
    """TC-API-5: Scheduler disabled by default."""
    resp, status = _get("/api/execution/status")
    assert status == 200
    assert resp["enabled"] is False


def test_execution_status_numeric_fields():
    """TC-API-6: Numeric fields have correct types."""
    resp, _ = _get("/api/execution/status")
    assert isinstance(resp["active_workers"], int)
    assert isinstance(resp["max_concurrent"], int)
    assert isinstance(resp["queue_depth"], int)
    assert isinstance(resp["scheduler_interval"], float)
