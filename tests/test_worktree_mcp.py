"""Tests for MCP worktree tool registration and handler dispatch.

TC-API-8: MCP worktree_create, worktree_list, worktree_remove
tool registration and handler dispatch verification.
"""
import json
from unittest.mock import patch, MagicMock

import pytest


def test_mcp_worktree_tools_registered():
    """TC-API-8: MCP worktree tools are in the TOOLS list."""
    # Import mcp_server without starting the actual MCP server
    # The module-level TOOLS and HANDLERS dicts should contain worktree entries
    import mcp_server
    tool_names = [t.name for t in mcp_server.TOOLS]
    assert "worktree_create" in tool_names
    assert "worktree_list" in tool_names
    assert "worktree_remove" in tool_names


def test_mcp_worktree_handlers_registered():
    """TC-API-8: MCP worktree handlers are in the HANDLERS dict."""
    import mcp_server
    assert "worktree_create" in mcp_server.HANDLERS
    assert "worktree_list" in mcp_server.HANDLERS
    assert "worktree_remove" in mcp_server.HANDLERS


def test_mcp_worktree_create_tool_schema():
    """TC-API-8: worktree_create tool has correct inputSchema."""
    import mcp_server
    tool = next(t for t in mcp_server.TOOLS if t.name == "worktree_create")
    schema = tool.inputSchema
    assert schema["type"] == "object"
    props = schema["properties"]
    assert "session_id" in props
    assert "branch_name" in props
    assert "base_ref" in props
    assert "session_id" in schema["required"]


def test_mcp_worktree_list_tool_schema():
    """TC-API-8: worktree_list tool has correct inputSchema."""
    import mcp_server
    tool = next(t for t in mcp_server.TOOLS if t.name == "worktree_list")
    schema = tool.inputSchema
    assert schema["type"] == "object"
    props = schema["properties"]
    assert "session_id" in props
    assert "session_id" in schema["required"]


def test_mcp_worktree_remove_tool_schema():
    """TC-API-8: worktree_remove tool has correct inputSchema."""
    import mcp_server
    tool = next(t for t in mcp_server.TOOLS if t.name == "worktree_remove")
    schema = tool.inputSchema
    assert schema["type"] == "object"
    props = schema["properties"]
    assert "worktree_id" in props
    assert "session_id" in props
    assert "worktree_id" in schema["required"]
    assert "session_id" in schema["required"]


def test_mcp_worktree_create_handler_missing_session():
    """TC-API-8 edge: worktree_create without session_id → error."""
    import asyncio
    import mcp_server
    handler = mcp_server.HANDLERS["worktree_create"]
    result = asyncio.run(handler({}))
    text = json.loads(result[0].text)
    assert "error" in text
    assert "session_id is required" in text["error"]


def test_mcp_worktree_list_handler_missing_session():
    """TC-API-8 edge: worktree_list without session_id → error."""
    import asyncio
    import mcp_server
    handler = mcp_server.HANDLERS["worktree_list"]
    result = asyncio.run(handler({}))
    text = json.loads(result[0].text)
    assert "error" in text
    assert "session_id is required" in text["error"]


def test_mcp_worktree_remove_handler_missing_id():
    """TC-API-8 edge: worktree_remove without worktree_id → error."""
    import asyncio
    import mcp_server
    handler = mcp_server.HANDLERS["worktree_remove"]
    result = asyncio.run(handler({}))
    text = json.loads(result[0].text)
    assert "error" in text
    assert "worktree_id is required" in text["error"]