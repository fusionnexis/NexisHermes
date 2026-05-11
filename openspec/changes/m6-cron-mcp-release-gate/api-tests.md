# API Test Specification

## Change: m6-cron-mcp-release-gate
## Generated: 2026-05-11

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Existing patterns: `_post`/`_get` helpers, `requires_agent` marker, function-based tests

## Test Cases

### TC-API-1: MCP kanban_create_task 工具注册
- **Type**: unit
- **Setup**: import mcp_server
- **Expected**: `kanban_create_task` in TOOLS names and HANDLERS

### TC-API-2: MCP kanban_list_tasks 工具注册
- **Type**: unit
- **Expected**: `kanban_list_tasks` in TOOLS and HANDLERS

### TC-API-3: MCP kanban_update_task_status 工具注册
- **Type**: unit
- **Expected**: `kanban_update_task_status` in TOOLS and HANDLERS

### TC-API-4: MCP kanban_get_task 工具注册
- **Type**: unit
- **Expected**: `kanban_get_task` in TOOLS and HANDLERS

### TC-API-5: MCP kanban_create_task handler — 缺少 title 返回错误
- **Type**: unit
- **Setup**: 调用 handler({})
- **Expected**: 返回 error JSON containing "title"

### TC-API-6: Release gate — done + workspace_path 触发 clarify
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration (requires_agent)
- **Setup**: 创建任务带 workspace_path → claim → complete (done)
- **Expected**: clarify pending 出现 `kind="release_gate"`

### TC-API-7: Release gate — done without workspace_path 不触发
- **Type**: integration (requires_agent)
- **Setup**: 创建任务无 workspace_path → done
- **Expected**: 无 release_gate clarify

### TC-API-8: Cron badge — tenant="cron" 任务可正常创建
- **Endpoint**: `POST /api/kanban/tasks`
- **Type**: integration (requires_agent)
- **Request**: `{"title": "Cron: test — success", "tenant": "cron", "status": "triage"}`
- **Expected**: 200, task.tenant == "cron"

## Notes
- 测试文件：`tests/test_m6_mcp_kanban.py`（TC-1~5）、`tests/test_m6_release_gate.py`（TC-6~8）
- MCP handler 测试使用 `asyncio.run(handler({}))`
- Release gate 测试需要先 claim 任务（使 task 进入 running），再 PATCH done
- Cron-to-kanban 的 callback 测试需 hermes_cli cron module 可用（可标记 requires_agent_modules）