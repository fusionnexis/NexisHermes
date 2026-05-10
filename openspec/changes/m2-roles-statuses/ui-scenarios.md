# UI Scenario Test Specification

## Change: m2-roles-statuses
## Generated: 2026-05-10
## Max Scenarios: 5

## Test Infrastructure
- Framework: Playwright
- Base URL: http://127.0.0.1:8787 (dev server default)
- Auth: 无认证（默认测试模式）
- Setup: 测试服务器运行，kanban board 有测试任务数据；使用 `page.route()` 拦截 API 响应以注入可控数据

## Scenarios

### US-1: 9 列看板渲染完整
- **Goal**: 验证看板面板渲染全部 9 列，新增列（In Review、QA Verify、Release Ready）标题可见
- **Preconditions**: Kanban board API 返回 9 列（可通过 route 拦截注入）
- **Steps**:
  1. 导航到 `/`，切换到 Kanban 面板
  2. 等待看板渲染
  3. 断言：看板中存在列标题 "In Review"、"QA Verify"、"Release Ready"
- **Key Selectors**: `.kanban-column-header`，通过文本定位
- **Assertions**:
  - Visual: 3 个新列标题均可见
  - State: 列顺序为 running → in_review → qa_verify → blocked → release_ready → done

### US-2: in_review 列中任务卡片展示
- **Goal**: 验证 `status="in_review"` 的任务卡片出现在 "In Review" 列下
- **Preconditions**: Kanban API 返回一个 `status="in_review"` 的任务
- **Steps**:
  1. 导航到 `/`，切换到 Kanban 面板，注入含 in_review 任务的 board mock
  2. 等待看板渲染
  3. 定位 "In Review" 列，断言其中包含目标任务卡片
- **Key Selectors**: `.kanban-card[data-kanban-task-id="<id>"]`，列容器通过 header 文本定位
- **Assertions**:
  - Visual: 任务卡片在 "In Review" 列下可见
  - Text: 卡片标题与任务 title 匹配

### US-3: task_size badge 在任务卡片上展示
- **Goal**: 验证有 task_size 的任务卡片显示正确的 size badge（S/M/L），无 size 的卡片不显示
- **Preconditions**: Kanban board 中有 task_size="medium" 的任务和 task_size=null 的任务
- **Steps**:
  1. 注入 board mock，含 medium 和 null size 的任务
  2. 切换到 Kanban 面板，等待渲染
  3. 断言 medium 任务卡片含 "M" badge
  4. 断言 null size 任务卡片不含任何 size badge
- **Key Selectors**: `.kanban-card .kanban-badge.size`，`[data-testid="size-badge"]`
- **Assertions**:
  - Text: medium 卡片 badge 文本为 "M"
  - Count: null size 卡片中 `.kanban-badge.size` 数量为 0

### US-4: 任务创建 modal 有 Size 选择器
- **Goal**: 验证新建任务 modal 中存在 Size 下拉选择器，切换选项不报错，提交时传递 task_size
- **Preconditions**: 看板面板可见，新建任务按钮可点击
- **Steps**:
  1. 切换到 Kanban 面板，点击新建任务按钮
  2. 等待 modal 出现
  3. 断言 `#kanbanTaskModalSize` 选择器可见，默认值为空（无 size）
  4. 选择 "Medium"，断言选项值变更
  5. （可选）拦截 POST `/api/kanban/tasks`，验证请求体含 `task_size: "medium"`
- **Key Selectors**: `#kanbanTaskModal`，`#kanbanTaskModalSize`
- **Assertions**:
  - Visual: Size 下拉选择器在 modal 中可见
  - Value: 选择 "Medium" 后，select 的值为 "medium"

### US-5: QA session 侧边栏显示角色徽章
- **Goal**: 验证 role="qa" 的 session 在侧边栏显示绿色 "qa" 徽章；role="coder" 的不显示
- **Preconditions**: Session 列表 API 返回含 role 字段的 sessions；通过 route 拦截注入
- **Steps**:
  1. 拦截 `/api/sessions`，注入 `[{role:"qa", ...}, {role:"coder", ...}]`
  2. 导航到 `/`，等待侧边栏 session 列表渲染
  3. 断言 qa session 条目中存在 `.session-role-badge` 且文本为 "qa"
  4. 断言 coder session 条目中不存在 `.session-role-badge`
- **Key Selectors**: `.session-role-badge`，session 列表条目容器
- **Assertions**:
  - Visual: qa session 的角色徽章可见
  - Text: 徽章文本为 "qa"
  - Count: coder session 条目中 `.session-role-badge` 数量为 0

## Notes
- 所有场景均通过 `page.route()` 拦截 API 响应注入可控数据，不依赖真实 hermes_cli 运行
- US-1 和 US-2 测试新增列渲染，需确保 `_kanbanColumnLabel()` 和列渲染代码已适配新状态名
- US-3 需要 `data-testid="size-badge"` 属性加在 size badge 元素上（实现时添加）
- US-5 需要 `_allSessions` 前端全局变量通过 sessions API 获取；route 拦截需覆盖 `/api/sessions` 端点