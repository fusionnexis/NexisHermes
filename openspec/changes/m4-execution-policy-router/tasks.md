## 1. Backend — Execution Policy Router

- [x] 1.1 在 `api/kanban_bridge.py` 中新增 `_execution_policy_router(task_size: str | None) -> str` 函数：返回 `"small"` / `"medium"` / `"large"`；`task_size=None` 或未知值默认 `"small"`
- [x] 1.2 在 `api/kanban_bridge.py` 中新增 `_execute_payload(body: dict) -> dict` 函数：
  - 读取 `task_id`（必填）、`plan_content`（可选）、`board`（可选）
  - 查询任务获取 `task_size`
  - 调用 `_execution_policy_router(task_size)` 决定路由
  - Small：调用 `claim_task_with_binding`，返回 `{route, task, session, worktree}`
  - Medium：调用 `claim_task_with_binding`，提交 `kind="plan"` clarify，返回 `{route, clarify_pending: true}`
  - Large：调用 `claim_task_with_binding`，提交 `kind="proposal"` Phase 1 clarify，返回 `{route, clarify_phase: 1}`
- [x] 1.3 在 `api/kanban_bridge.py` `handle_kanban_post` 中注册 `POST /api/kanban/execute` 路由，调用 `_execute_payload`；错误处理：404（task not found）、409（already claimed）、400（其他）

## 2. Backend — Structured Clarify (`kind` field)

- [x] 2.1 在 `api/clarify.py` `submit_pending` 中支持 `kind` 字段（`data.get("kind", "text")`）；`kind` 存储在 `_ClarifyEntry.data` 中，随 `get_pending` 返回
- [x] 2.2 在 `api/routes.py` `_handle_clarify_pending` 中确保 `kind`、`phase`、`phase_label`、`content` 字段透传到前端响应
- [x] 2.3 在 `static/messages.js` 中新增 clarify 卡片渲染分支：`kind="plan"` 时渲染 Markdown 文档卡；`kind="proposal"` 时渲染带 phase 标题和 Approve/Reject 按钮的卡；`kind="text"` 保持现有渲染不变

## 3. Backend — Clarify-to-Memory Bridge

- [x] 3.1 在 `api/routes.py` `_handle_clarify_respond` 中，当 response 为 `"approve"` 且 clarify data 含 `kind in ("plan", "proposal")` 且 `content` 非空时，调用 `_memory_write(content, source="clarify", context_key=task_id)`
- [x] 3.2 当 response 为 `"reject"` 且 clarify data 含 `task_id` 时，将对应任务 PATCH 回 `todo` 状态（使用现有 `_patch_task_payload`）
- [x] 3.3 当 response 为 `"approve"` 且 `kind="proposal"` 且 `phase < 3` 时，自动提交下一阶段 clarify（`phase+1`），延续多阶段审批流程

## 4. Frontend — Clarify Card UI

- [x] 4.1 在 `static/messages.js` 中找到 clarify 卡片渲染函数，新增 `kind="plan"` 分支：将 `content` 字段用 Markdown 渲染（复用现有 `_kanbanRenderMarkdown` 或类似函数）
- [x] 4.2 新增 `kind="proposal"` 分支：显示 `phase_label` 标题（如 "Phase 1: Design Review"），内容 Markdown 渲染，Approve/Reject 按钮调用 `/api/clarify/respond`
- [x] 4.3 在 `static/style.css` 中新增 `.clarify-plan-card` 和 `.clarify-proposal-card` 样式（浅色边框、文档感排版）

## 5. Testing

- [x] 5.1 新增 `tests/test_m4_execute.py`：测试 `/api/kanban/execute` 小/中/大路由、task not found 404、已认领 409
- [x] 5.2 测试 clarify `kind` 字段在 pending 响应中正确返回
- [x] 5.3 测试 approve+plan 触发 memory write，reject+plan 不触发
- [x] 5.4 运行全量测试 `pytest tests/` 并修复所有失败