## 1. Init Script — Role Profile Bootstrap

- [x] 1.1 新增 `scripts/hermes/init_role_profiles.py`：幂等脚本，通过 WebUI HTTP API 创建 4 个角色 profile（coder/qa/planner/reviewer）；已存在的 profile 跳过（不报错）
- [x] 1.2 每个 profile 在创建后写入角色专属 `config.yaml`（包含 `role` 键和推荐 model）和 `SOUL.md`（角色人设 prompt）
- [x] 1.3 每个 profile 注册角色专属 skills（coder: `code-review`；qa: `api-testing`, `security-review`；planner: `opsx:propose_v2`；reviewer: `security-review`, `code-review`）
- [x] 1.4 脚本支持 `--host`（默认 `http://127.0.0.1:8787`）和 `--dry-run` 参数；dry-run 时仅打印计划不执行

## 2. Backend — Profile Role Key + Session Role Derivation

- [x] 2.1 在 `api/profiles.py` 中新增 `get_profile_role(profile_name) -> str` 函数：读取 profile `config.yaml` 的 `role` 键，缺失时返回 `"coder"`
- [x] 2.2 在 `api/models.py` `Session.__init__` 中新增 `role` 参数（默认 `"coder"`），添加到实例属性和 `to_dict()` / JSON 序列化输出；合法值限定为 `coder`、`qa`、`planner`、`reviewer`
- [x] 2.3 在 `api/routes.py` `/api/session/new` 处理器中：若 body 无 `role` 字段，调用 `get_profile_role(active_profile)` 取 profile 默认角色；将最终 role 传入 Session 构造器；非法值返回 HTTP 400

## 3. Backend — Kanban Status Extensions

- [x] 3.1 在 `api/kanban_bridge.py` 中将 `BOARD_COLUMNS` 从 6 列扩展为 9 列：`["triage", "todo", "ready", "running", "in_review", "qa_verify", "blocked", "release_ready", "done"]`
- [x] 3.2 在 `api/kanban_bridge.py` `_validate_status()` 中将 `in_review`、`qa_verify`、`release_ready` 加入合法状态集合
- [x] 3.3 在 `api/kanban_bridge.py` `_patch_task()` 中新增状态转换验证：`in_review` 仅从 `running` 转入，`qa_verify` 仅从 `in_review` 转入，`release_ready` 仅从 `qa_verify` 转入；违规返回 `ValueError`
- [x] 3.4 在 `api/kanban_bridge.py` `_patch_task()` 中为 `in_review`、`qa_verify`、`release_ready` 新增处理分支（调用 `_set_status_direct`，类似 `triage`/`todo`）
- [x] 3.5 在 `api/kanban_bridge.py` `_create_task_payload()` 中新增 `task_size` 字段读取（`body.get("task_size")`），校验值域（small/medium/large/null），传入 `kb.create_task()`
- [x] 3.6 在 `api/kanban_bridge.py` `_patch_task()` 中支持 `task_size` 字段的 PATCH 更新

## 4. Backend — Database task_size Field

- [x] 4.1 在 `api/kanban_bridge.py` `_task_dict()` 中从任务对象提取 `task_size` 字段并加入返回字典（兼容旧数据，缺失时返回 `null`）
- [x] 4.2 如果 `hermes_cli.kanban_db.create_task()` 不支持 `task_size` 参数，在 `_create_task_payload()` 中通过 `conn.execute("UPDATE tasks SET task_size = ? WHERE id = ?")` 补充写入

## 5. Frontend — 9-Column Kanban Rendering

- [x] 5.1 在 `static/panels.js` `_kanbanColumnLabel()` 中为 `in_review`、`qa_verify`、`release_ready` 新增标签映射（"In Review"、"QA Verify"、"Release Ready"）
- [x] 5.2 在 `static/panels.js` `_kanbanRenderBoard()` 中确保 9 列都被渲染，列顺序严格按照 `BOARD_COLUMNS` 顺序
- [x] 5.3 在 `static/style.css` 中确保 `.kanban-columns` 支持水平滚动（`overflow-x: auto`），9 列布局时不换行

## 6. Frontend — task_size Badge on Task Cards

- [x] 6.1 在 `static/panels.js` `_kanbanCard()` 中当 `task.task_size` 有值时渲染 size badge（`data-testid="size-badge"`，文本 "S"/"M"/"L"），追加到卡片 topline
- [x] 6.2 在 `static/style.css` 中新增 `.kanban-badge.size` 样式，使用中性色（灰色），与 `worktree`/`priority` badge 视觉区分

## 7. Frontend — task_size in Task Modal

- [x] 7.1 在 `static/index.html` kanban 任务创建/编辑 modal 中新增 "Size" 下拉选择器（id: `kanbanTaskModalSize`），选项：（无）、Small、Medium、Large
- [x] 7.2 在 `static/panels.js` `submitKanbanTaskModal()` 中读取 `kanbanTaskModalSize` 值，写入 payload `task_size`
- [x] 7.3 在 `static/panels.js` `openKanbanEdit()` 中将 task 的 `task_size` 回填到 size 选择器

## 8. Frontend — Role Badge in Profile Panel + Session Sidebar

- [x] 8.1 在 `static/panels.js` Profile 卡片渲染处，从 profile 的 config 中读取 `role`，展示角色徽章（颜色：qa=绿色、planner=紫色、reviewer=橙色；coder 不显示）
- [x] 8.2 在 `static/ui.js` 侧边栏 session 渲染处，当 `session.role` 不为 `"coder"` 时显示角色徽章
- [x] 8.3 在 `static/style.css` 中新增 `.role-badge` 样式及各角色颜色变体（复用 `kanban-badge` 圆角样式）

## 9. Testing

- [x] 9.1 新增 `tests/test_m2_session_role.py`：测试 Session role 从 profile config 派生、合法值、非法值校验、API 响应包含 role
- [x] 9.2 新增 `tests/test_m2_kanban_statuses.py`：测试 9 列 board 响应、in_review/qa_verify/release_ready 转换规则、task_size 字段的 CRUD
- [x] 9.3 运行全量测试 `pytest tests/` 并修复所有失败