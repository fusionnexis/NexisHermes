## 1. Backend — QA Auto-Spawn on in_review

- [x] 1.1 在 `api/kanban_bridge.py` `_patch_task()` 的 `in_review` 分支中，`_set_status_direct` 成功后，自动创建 QA 子任务：
  - `kb.create_task(conn, title="QA: {parent_title}", created_by="system", workspace_kind=parent.workspace_kind, workspace_path=parent.workspace_path, tenant=parent.tenant)`
  - `kb.link_tasks(conn, parent_id=task_id, child_id=qa_task_id)`
  - 通过 `conn.execute` 设置 QA 任务 `status="qa_verify"` 和 `assignee="qa/qa"`
  - 失败时记录日志但不阻塞 `in_review` 转换
- [x] 1.2 从 parent 任务读取 `workspace_path`（通过 `conn.execute("SELECT workspace_path FROM tasks WHERE id=?")`）用于 QA 任务继承
- [x] 1.3 将 QA 任务 ID 写入 parent 任务的 `result` 字段（JSON `{"qa_task_id": "..."}` 格式），便于前端关联

## 2. Backend — QA Pipeline Result Tracking

- [x] 2.1 新增 `POST /api/kanban/tasks/<id>/qa-result` 端点（或通过 PATCH `result` 字段），接受 QA phases JSON：`{"phases": [{"name": "IT", "status": "pass|fail|pending", "detail": "..."}]}`
- [x] 2.2 在 QA result 更新时，检查是否全部通过或存在失败：
  - 全部 pass → 提交 `kind="qa_report"`, `outcome="pass"` clarify
  - 存在 fail → 提交 `kind="qa_report"`, `outcome="fail"` clarify + 将 parent task 设为 `blocked`
- [x] 2.3 在 `_handle_clarify_respond` 中处理 `kind="qa_report"` 的 approve：将 parent 任务（从 `task_id` 反查 `task_links` 的 parent）设为 `done`

## 3. Frontend — QA Progress Indicator

- [x] 3.1 在 `static/panels.js` `_kanbanCard()` 中解析 `task.result` 的 `phases` 字段，渲染进度指示器（`✅✅❌⬜` 格式），追加到 meta 行
- [x] 3.2 添加 `data-testid="qa-progress"` 属性到进度指示器元素
- [x] 3.3 在 `static/style.css` 中新增 `.kanban-qa-progress` 样式

## 4. Frontend — QA Report Clarify Card

- [x] 4.1 在 `static/messages.js` `showClarifyCard` 中新增 `kind="qa_report"` 分支：
  - `outcome="pass"` → 显示 "All 4 phases passed ✅" + 各阶段详情 + Approve 按钮
  - `outcome="fail"` → 显示失败阶段详情（红色高亮）+ Acknowledge 按钮
- [x] 4.2 在 `static/style.css` 新增 `.clarify-qa-report-card` 样式

## 5. Testing

- [x] 5.1 新增 `tests/test_m5_qa_spawn.py`：测试 `in_review` 转换自动创建 QA 子任务，验证 workspace_path 继承、link 关系、assignee
- [x] 5.2 测试 QA result 更新后 clarify 提交（全 pass → qa_report+pass；有 fail → qa_report+fail + parent blocked）
- [x] 5.3 测试 qa_report approve 后 parent 任务 done
- [x] 5.4 运行全量测试 `pytest tests/` 并修复所有失败