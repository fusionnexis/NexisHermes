# API Test Specification

## Change: m3-task-execution-binding
## Generated: 2026-05-10

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Base class/helpers: `tests/_pytest_port.py` 提供 `BASE`；`tests/conftest.py` 提供 `test_server` fixture、`cleanup_test_sessions`、`make_session_tracked`
- Existing patterns: 函数式测试，`_post(path, body) → (dict, status)`、`_get(path) → (dict, status)` 本地辅助函数，`requires_agent` marker 跳过无 hermes_cli 环境
- 测试文件规划：`tests/test_m3_claim.py`（TC-1~5）、`tests/test_m3_dag.py`（TC-6~8）

## Test Cases

### TC-API-1: 正常认领任务（无 worktree）
- **Endpoint**: `POST /api/kanban/claim`
- **Type**: integration
- **Setup**: 创建一个 `ready` 状态的任务（requires_agent）
- **Request**: `{"task_id": "<id>", "create_worktree": false}`
- **Expected Response**: 200，`{task.status == "running", session.kanban_task_id == task_id, task.session_id != null}`
- **Edge Cases**:
  - `session.role` 继承当前 active profile 的 role
  - 响应包含 `task`、`session`、`worktree: null`
- **Teardown**: 清理 session，将任务归档

### TC-API-2: 认领任务并创建 worktree
- **Endpoint**: `POST /api/kanban/claim`
- **Type**: integration
- **Setup**: 创建 ready 任务；workspace 是 git 仓库（requires_agent + git workspace）
- **Request**: `{"task_id": "<id>", "create_worktree": true}`
- **Expected Response**: 200，`{task.workspace_path != null, worktree.path exists on disk, session.workspace == worktree.path}`
- **Edge Cases**:
  - worktree 路径为 `<workspace>-task-<task_id>`
- **Teardown**: 移除 worktree，清理 session 和任务

### TC-API-3: 认领已 running 任务返回 409
- **Endpoint**: `POST /api/kanban/claim`
- **Type**: integration
- **Setup**: 创建任务并先行认领（requires_agent）
- **Request**: `{"task_id": "<id>", "create_worktree": false}`（第二次调用）
- **Expected Response**: 409，`{"error": ...}` 包含 "claimed" 或 "already"
- **Teardown**: 清理

### TC-API-4: worktree 创建失败时任务状态不变
- **Endpoint**: `POST /api/kanban/claim`
- **Type**: integration
- **Setup**: 创建 ready 任务；workspace 是非 git 目录
- **Request**: `{"task_id": "<id>", "create_worktree": true}`
- **Expected Response**: 400，`{"error": "workspace is not a git repo"}` 且任务仍为 `ready`
- **Teardown**: 清理任务

### TC-API-5: Session.kanban_task_id 反向绑定
- **Endpoint**: `GET /api/session?session_id=<sid>`（认领后验证）
- **Type**: integration
- **Setup**: 通过 claim 创建 session
- **Expected Response**: session 响应中 `kanban_task_id == task_id`
- **Edge Cases**: 普通 `/api/session/new` 创建的 session `kanban_task_id == null`
- **Teardown**: 清理

### TC-API-6: DAG — 父任务完成后子任务可转 ready
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建父任务（done）和子任务（triage），建立 parent→child 链接（requires_agent）
- **Request**: `{"status": "ready"}` on child
- **Expected Response**: 200，`task.status == "ready"`
- **Teardown**: 清理任务

### TC-API-7: DAG — 父任务未完成时子任务不能转 ready
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建父任务（todo）和子任务（triage），建立链接（requires_agent）
- **Request**: `{"status": "ready"}` on child
- **Expected Response**: 400，`{"error": ...}` 包含父任务 ID
- **Teardown**: 清理

### TC-API-8: DAG — 无父任务的任务可自由转 ready
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建独立任务（triage），无 parent 链接（requires_agent）
- **Request**: `{"status": "ready"}`
- **Expected Response**: 200
- **Teardown**: 清理

### TC-API-9: Role-aware dispatch — role 参数过滤任务
- **Endpoint**: `POST /api/kanban/dispatch?role=qa`
- **Type**: integration
- **Setup**: 创建两个 ready 任务：一个 `assignee="coder/coder"`，一个 `assignee="qa/qa"`（requires_agent）
- **Expected**: dispatch 仅认领 `/qa` 后缀的任务（`spawned <= 1`，且认领的是 qa 任务）
- **Teardown**: 清理

## Notes
- TC-API-1~5 放在 `tests/test_m3_claim.py`，TC-API-6~8 放在 `tests/test_m3_dag.py`，TC-API-9 可追加到 `test_m3_claim.py`
- TC-API-1~9 均需要 `requires_agent` marker（需要 hermes_cli.kanban_db）
- DAG 测试中建立父子链接使用 `POST /api/kanban/links`，参考 `test_worktree_kanban_binding.py` 中的 `_post` 辅助函数
- claim 测试中验证 worktree 物理路径存在，使用 `pathlib.Path(wt_path).exists()`
- dispatch role filter 测试依赖 hermes_cli `dispatch_once` 支持 `role_filter` 或 WebUI 层的后置过滤实现