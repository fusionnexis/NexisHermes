## 背景

M3 的 `claim_task_with_binding` 是原子认领操作（worktree + session + 绑定），但没有区分任务复杂度。`task_size` 字段（M2 引入）已存在于任务上，但从未驱动执行路径。`clarify.py` 已有基础队列机制（submit/get/resolve），但只支持自由文本问答，无法表达"请审批这份执行计划"的结构化意图。`/api/memory/write` 端点已存在，但未被 clarify 流程自动调用。

## 目标 / 非目标

**目标：**
- `POST /api/kanban/execute` 作为统一执行入口，路由到 small/medium/large 三条路径
- Small 路径：直接认领执行，零摩擦
- Medium 路径：认领 → 生成计划 → clarify 审批 → 写入 memory → 执行
- Large 路径：认领 → propose_v2 提案 → 多阶段 clarify（最多 3 轮）→ 写入 memory → 执行
- `clarify.submit_pending` 支持 `kind` 字段，值域 `text`/`plan`/`proposal`
- 前端 clarify 卡片根据 `kind` 渲染不同 UI（plan: Markdown 文档；proposal: OpenSpec 摘要）
- clarify 批准时自动调用 `memory/write` 保存内容

**非目标：**
- 自动触发执行（仍需人工调用 `/api/kanban/execute` 或点击 UI 按钮）
- propose_v2 的实际 OpenSpec 内容生成（在 M4 中，large 路径的提案内容由 agent 生成，WebUI 只负责路由和审批门控）
- QA 管线（属于 M5）
- 计划内容的语义理解（WebUI 只存储/展示，不解析）

## 设计决策

### D1：`/api/kanban/execute` 作为独立端点而非扩展 claim

**原因：** claim（M3）是原子的——它只负责认领绑定，不关心任务大小或后续执行策略。execute 是更高层的编排端点，包裹 claim 并根据 size 决定后续动作。分离关注点，claim 保持单一职责。

### D2：Medium/Large 路径的"计划生成"作为占位实现

**原因：** M4 的核心是路由逻辑和 clarify 扩展，不是 agent 内部的计划生成能力。Medium/Large 路径中的"计划内容"在 M4 实现为 agent 通过 MCP 或 streaming 写入，WebUI 路由器只负责：① 认领任务 ② 将内容推入 clarify 队列 ③ 等待人工决策 ④ 写入 memory。实际计划生成属于 agent 运行时行为，通过 `kanban_task_id` 关联。

### D3：clarify `kind` 字段作为增量扩展，不修改现有 API

**原因：** 现有 clarify 调用方只传 `question` 字段，不传 `kind`。新增 `kind` 作为可选字段，默认 `"text"`，完全向后兼容。前端读取 `kind` 字段决定渲染方式；旧消息不含 `kind` 则按文本渲染。

### D4：Clarify-to-memory 在 resolve 时同步写入，不异步

**原因：** clarify 的 resolve 已经是同步操作（`_handle_clarify_respond`）。在 approve 分支内直接调用 `_handle_memory_write` 逻辑（或复用 `_memory_write` 内部函数），保持事务性——批准即保存，拒绝不保存。异步写入会引入延迟和失败处理复杂性。

### D5：Large 路径的多阶段 clarify 通过 `phase` 字段区分

**原因：** 多阶段审批（设计/提案/任务拆解）共用同一 clarify 机制，但需要区分当前是哪个阶段。`phase` 字段（1/2/3）存储在 clarify data 中，前端用于展示"Phase 1: Design Review"标题，审批后 execute 路由器递进到下一阶段。

## 风险 / 权衡

- **[Large 路径阻塞]** → 缓解：每个 clarify phase 都有超时（`DEFAULT_TIMEOUT_SECONDS=120`），超时后路由器将任务退回 `planned` 并记录原因。
- **[Memory write 失败]** → 缓解：memory write 失败不阻塞任务执行——记录 toast 警告，任务仍进入执行。计划内容在 clarify 历史中仍有保存。
- **[agent 无法在 M4 时间窗口内生成计划]** → 缓解：execute 端点的 medium/large 路径在 M4 中实现为"提交占位计划 + clarify 流程"。agent 计划生成能力在 M5/M6 迭代中增强。

## 迁移计划

- 纯增量：新增 `/api/kanban/execute` 端点，`clarify.kind` 可选字段，messages.js 新增渲染分支
- 无数据库迁移
- 部署：拉取分支，重启服务端；旧 clarify 调用不受影响