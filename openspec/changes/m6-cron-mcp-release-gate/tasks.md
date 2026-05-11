## 1. Backend — Cron-to-Kanban Bridge

- [x] 1.1 在 `api/routes.py` `_handle_cron_output`（或 cron 完成回调）中，读取 cron job config 的 `on_success_create_task` / `on_failure_create_task` 字段
- [x] 1.2 当字段为 true 且条件匹配时，调用 `_create_task_payload` 创建 kanban 任务：`title="Cron: {job_name} — {success|failed}"`，`tenant="cron"`，`status="triage"`，failure 时 `priority=1`
- [x] 1.3 将 `cron_run_id` 写入新任务的 `body` 字段中，便于追溯

## 2. Backend — MCP Kanban Tools

- [x] 2.1 在 `mcp_server.py` `TOOLS` 列表中新增 4 个 Tool 对象：`kanban_create_task`、`kanban_list_tasks`、`kanban_update_task_status`、`kanban_get_task`，各自定义 `inputSchema`
- [x] 2.2 新增 `handle_kanban_create_task` 处理函数：通过 `_api_post("/api/kanban/tasks", body)` 创建任务
- [x] 2.3 新增 `handle_kanban_list_tasks` 处理函数：通过 hermes_cli.kanban_db 直接读取任务列表（读操作不走 HTTP），支持 `status` 过滤
- [x] 2.4 新增 `handle_kanban_update_task_status` 处理函数：通过 `_api_post("/api/kanban/tasks/<id>/patch", {"status": ...})` 更新状态
- [x] 2.5 新增 `handle_kanban_get_task` 处理函数：通过 `_api_post` 或直接 HTTP GET 获取任务详情（含 comments、events、links）
- [x] 2.6 在 `HANDLERS` 字典中注册 4 个新处理函数

## 3. Backend — Release Gate

- [x] 3.1 在 `api/kanban_bridge.py` `_patch_task()` 的 `done` 分支（`kb.complete_task` 成功后），检查任务是否有 `workspace_path`；若有，提交 `kind="release_gate"` clarify（含分支名和 merge 指令），而不是直接归档
- [x] 3.2 在 `api/routes.py` `_handle_clarify_respond` 中处理 `kind="release_gate"` 的 approve：
  - 从 clarify data 中取 `workspace_path` 和分支名
  - 执行 `subprocess.run(["git", "merge", branch])` 在主 workspace 中
  - 成功：调用 `worktree_remove` 清理 worktree → 将任务归档
  - 失败：将任务设为 `blocked`，记录 merge 错误到评论
- [x] 3.3 在 `_handle_clarify_respond` 中处理 `kind="release_gate"` 的 reject：将任务设为 `blocked`

## 4. Frontend — Release Gate Clarify Card

- [x] 4.1 在 `static/messages.js` `showClarifyCard` 中新增 `kind="release_gate"` 分支：显示分支名、merge 目标、Merge & Archive / Reject 按钮
- [x] 4.2 在 `static/style.css` 新增 `.clarify-release-gate-card` 样式

## 5. Frontend — Cron Task Badge

- [x] 5.1 在 `static/panels.js` `_kanbanCard()` 中：当 task.tenant === "cron" 时显示 cron badge（`⏱ cron`）

## 6. Testing

- [x] 6.1 新增 `tests/test_m6_mcp_kanban.py`：测试 4 个 MCP kanban 工具的注册和 handler 返回
- [x] 6.2 新增 `tests/test_m6_release_gate.py`：测试 done + workspace_path 触发 release gate clarify
- [x] 6.3 运行全量测试 `pytest tests/` 并修复所有失败