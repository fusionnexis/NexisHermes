## 背景

当前认领流程：UI 用户点击任务 → 调 `kb.claim_task()` 进入 `running` → worktree 和 session 需手动另行创建，无自动绑定。Dispatcher (`kb.dispatch_once`) 不过滤角色，任何 profile 都可认领任何任务。DAG 父子依赖存储在 `task_links` 表，但 WebUI 层未在状态变更时强制检查。Session 模型已有 `role` 和 `workspace` 字段（M2 成果），worktree API 已完备（M1 成果）。

## 目标 / 非目标

**目标：**
- `POST /api/kanban/claim` 端点：单次调用完成 worktree 创建 + session 创建 + 双向绑定 + 任务进入 `running`
- Session.`kanban_task_id` 反向绑定字段
- Dispatch 端点新增可选 `role` 参数，按 `profile/role` 格式过滤 `assignee`
- DAG 强制：PATCH `status=ready` 时若父任务存在未完成则返回 400
- 前端看板：任务卡片有绑定 session 时显示 session badge；Claim 按钮

**非目标：**
- 执行策略路由（small/medium/large）— 属于 M4
- QA agent 自动 spawn — 属于 M5
- 后台 agent 自动调度执行 — 仅绑定，不执行

## 设计决策

### D1：`/api/kanban/claim` 作为独立端点而非扩展 PATCH

**原因：** Claim 是原子多步操作（worktree + session + 任务状态），用独立 POST 端点更清晰，避免 PATCH handler 膨胀。参考 `worktree/create` 和 `session/new` 的已有模式。

**替代方案：** 在 PATCH `status=running` 时触发 — 被否决，因为 PATCH running 被 kanban_bridge 明确拒绝（dispatcher/claim 路径专用），不应在此添加副作用。

### D2：`assignee` 格式采用 `{profile}/{role}`

**原因：** 区分不同 profile 的同角色 agent（如两个 coder profile）。格式 `{profile}/{role}` 可从任务的 `assignee` 字段直接解析出角色，无需额外查表。Dispatch 的 role filter 对 `assignee` 做后缀匹配（`/{role}`）。

**替代方案：** 独立 `role` 字段加在任务上 — 被否决，`assignee` 已有语义，profile/role 格式向下兼容（不含 `/` 的旧值视为纯 profile 名称）。

### D3：Claim 中 worktree 创建为可选

**原因：** planner 任务无需 worktree（不写代码），review 任务可复用 coder 任务的 worktree。Claim 端点接受 `create_worktree: bool`（默认 true for coder/qa/reviewer，false for planner）。

### D4：DAG 检查在 kanban_bridge `_patch_task` 而非 hermes_cli

**原因：** 与 M2 状态转换验证同层（`_STATUS_TRANSITION_RULES`）。`kb.parent_ids(conn, task_id)` 已可用，在转 `ready` 时查父任务状态即可。父任务未 `done` 时返回 `ValueError`，bridge 转为 HTTP 400。

### D5：Session badge 在前端任务卡片 topline

**原因：** 与 worktree badge 对齐（同样挂在 topline），显示格式 `🔗 {session_id[:6]}`，点击跳转到该 session（复用现有 `loadSession` 函数）。

## 风险 / 权衡

- **[claim 并发竞争]** → `kb.claim_task()` 已有 `claim_lock`/`claim_expires` 机制，并发 claim 同一任务时数据库层有保障；WebUI claim 端点在此基础上构建，失败时返回 409。
- **[worktree 创建失败但任务已进入 running]** → claim 端点采用"try-worktree-first"顺序：worktree 失败直接 400，不改变任务状态；只有 worktree 成功后才执行 `kb.claim_task()`。
- **[assignee 格式兼容性]** → `/{role}` 后缀匹配对旧格式无影响；role filter 仅在传入 `role` 参数时激活，不传则 dispatch 行为完全不变。
- **[DAG 检查性能]** → `parent_ids()` 查 `task_links` 表，通常父任务数 < 10，单次 SELECT 开销可忽略。

## 迁移计划

- 纯增量：新增端点、新增 Session 字段（默认 null）、dispatch 新增可选参数
- Session JSON 文件增量变更：`kanban_task_id` 缺失时 API 返回 null
- 部署：拉取分支，重启服务端；kanban_db `task_links` 表已存在（M1 前已有）
- 回滚：移除分支重启；现有 dispatch 不受影响