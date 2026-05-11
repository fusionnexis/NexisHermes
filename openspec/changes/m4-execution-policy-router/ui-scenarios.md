# UI Scenario Test Specification

## Change: m4-execution-policy-router
## Generated: 2026-05-10
## Max Scenarios: 5

## Test Infrastructure
- Framework: Playwright
- Base URL: http://127.0.0.1:8787
- Auth: 无认证（默认测试模式）
- Setup: 使用 `page.route()` 拦截 API 响应注入可控数据；路由注册在 `page.goto('/')` 之前

## Scenarios

### US-1: 执行策略路由 — Small 任务直接进入 In Progress
- **Goal**: 验证调用 Execute 后 small 任务立即变为 In Progress（无 clarify 弹出）
- **Preconditions**: Kanban board mock 含 `task_size="small"`, `status="ready"` 的任务；mock `/api/kanban/execute` 返回 `{route:"small", task:{status:"running"}}`
- **Steps**:
  1. 注入 board mock + execute mock，导航到 `/`，切换到 Kanban
  2. 点击 small 任务卡片打开详情 modal
  3. 点击 "Execute" 按钮（`[data-testid="execute-task-btn"]`）
  4. 断言：看板刷新后任务卡片出现在 "In Progress" 列；无 clarify 卡片弹出
- **Key Selectors**: `[data-testid="execute-task-btn"]`，`.kanban-column[data-status="running"]`
- **Assertions**:
  - Network: POST `/api/kanban/execute` 被调用，body.task_id 正确
  - Visual: 无 clarify/approval UI 出现

### US-2: 执行策略路由 — Medium 任务弹出 Plan clarify 卡片
- **Goal**: 验证 medium 任务 execute 后，chat 区域出现 kind="plan" 的结构化卡片
- **Preconditions**: medium 任务；mock `/api/kanban/execute` 返回 `{route:"medium", clarify_pending:true}`；mock `/api/clarify/pending` 返回 `{kind:"plan", content:"## 执行计划\n- Step 1"}`
- **Steps**:
  1. 注入 mock，切换到 Kanban
  2. 点击任务 → 点击 Execute
  3. 切换到 Chat 面板（或 clarify 弹出）
  4. 断言：clarify 卡片可见，标题含 "plan" 样式，内容 Markdown 渲染
- **Key Selectors**: `.clarify-plan-card`，`.clarify-card-content`
- **Assertions**:
  - Visual: plan 卡片可见，内容为 Markdown（`<h2>` 或 `<li>` 标签）

### US-3: Plan clarify 审批 — Approve 触发 memory write 提示
- **Goal**: 验证点击 Approve 后界面更新（toast 或状态变化）且任务进入执行
- **Preconditions**: plan clarify 卡片已显示；mock `/api/clarify/respond` 返回 200；mock `/api/memory/write` 返回 200
- **Steps**:
  1. Plan clarify 卡片已显示（state from US-2）
  2. 点击 "Approve" 按钮
  3. 断言：成功 toast 出现；clarify 卡片消失；看板任务状态更新为 In Progress
- **Key Selectors**: `.clarify-approve-btn`，`.toast`
- **Assertions**:
  - Network: POST `/api/clarify/respond` 被调用，`body.response == "approve"`
  - Network: POST `/api/memory/write` 被调用

### US-4: Plan clarify 审批 — Reject 将任务退回 Planned
- **Goal**: 验证点击 Reject 后任务退回 Planned 状态
- **Preconditions**: plan clarify 卡片已显示；mock `/api/clarify/respond` 返回 200；mock PATCH task 返回 todo 状态
- **Steps**:
  1. Plan clarify 卡片可见
  2. 点击 "Reject" 按钮
  3. 断言：clarify 卡片消失；看板任务卡片出现在 "Planned" 列
- **Key Selectors**: `.clarify-reject-btn`
- **Assertions**:
  - Network: POST `/api/clarify/respond` 被调用，`body.response == "reject"`
  - Visual: 任务在 Planned 列可见

### US-5: Large 任务多阶段 clarify — Phase 标题显示
- **Goal**: 验证 large 任务 execute 后，出现带 phase 标题的 proposal clarify 卡片
- **Preconditions**: large 任务；mock `/api/clarify/pending` 返回 `{kind:"proposal", phase:1, phase_label:"Design Review", content:"# Design\n..."}`
- **Steps**:
  1. 注入 mock，切换到 Kanban
  2. 点击 large 任务 → Execute
  3. 断言：proposal 卡片可见，标题显示 "Phase 1: Design Review"
- **Key Selectors**: `.clarify-proposal-card`，`.clarify-phase-label`
- **Assertions**:
  - Text: 卡片标题包含 "Phase 1" 和 "Design Review"
  - Visual: Approve/Reject 按钮均可见

## Notes
- 所有场景路由注册在 `page.goto('/')` 之前（避免 baseURL 初始化顺序问题）
- Playwright 测试文件：`e2e/m4-execution-policy-router.spec.ts`
- Execute 按钮 `[data-testid="execute-task-btn"]` 需在实现中加入到任务详情 modal
- clarify 卡片渲染在 `static/messages.js` 中，需确保 data-testid 属性已加入