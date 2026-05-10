## 背景

Hermes 平台当前没有 agent 角色概念——Session 模型仅有 `profile` 字段表示配置分组，无角色语义。Kanban 任务生命周期仅有 6 个状态列，无法区分"agent 完成开发"和"QA 验证通过"等阶段。服务端使用 Python stdlib，Session 模型定义在 `api/models.py`，kanban 状态列硬编码在 `api/kanban_bridge.py` 的 `BOARD_COLUMNS` 常量，profile 配置通过 `api/profiles.py` 管理（每个 profile 对应 `~/.hermes/profiles/<name>/` 目录，包含独立的 config.yaml、.env、SOUL.md、sessions、skills、memory）。前端 `static/panels.js` 现有 6 列渲染逻辑。

## 目标 / 非目标


**目标：**
- **Role 作为 Profile 的一等属性**：`config.yaml` 新增 `role` 键（coder/qa/planner/reviewer），Session 的 role 字段派生自创建时的 active profile
- 提供 init 脚本，一键创建 4 个角色 profile（coder/qa/planner/reviewer），各自配置专属 SOUL.md、skills 列表
- Kanban 任务新增 `task_size` 字段（small/medium/large）
- BOARD_COLUMNS 从 6 列扩展到 9 列（新增 in_review、qa_verify、release_ready）
- 状态转换有验证规则
- 前端 kanban 看板渲染 9 列布局 + 角色徽章（在 Profile 面板和 Session 侧边栏显示）

**非目标：**
- 角色派发/路由（属于 M3）
- 任务到 Session 绑定（属于 M3）
- 执行策略路由（属于 M4）
- QA 管线自动 spawn（属于 M5）
- Cron 到 kanban 桥接（属于 M6）

## 设计决策

### D1：Role 是 Profile 的属性，而非 Session 的独立字段

**原因：** Profile 已经是 Hermes 的 agent 身份隔离容器——每个 profile 有独立的 `~/.hermes/profiles/<name>/` 目录，包含独立的 SOUL.md（人设 prompt）、skills（工具集）、memory、sessions 和 .env（密钥）。将 `role` 放在 profile `config.yaml` 中意味着"使用 qa profile 的 agent 天然就是 QA 角色"，无需在每次 Session 创建时手动指定。Session 上的 `role` 字段仅是从创建时 active profile 的 config.yaml 继承的快照，用于 M3 派发时的过滤。

```
~/.hermes/profiles/
├── coder/        # role: coder, SOUL.md: 资深工程师人设, skills: code-review
├── qa/           # role: qa,    SOUL.md: QA工程师人设,  skills: api-testing
├── planner/      # role: planner, SOUL.md: 技术负责人人设, skills: openspec
└── reviewer/     # role: reviewer, SOUL.md: 代码审查人设, skills: security-review
```

**已考虑的替代方案：** Session 上的自由 `role` 字段（用户在创建 session 时手动填写）——被否决，因为角色应该和 agent 的人设、工具集绑定，这些都在 profile 层面；手动填写缺乏约束且会产生不一致。

### D2：Init 脚本而非自动初始化

**原因：** Profile 创建是有副作用的操作（写磁盘目录），不适合放在服务启动流程中（违反"无副作用启动"原则）。由管理员运行 init 脚本，一次性创建 4 个角色 profile，并幂等（已存在的 profile 跳过）。脚本放在 `scripts/hermes/init_role_profiles.py`，通过 WebUI HTTP API 调用 `/api/profiles/create`，确保所有权限和目录结构与 WebUI 保持一致。

### D3：`task_size` 作为 kanban 任务字段而非独立枚举

**原因：** `task_size` 是任务的属性，与 `priority`、`tenant` 等字段同层级。值域固定（small/medium/large），直接作为任务模型字段存储在 kanban DB 中，与 `workspace_kind` 模式一致。

**已考虑的替代方案：** 通过 `tenant` 字段间接表达 size——被否决，因为 tenant 是组织分组，size 是执行策略维度，两者语义不同。

### D4：BOARD_COLUMNS 扩展为 9 列，但保留向后兼容

**原因：** 新增 3 列（in_review、qa_verify、release_ready）是多 agent 协作流水线的基础。但 kanban_db 的 `status` 字段是自由文本，数据库层无需迁移。Breaking change 仅在 API 层面——返回的列名增加，前端需适配渲染。对仅使用前 6 列的外部客户端，新增列的数据默认为空数组，不影响现有逻辑。

### D5：状态转换验证在 kanban_bridge.py 而非 hermes_cli.kanban_db

**原因：** hermes_cli.kanban_db 是独立库（Hermes Agent 项目），WebUI 不应修改其内部状态机。验证在 WebUI 的 kanban_bridge.py 层面执行——PATCH 端点校验转换合法性，非法转换返回 400。这遵循现有模式（`_validate_status` 和 `_set_status_direct` 已在 bridge 中）。

### D6：角色徽章在 Profile 面板和侧边栏，CSS 类实现

**原因：** Hermes 前端是 vanilla JS，无组件框架。角色徽章是小型标识元素（类似现有 `kanban-badge`），用 CSS 类 + 内联 HTML 即可实现。展示位置：Profile 卡片 + Session 侧边栏条目中（当 role ≠ coder 时显示）。颜色：coder=蓝色、qa=绿色、planner=紫色、reviewer=橙色。

## 风险 / 权衡

- **[Profile 未初始化]** → 缓解：角色 profile 需手动运行 init 脚本创建。服务启动时不强依赖特定 profile 存在——`role` 从 profile config.yaml 读取，缺失时默认 `"coder"`，服务不崩溃。
- **[BOARD_COLUMNS breaking change]** → 缓解：新增列默认为空数组，不影响 6 列客户端。迁移时无需数据变更，仅扩展常量。
- **[hermes_cli.kanban_db 不支持新 status 值]** → 缓解：kanban_db 的 status 字段是自由文本，新值被存储。WebUI 层面做转换验证。
- **[9 列看板 UI 宽度溢出]** → 缓解：`.kanban-columns` 已有横向滚动，9 列（~1620px）在标准屏幕可滚动查看。
- **[Role skills 配置与 hermes_cli skills_tool 路径不一致]** → 缓解：init 脚本在 profile 的 `skills/` 目录中写入 skill 条目，与 `register_local_skills.py` 模式一致。

## 迁移计划

1. **初始化角色 profile**（一次性）：运行 `python3 scripts/hermes/init_role_profiles.py --host http://127.0.0.1:8787` 创建 coder/qa/planner/reviewer 四个 profile
2. **无数据库迁移**：kanban_db 的 `status` 字段是自由文本；`task_size` 作为新列增量添加
3. **Session JSON 增量变更**：旧 Session 缺失 `role` 字段时 API 返回默认 `"coder"`
4. **部署**：拉取分支，重启服务端，运行 init 脚本
5. **回滚**：将 BOARD_COLUMNS 还原为 6 列，重启服务端；`task_size` 和 `role` 字段不影响现有逻辑