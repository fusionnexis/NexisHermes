# API Test Specification

## Change: m5-qa-verification-pipeline
## Generated: 2026-05-10

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Existing patterns: `_post(path, body)` + `_get(path)` helpers, `requires_agent` marker, `cleanup_test_sessions` fixture

## Test Cases

### TC-API-1: in_review 转换自动创建 QA 子任务
- **Endpoint**: `POST /api/kanban/tasks/<id>/patch`
- **Type**: integration
- **Setup**: 创建 ready 任务 → claim → 设置 `in_review`（requires_agent）
- **Expected**: QA 子任务存在（通过 `/api/kanban/board` 查询 qa_verify 列），linked as child

### TC-API-2: QA 子任务继承 workspace_path
- **Endpoint**: task detail API
- **Setup**: 创建带 workspace_path 的任务 → in_review
- **Expected**: QA 子任务的 workspace_path 与 parent 相同

### TC-API-3: QA result 全 pass 提交 qa_report clarify
- **Endpoint**: `POST /api/kanban/tasks/<id>/qa-result` 或 PATCH result
- **Setup**: QA 任务存在 → 更新 result JSON 全 pass
- **Expected**: clarify pending 出现 `kind="qa_report"`, `outcome="pass"`

### TC-API-4: QA result 有 fail → parent blocked
- **Setup**: QA 任务 → 更新 result 含 fail 阶段
- **Expected**: parent 任务 status="blocked"

### TC-API-5: qa_report approve → parent done
- **Endpoint**: `POST /api/clarify/respond`
- **Setup**: qa_report clarify 存在 → approve
- **Expected**: parent 任务 status="done"

### TC-API-6: in_review spawn 失败不阻塞状态转换
- **Setup**: parent 任务 → in_review（模拟 create_task 异常）
- **Expected**: parent 仍然成功进入 in_review

## Notes
- 测试文件：`tests/test_m5_qa_spawn.py`
- TC-API-1~6 均需 `requires_agent`
- QA spawn 依赖 `in_review` 转换成功（需先通过 `running` → `in_review` transition rule）
- 可通过 claim 端点将任务设为 running，再 PATCH in_review