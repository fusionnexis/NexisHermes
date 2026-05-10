# API Test Specification

## Change: m2-roles-statuses
## Generated: 2026-05-10

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Base class/helpers: `tests/_pytest_port.py` 提供 `BASE`、`TEST_STATE_DIR`；`tests/conftest.py` 提供 `test_server` session fixture、`cleanup_test_sessions`、`make_session_tracked`
- Existing patterns: 函数式测试（非类），`urllib.request` + `urllib.error.HTTPError` 处理 HTTP，`_post(path, body) → (dict, status)`、`_get(path) → (dict, status)` 本地辅助函数，通过隔离测试服务器运行集成测试

## Test Cases

### TC-API-1: Session 创建默认 role=coder
- **Endpoint**: `POST /api/session/new`
- **Type**: integration
- **Setup**: 测试服务器运行（conftest test_server fixture）
- **Request**: `{}` (无 role 字段)
- **Expected Response**: 200，`session.role == "coder"`
- **Edge Cases**:
  - `role` 字段存在于响应 JSON 中（不缺失）
- **Teardown**: cleanup_test_sessions

### TC-API-2: Session 创建指定合法 role
- **Endpoint**: `POST /api/session/new`
- **Type**: integration
- **Setup**: 测试服务器运行
- **Request**: `{"role": "qa"}`
- **Expected Response**: 200，`session.role == "qa"`
- **Edge Cases**:
  - `role="planner"` → 200，`session.role == "planner"`
  - `role="reviewer"` → 200，`session.role == "reviewer"`
- **Teardown**: cleanup_test_sessions

### TC-API-3: Session 创建非法 role 被拒绝
- **Endpoint**: `POST /api/session/new`
- **Type**: integration
- **Setup**: 测试服务器运行
- **Request**: `{"role": "superagent"}`
- **Expected Response**: 400，`{"error": ...}` 包含错误信息
- **Edge Cases**:
  - `role=""` → 400
- **Teardown**: 无（Session 未被创建）

### TC-API-4: Kanban board 返回 9 列
- **Endpoint**: `GET /api/kanban/board`
- **Type**: integration
- **Setup**: 测试服务器运行（需要 hermes_cli.kanban_db 可用，用 `requires_agent` 标记）
- **Request**: GET（无参数）
- **Expected Response**: 200，`columns` 数组长度为 9，包含 `in_review`、`qa_verify`、`release_ready`
- **Edge Cases**:
  - `/api/kanban/config` 返回的 `columns` 也包含 9 列
- **Teardown**: 无

### TC-API-5: 创建 kanban 任务带 task_size
- **Endpoint**: `POST /api/kanban/tasks`
- **Type**: integration
- **Setup**: 测试服务器运行（requires_agent）
- **Request**: `{"title": "size test", "task_size": "medium"}`
- **Expected Response**: 200，`task.task_size == "medium"`
- **Edge Cases**:
  - `task_size="small"` → 200，`task.task_size == "small"`
  - `task_size="large"` → 200，`task.task_size == "large"`
  - `task_size` 未传 → `task.task_size == null`
  - `task_size="huge"` → 400
- **Teardown**: 删除创建的任务

### TC-API-6: Kanban 状态转换验证 — in_review
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建一个任务并设置 `status="running"`（需要通过 `_set_status_direct` 绕过 claim 保护）
- **Request**: `{"status": "in_review"}`
- **Expected Response**: 200，`task.status == "in_review"`
- **Edge Cases**:
  - 从 `todo` 转 `in_review` → 400，错误信息包含"invalid transition"或类似提示
  - 从 `ready` 转 `in_review` → 400
- **Teardown**: 删除测试任务

### TC-API-7: Kanban 状态转换链 running→in_review→qa_verify→release_ready
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建任务并将 status 设置为 `running`（requires_agent）
- **Request**: 依次 patch status 为 `in_review`、`qa_verify`、`release_ready`
- **Expected Response**: 每步均返回 200，最终 `task.status == "release_ready"`
- **Edge Cases**:
  - 跳过中间状态（running → qa_verify）→ 400
- **Teardown**: 删除测试任务

### TC-API-8: task_size PATCH 更新
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建一个无 size 的任务（requires_agent）
- **Request**: `{"task_size": "large"}`
- **Expected Response**: 200，`task.task_size == "large"`
- **Edge Cases**:
  - 将 task_size 改回 null → 200，`task.task_size == null`
- **Teardown**: 删除测试任务

## Notes
- TC-API-4 到 TC-API-8 需要 `hermes_cli.kanban_db` 可用，使用 `requires_agent` marker 在无 agent 环境下跳过
- Task status 强制转换（运行状态）测试：`running` 状态由 claim_task 进入，测试中可直接 `conn.execute("UPDATE tasks SET status='running' WHERE id=?")` 绕过 claim 流程，或通过测试辅助函数
- 测试文件应放在 `tests/test_m2_session_role.py`（TC-API-1~3）和 `tests/test_m2_kanban_statuses.py`（TC-API-4~8）
- 遵循现有模式：`_post()` / `_get()` 辅助函数，`from tests._pytest_port import BASE`，fixture 使用 `cleanup_test_sessions`