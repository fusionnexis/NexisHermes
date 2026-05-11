"""Tests for M6 MCP kanban tools — TC-API-1 through TC-API-5."""
import asyncio
import json
import mcp_server


def test_mcp_kanban_create_task_registered():
    """TC-API-1: kanban_create_task in TOOLS and HANDLERS."""
    tool_names = [t.name for t in mcp_server.TOOLS]
    assert "kanban_create_task" in tool_names
    assert "kanban_create_task" in mcp_server.HANDLERS


def test_mcp_kanban_list_tasks_registered():
    """TC-API-2: kanban_list_tasks registered."""
    tool_names = [t.name for t in mcp_server.TOOLS]
    assert "kanban_list_tasks" in tool_names
    assert "kanban_list_tasks" in mcp_server.HANDLERS


def test_mcp_kanban_update_task_status_registered():
    """TC-API-3: kanban_update_task_status registered."""
    tool_names = [t.name for t in mcp_server.TOOLS]
    assert "kanban_update_task_status" in tool_names
    assert "kanban_update_task_status" in mcp_server.HANDLERS


def test_mcp_kanban_get_task_registered():
    """TC-API-4: kanban_get_task registered."""
    tool_names = [t.name for t in mcp_server.TOOLS]
    assert "kanban_get_task" in tool_names
    assert "kanban_get_task" in mcp_server.HANDLERS


def test_mcp_kanban_create_task_missing_title():
    """TC-API-5: kanban_create_task without title returns error."""
    handler = mcp_server.HANDLERS["kanban_create_task"]
    result = asyncio.run(handler({}))
    text = json.loads(result[0].text)
    assert "error" in text
    assert "title" in text["error"]


def test_mcp_kanban_get_task_missing_id():
    """TC-API-5 edge: kanban_get_task without task_id returns error."""
    handler = mcp_server.HANDLERS["kanban_get_task"]
    result = asyncio.run(handler({}))
    text = json.loads(result[0].text)
    assert "error" in text


def test_mcp_kanban_update_missing_args():
    """TC-API-5 edge: kanban_update_task_status without args returns error."""
    handler = mcp_server.HANDLERS["kanban_update_task_status"]
    result = asyncio.run(handler({}))
    text = json.loads(result[0].text)
    assert "error" in text
