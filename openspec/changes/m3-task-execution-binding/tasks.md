## 1. Backend — Session kanban_task_id Field

- [x] 1.1 在 `api/models.py` `Session.__init__` 中新增 `kanban_task_id` 参数（默认 `None`），添加到实例属性和 `to_dict()` / JSON 序列化输出

## 2. Backend — Task Claim Endpoint

- [x] 2.1 在 `api/kanban_bridge.py` 中新增 `claim_task_with_binding(conn, task_id, profile_name, role, workspace, create_worktree=True)` 函数：
  - 检查任务存在且状态可认领（不是 `running`/`done`/`archived`）
  - 若 `create_worktree=True`：调用 `create_worktree(workspace, branch_name=f"task-{task_id}")` 获取 `worktree_path`；失败时直接抛 `ValueError`
  - 调用 `new_session(workspace=worktree_path or workspace, profile=profile_name, role=role)`，设置 `session.kanban_task_id = task_id`，`session.save()`
  - 调用 `kb.claim_task(conn, task_id)` 使任务进入 `running`
  - 通过 `conn.execute` 写入 `session_id` 和 `workspace_path` 到任务（参考现有 workspace_kind 写法）
  - 设置任务 `assignee = f"{profile_name}/{role}"`（若未设置）
  - 返回 `{task, session, worktree}`

- [x] 2.2 在 `api/routes.py` 新增 `POST /api/kanban/claim` 路由（紧邻 `/api/kanban/dispatch`）：
  - 读取 `body.task_id`（必填）、`body.create_worktree`（默认 True）、`body.board`
  - 读取当前 profile + role（`get_active_profile_name()`、`get_profile_role()`）
  - 解析 workspace（`get_last_workspace()`）
  - 调用 `claim_task_with_binding`，返回结果或错误

- [x] 2.3 错误处理：任务不存在 → 404；任务已 `running` → 409；worktree/session 创建失败 → 400；claim_task 失败（被抢占）→ 409

## 3. Backend — Role-Aware Dispatch

- [x] 3.1 在 `api/kanban_bridge.py` `_dispatch_payload` 中读取 `role` 查询参数（`_str_query(parsed, "role")`），传入 `kb.dispatch_once(conn, ..., role_filter=role)`
- [x] 3.2 如果 `kb.dispatch_once` 不支持 `role_filter` 参数，则在返回前对结果进行后置过滤：对 `running` 状态任务检查 `assignee` 后缀是否匹配 `/{role}`

## 4. Backend — DAG Enforcement

- [x] 4.1 在 `api/kanban_bridge.py` `_patch_task()` 中，当 `status == "ready"` 时，调用 `kb.parent_ids(conn, task_id)` 获取父任务列表
- [x] 4.2 查询父任务状态；若任意父任务不是 `done`，抛 `ValueError(f"parent tasks not complete: {incomplete_ids}")`

## 5. Frontend — Claim Button + Session Badge

- [x] 5.1 在 `static/panels.js` `_kanbanRenderTaskDetail` 中新增 "Claim Task" 按钮（状态为 `ready` 时显示），点击调用 `claimKanbanTask(task.id)`
- [x] 5.2 新增 `async function claimKanbanTask(taskId)` — POST `/api/kanban/claim`，成功后刷新看板和任务详情；失败显示 toast 错误
- [x] 5.3 在 `static/panels.js` `_kanbanCard()` topline 中：当 task 有 `session_id` 时渲染 session badge（`data-testid="session-badge"`，文本 `🔗 {session_id.slice(0,6)}`）
- [x] 5.4 在 `static/style.css` 新增 `.kanban-badge.session` 样式（蓝色调，与 worktree 绿色区分）

## 6. Testing

- [x] 6.1 新增 `tests/test_m3_claim.py`：测试 `/api/kanban/claim` — 正常认领（有/无 worktree）、已认领冲突 409、worktree 失败不改变状态
- [x] 6.2 新增 `tests/test_m3_dag.py`：测试 DAG 强制检查 — 父任务完成可转 ready、父任务未完成返回 400、无父任务无限制
- [x] 6.3 测试 role-aware dispatch：role 参数过滤非匹配 assignee 任务
- [x] 6.4 运行全量测试 `pytest tests/` 并修复所有失败