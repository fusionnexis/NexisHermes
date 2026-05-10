# UI Scenario Test Specification

## Change: m3-task-execution-binding
## Generated: 2026-05-10
## Max Scenarios: 5

## Test Infrastructure
- Framework: Playwright
- Base URL: http://127.0.0.1:8787
- Auth: 无认证（默认测试模式）
- Setup: 使用 `page.route()` 拦截 API 响应注入可控数据；dev server 运行中

## Scenarios

### US-1: 任务详情面板显示 Claim Task 按钮
- **Goal**: 验证 `ready` 状态的任务详情面板有 "Claim Task" 按钮
- **Preconditions**: Kanban board mock 含一个 `status=ready` 的任务；任务详情 API mock 返回相同任务
- **Steps**:
  1. 注入 board mock（含 ready 任务），导航到 `/`，切换到 Kanban 面板
  2. 点击 ready 任务卡片打开详情
  3. 断言：`.kanban-task-preview-body` 或 `.kanban-status-actions` 区域内有文本 "Claim Task" 的按钮可见
- **Key Selectors**: `button` with text "Claim Task"；`#kanbanTaskPreview`
- **Assertions**:
  - Visual: "Claim Task" 按钮可见
  - State: 按钮仅在 ready 状态显示

### US-2: 非 ready 状态任务不显示 Claim 按钮
- **Goal**: 验证 `triage`/`todo`/`running`/`done` 任务不显示 Claim 按钮
- **Preconditions**: Kanban board mock 含 `status=running` 任务
- **Steps**:
  1. 注入 board mock（running 任务），导航，切换到 Kanban
  2. 点击 running 任务卡片
  3. 断言：任务详情中不存在 "Claim Task" 按钮
- **Key Selectors**: `#kanbanTaskPreview button`
- **Assertions**:
  - Count: "Claim Task" 按钮数量为 0

### US-3: Session badge 在绑定 session 的任务卡片上显示
- **Goal**: 验证 `session_id` 不为 null 的任务卡片显示 session badge（🔗 + 前6位）
- **Preconditions**: Kanban board mock 含 `session_id="abc123def456"` 的任务
- **Steps**:
  1. 注入 board mock，导航，切换到 Kanban
  2. 等待卡片渲染
  3. 断言：卡片 topline 含 `[data-testid="session-badge"]`，文本为 "🔗 abc123"
- **Key Selectors**: `.kanban-card[data-kanban-task-id] [data-testid="session-badge"]`
- **Assertions**:
  - Visual: session badge 可见
  - Text: badge 显示 session_id 前 6 位

### US-4: 无 session 绑定的任务卡片无 session badge
- **Goal**: 验证 `session_id=null` 的任务卡片不显示 session badge
- **Preconditions**: Kanban board mock 含 `session_id=null` 的任务
- **Steps**:
  1. 注入 board mock（session_id: null），切换到 Kanban
  2. 定位对应任务卡片
  3. 断言：卡片内无 `[data-testid="session-badge"]`
- **Key Selectors**: `[data-testid="session-badge"]`
- **Assertions**:
  - Count: session badge 数量为 0

### US-5: 点击 Claim Task 触发 POST /api/kanban/claim 并刷新看板
- **Goal**: 验证点击 Claim Task 按钮发起 claim 请求，成功后看板刷新显示任务 running
- **Preconditions**: Board mock 含 ready 任务；`/api/kanban/claim` 被 mock 返回成功
- **Steps**:
  1. 注入 board mock（ready 任务），mock `/api/kanban/claim` 返回 `{task: {status: "running"}, session: {...}}`
  2. 切换到 Kanban，点击任务卡片打开详情
  3. 点击 "Claim Task" 按钮
  4. 拦截 POST `/api/kanban/claim` — 验证请求体含 `task_id`
  5. 断言：看板刷新（`/api/kanban/board` 被重新请求），toast 或状态更新出现
- **Key Selectors**: `button` with text "Claim Task"；`[data-testid="session-badge"]`（刷新后）
- **Assertions**:
  - Network: POST `/api/kanban/claim` 被调用，body.task_id 正确
  - Visual: 成功后无错误 toast

## Notes
- US-5 使用 `page.route()` 同时 mock board API 和 claim API，验证 network 请求用 `page.waitForRequest`
- Playwright 测试文件：`e2e/m3-task-execution-binding.spec.ts`
- 所有场景路由注册在 `page.goto('/')` 之前（避免 baseURL 初始化顺序问题）