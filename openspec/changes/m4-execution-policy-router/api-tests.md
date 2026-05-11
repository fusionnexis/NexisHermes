# API Test Specification

## Change: m4-execution-policy-router
## Generated: 2026-05-10

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Base class/helpers: `tests/_pytest_port.py` 提供 `BASE`；`tests/conftest.py` 提供 `test_server` fixture、`cleanup_test_sessions`
- Existing patterns: 函数式测试，`_post(path, body) → (dict, status)`、`_get(path) → (dict, status)` 辅助函数，`requires_agent` marker

## Test Cases

### TC-API-1: Small 任务直接路由到 claim
- **Endpoint**: `POST /api/kanban/execute`
- **Type**: integration
- **Setup**: 创建 `task_size="small"` 的 ready 任务（requires_agent）
- **Request**: `{"task_id": "<id>"}`
- **Expected Response**: 200，`{route: "small", task.status == "running", session != null}`
- **Edge Cases**:
  - `task_size=null` → 同样路由到 `small`（默认）
- **Teardown**: 归档任务，清理 session

### TC-API-2: Medium 任务提交 plan clarify
- **Endpoint**: `POST /api/kanban/execute`
- **Type**: integration
- **Setup**: 创建 `task_size="medium"` 的 ready 任务；提供 `plan_content="## 执行计划\n..."` （requires_agent）
- **Request**: `{"task_id": "<id>", "plan_content": "## Plan\n- Step 1\n- Step 2"}`
- **Expected Response**: 200，`{route: "medium", clarify_pending: true, task.status == "running"}`
- **Edge Cases**:
  - `plan_content` 为空时 clarify 仍提交（内容为空占位）
- **Teardown**: resolve clarify，归档任务

### TC-API-3: Large 任务提交 Phase 1 clarify
- **Endpoint**: `POST /api/kanban/execute`
- **Type**: integration
- **Setup**: 创建 `task_size="large"` 的 ready 任务（requires_agent）
- **Request**: `{"task_id": "<id>"}`
- **Expected Response**: 200，`{route: "large", clarify_phase: 1}`
- **Teardown**: resolve clarify，归档任务

### TC-API-4: Task not found 返回 404
- **Endpoint**: `POST /api/kanban/execute`
- **Type**: integration
- **Request**: `{"task_id": "t_nonexistent"}`
- **Expected Response**: 404，`{"error": ...}`

### TC-API-5: 已认领任务返回 409
- **Endpoint**: `POST /api/kanban/execute`
- **Type**: integration
- **Setup**: 创建任务并先行认领（requires_agent）
- **Request**: `{"task_id": "<id>"}` 第二次调用
- **Expected Response**: 409

### TC-API-6: Clarify kind 字段在 pending 响应中返回
- **Endpoint**: `GET /api/clarify/pending`
- **Type**: integration
- **Setup**: 通过 `/api/kanban/execute` 触发 medium 任务，生成 kind="plan" clarify
- **Expected Response**: clarify pending 数据含 `{kind: "plan"}`

### TC-API-7: Approve plan 触发 memory write
- **Endpoint**: `POST /api/clarify/respond`
- **Type**: integration
- **Setup**: 触发 medium 任务 → 获取 clarify session_key → approve
- **Request**: `{"response": "approve", "session_key": "<key>"}`
- **Expected Response**: 200；且 `GET /api/memory` 包含写入的计划内容
- **Edge Cases**:
  - reject 时不写 memory

### TC-API-8: Reject plan 将任务退回 planned
- **Endpoint**: `POST /api/clarify/respond`
- **Type**: integration
- **Setup**: 触发 medium 任务 → reject
- **Request**: `{"response": "reject", "session_key": "<key>"}`
- **Expected Response**: 200；任务 status 变回 `todo`

## Notes
- TC-API-1~8 均需要 `requires_agent` marker（requires hermes_cli.kanban_db）
- 测试文件：`tests/test_m4_execute.py`
- clarify session_key 通常为 session_id，从 execute 响应中取得
- memory write 验证：`GET /api/memory` 返回包含写入内容的条目；若 memory API 不支持读，可跳过读取验证，仅确认 respond 返回 200