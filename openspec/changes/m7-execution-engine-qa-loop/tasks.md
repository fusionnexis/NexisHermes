## 1. Backend — QA Fix Loop

- [x] 1.1 在 `api/kanban_bridge.py` `_evaluate_qa_result()` 中修改 QA 失败分支：
  - 从 parent 任务的 `result` JSON 读取 `qa_retries`（默认 0）
  - 若 `qa_retries < max_qa_retries`（默认 3，从 config 读取）：设 parent 为 `ready` + 递增 `qa_retries` + 添加 failure comment
  - 若 `qa_retries >= max_qa_retries`：保持 `blocked` + 提交 `kind="escalation"` clarify
- [x] 1.2 在 `_evaluate_qa_result()` 中将 failure detail（失败阶段和错误信息）作为 comment 写入 parent 任务，供 coder 下次执行参考
- [x] 1.3 在 `claim_task_with_binding()` 中，检查任务是否已有 `workspace_path`；若有则 `create_worktree=False`（复用原 worktree，不创建新的）
- [x] 1.4 读取 `config.yaml` 的 `execution.max_qa_retries` 配置（默认 3）

## 2. Backend — Execution Scheduler

- [x] 2.1 新增 `api/execution.py` 模块：`ExecutionScheduler` 类，daemon thread
  - `__init__(interval, max_concurrent)` — 从 config 读取参数
  - `start()` — 启动后台线程
  - `stop()` — 优雅停止
  - `_loop()` — 周期执行：count running tasks → if < max_concurrent → `dispatch_once`
- [x] 2.2 在 `_loop()` 中新增超时检查：查询 `running` 任务 where `started_at + max_runtime_seconds < now`，将其设为 `blocked` + 添加 comment
- [x] 2.3 在 `_loop()` 中新增 stale task 检查：`claim_expires < now` 且 `last_heartbeat_at` 过期的 running 任务 → 设回 `ready`
- [x] 2.4 在 `server.py` 启动流程中：读取 `config.yaml execution.enabled`，若为 true 则启动 `ExecutionScheduler`

## 3. Backend — Execution Status API

- [x] 3.1 在 `api/routes.py` 新增 `GET /api/execution/status` 端点：返回 `{enabled, active_workers, max_concurrent, queue_depth, scheduler_interval, uptime_seconds}`
- [x] 3.2 `active_workers` = count of `running` status tasks；`queue_depth` = count of `ready` tasks

## 4. Frontend — Retry Badge

- [x] 4.1 在 `static/panels.js` `_kanbanCard()` 中解析 `task.result` 的 `qa_retries` 字段，渲染 retry badge（`🔄 {retries}/{max}`），追加到 meta 行
- [x] 4.2 添加 `data-testid="retry-badge"` 属性

## 5. Playwright — SSE Clarify Mock Fix

- [x] 5.1 修复 `e2e/m4-execution-policy-router.spec.ts` US-2：使用 `page.evaluate(() => showClarifyCard({kind:"plan", ...}))` 直接注入 clarify 卡片
- [x] 5.2 修复 US-3：同样方式注入 `kind="proposal"` 卡片
- [x] 5.3 修复 US-4：注入 plan 卡片后点击 Approve，验证 `/api/clarify/respond` 调用

## 6. Testing

- [x] 6.1 新增 `tests/test_m7_qa_loop.py`：测试 QA 失败 retries < max → ready；retries >= max → blocked + escalation clarify
- [x] 6.2 新增 `tests/test_m7_execution.py`：测试 `/api/execution/status` 端点返回正确字段
- [x] 6.3 运行全量测试 `pytest tests/` 并修复所有失败