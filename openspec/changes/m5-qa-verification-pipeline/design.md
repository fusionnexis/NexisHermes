## 背景

当前 `_patch_task` 中 `in_review` 分支仅通过 `_set_status_direct` 更新状态，无副作用。M3 的 `claim_task_with_binding` 支持 `parent_session_id` 但未被使用。M4 的 `structured-clarify` 支持 `kind` 字段但仅有 `text/plan/proposal` 三种，需增加 `qa_report`。QA profile（M2 init 脚本创建）已就绪但无专用管线逻辑。

## 目标 / 非目标

**目标：**
- `in_review` 转换时自动创建 QA 子任务（`qa_verify` 状态）
- QA 子任务继承 coder 任务的 `workspace_path`、`tenant`
- QA pipeline 4 阶段：Integration → API → E2E → Security，结果存储在 `result` 字段（JSON）
- 全通过 → clarify(`kind=qa_report`, pass) → 人工确认 → 父任务 `done`
- 失败 → clarify(`kind=qa_report`, fail) → 父任务 `blocked`
- 前端 QA 进度指示器

**非目标：**
- QA agent 自动执行测试代码（M5 只建立管线框架，agent 的实际测试执行在运行时由 agent runtime 处理）
- 自动修复失败（coder 重新修复是手动流程）
- Release gate 合并（属于 M6）

## 设计决策

### D1：QA spawn 在 `_patch_task` 的 `in_review` 分支中触发

**原因：** `in_review` 是唯一合法的入口——按 `_STATUS_TRANSITION_RULES`，`in_review` 仅从 `running` 转入。在此分支的 `_set_status_direct` 成功后插入 QA 任务创建逻辑，保持原子性（状态更新 + spawn 在同一 connection 内）。

### D2：QA 子任务通过 `kb.link_tasks` + `kb.create_task` 创建

**原因：** 复用现有 kanban_db API（`create_task` + `link_tasks`），不引入新的数据结构。QA 任务是普通 kanban 任务，特殊之处仅在于：① `workspace_path` 继承 ② `assignee` 设为 QA profile ③ `status` 初始为 `qa_verify`。

### D3：Pipeline 阶段跟踪存储在 `result` JSON 字段

**原因：** `result` 字段已存在于 kanban 任务（`complete_task` 设置），类型为自由文本。将 QA 结果存储为 JSON 字符串：`{"phases": [{"name": "IT", "status": "pass"}, {"name": "API", "status": "fail", "detail": "..."}]}`。不需要新增数据库列。

### D4：QA 进度指示器在 kanban 卡片 meta 行

**原因：** 与 worktree badge、size badge 同层。显示为 `✅✅❌⬜`（4 个圆点/勾/叉表示 4 阶段状态）。从 `result` JSON 解析阶段状态。

### D5：`kind="qa_report"` clarify 复用 M4 结构化渲染

**原因：** `qa_report` 与 `plan/proposal` 类似——都是结构化文档需要人工审批。前端渲染为通过/失败摘要 + 各阶段详情折叠。

## 风险 / 权衡

- **[QA 任务与 coder 任务并发写同一 worktree]** → 缓解：QA 只读执行测试，不修改代码。若 coder 在 QA 期间提交修改，QA 任务的 `workspace_path` 仍指向同一 worktree 目录。
- **[QA spawn 失败]** → 缓解：spawn 在 `_set_status_direct` 成功后执行。如果 `create_task` 失败（如 DB 锁），`in_review` 状态仍然已设置——QA 任务可由管理员手动创建。记录错误日志。
- **[result 字段超长]** → 缓解：QA 结果 JSON 中 `detail` 字段限制为前 2000 字符（截断），完整日志存储在 worker log 中。

## 迁移计划

- 纯增量：`in_review` 分支新增 spawn 逻辑，`kind="qa_report"` clarify 卡片
- 无数据库迁移
- 部署：拉取分支，重启服务端；旧 `in_review` 任务不受影响（仅新转入的触发 spawn）