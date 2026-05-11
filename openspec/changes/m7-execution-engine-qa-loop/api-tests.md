# API Test Specification

## Change: m7-execution-engine-qa-loop
## Generated: 2026-05-11

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Existing patterns: `_post`/`_get` helpers, `requires_agent` marker, function-based tests

## Test Cases

### TC-API-1: QA fail with retries < max → parent back to ready
- **Endpoint**: PATCH `result` on QA task
- **Type**: integration (requires_agent)
- **Setup**: Create task → claim → in_review → QA spawns → set QA result with failure (all phases resolved, 1 fail)
- **Expected**: Parent status = `ready`, `result.qa_retries = 1`
- **Edge Cases**: Verify failure comment added to parent

### TC-API-2: QA fail with retries >= max → parent blocked + escalation
- **Type**: integration (requires_agent)
- **Setup**: Create task with result containing `qa_retries: 3` → QA fails
- **Expected**: Parent status = `blocked`, escalation clarify submitted

### TC-API-3: Re-claim after QA retry reuses worktree
- **Type**: integration (requires_agent)
- **Setup**: Task with workspace_path set → back to ready after QA fail → re-claim
- **Expected**: No new worktree created (claim with create_worktree=false)

### TC-API-4: /api/execution/status returns correct fields
- **Endpoint**: `GET /api/execution/status`
- **Type**: integration
- **Expected**: 200, response has `enabled`, `active_workers`, `max_concurrent`, `queue_depth`

### TC-API-5: /api/execution/status when disabled
- **Expected**: response has `enabled: false`

### TC-API-6: Execution config from config.yaml
- **Type**: unit
- **Expected**: Default values: enabled=false, max_concurrent=4, scheduler_interval=5.0, max_qa_retries=3

## Notes
- 测试文件：`tests/test_m7_qa_loop.py`（TC-1~3）、`tests/test_m7_execution.py`（TC-4~6）
- TC-1~3 需要完整的 claim→in_review→QA spawn→QA result 流程
- TC-4~5 仅需 HTTP GET，不依赖 agent
- Scheduler thread 测试：验证 start/stop 不崩溃即可，不测试调度行为（避免 timing flakiness）