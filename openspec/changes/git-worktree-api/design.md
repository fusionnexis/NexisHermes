## 背景

Hermes 的多个 agent 当前在同一个 workspace 目录下执行任务，并发 agent 会互相覆盖文件。Kanban 任务模型中已有 `workspace_kind` 和 `workspace_path` 字段，但默认值为 `"scratch"` 和 `None`。系统目前没有创建隔离 git worktree 的机制。服务端使用 Python 标准库（`http.server`）配合 `routes.py` 中的过程式路由，通过 `subprocess.run` 执行 git 操作（`workspace.py`），MCP 工具通过 `mcp_server.py` 中的 `TOOLS`/`HANDLERS` 字典注册。

## 目标 / 非目标

**目标：**
- 通过 REST API 端点（`/api/worktree/*`）实现 git worktree 的创建、列表、移除
- 任务认领时绑定 worktree 路径（填充 `workspace_kind` 和 `workspace_path`）
- 将 worktree CRUD 暴露为 MCP 工具，供外部 agent 客户端调用
- 在 kanban 任务卡片中显示 worktree 状态（前端）

**非目标：**
- 合并流程（属于 M6 — 发布门控）
- Agent 角色路由（属于 M3）
- DAG 依赖执行（属于 M3）
- 任务派发时自动创建 worktree（推迟到 M3，届时 binding 才会实现）

## 设计决策

### D1：通过 subprocess 使用 `git worktree` CLI（而非 libgit2）

**原因：** Hermes 已在 `api/workspace.py` 中通过 `subprocess.run` 执行 git 操作（`_run_git` 辅助函数）。引入 `libgit2` 会新增外部依赖，违反"最小依赖"原则（目前仅依赖 `pyyaml`）。git CLI 在 Hermes 运行的服务器主机上普遍可用。

**已考虑的替代方案：** `pygit2`/`libgit2` 绑定 — 被否决，因为是 C 依赖，需要编译，违反"无构建步骤"理念。

### D2：Worktree CRUD 作为独立模块 `api/worktree.py`

**原因：** 遵循现有模式——每个领域有独立模块（kanban → `kanban_bridge.py`，workspace → `workspace.py`，terminal → `terminal.py`）。Worktree 操作与通用 workspace 文件浏览不同，应有独立模块。`worktree.py` 模块复用 `workspace.py` 的 `_run_git` 模式，但添加 worktree 特有逻辑。

### D3：Worktree ID 使用人类可读名称，而非 UUID

**原因：** Git worktree 目录通过路径标识，分支通过名称标识。使用 kanban 任务 ID 作为 worktree 分支前缀（如 `task-{task_id}`）形成自然映射。避免额外映射表，状态保存在 git 本身。

**已考虑的替代方案：** UUID 为基础的 worktree ID + 状态文件 — 被否决，因为 git 已在 `.git/worktrees/` 中跟踪 worktree，无需额外状态文件。

### D4：任务创建/认领时通过 PATCH 绑定，而非自动派发

**原因：** M1 中，绑定发生在用户显式认领任务或创建带 `workspace_kind="worktree"` 的任务时。自动创建 worktree（认领 `ready` 任务并自动创建 worktree）推迟到 M3，届时任务到执行的绑定才会实现。M1 提供基础能力；M3 将其接入派发流程。

### D5：MCP 工具的写操作使用 `_api_post`

**原因：** 遵循现有 MCP 模式——写操作通过本地 HTTP API（密码认证）执行，读操作直接访问文件系统。确保所有写操作与浏览器发起的请求经过相同的验证/授权路径。

## 风险 / 权衡

- **[主机上 git 不可用]** → 优雅降级：`_run_git` 失败时返回 `None`。Worktree 端点返回 `{"error": "git not available or not a git repo"}`（503 状态）。MCP 工具返回错误字典。不会崩溃。
- **[Worktree 目录清理竞争]** → `worktree_remove` 在检查 worktree 存在后调用 `git worktree remove --force`。若其他进程先移除，命令优雅失败，返回 `{"error": "worktree not found"}`。
- **[同一分支上并发创建 worktree]** → `git worktree add` 在分支已存在时失败。返回 git 错误消息作为 409 Conflict 响应。
- **[未清理的 worktree 导致磁盘空间耗尽]** → 缓解：`worktree/list` 端点返回 worktree 路径和大小，可用于监控。未来可通过 cron 任务（M6）自动清理过期 worktree。
- **[非 git workspace 上执行 worktree 操作]** → 前置检查：所有端点在执行操作前验证 workspace 是否为 git 仓库。非 git 仓库返回 400。

## 迁移计划

- 无需迁移——纯增量变更。没有现有数据或 API 契约变更。
- Kanban 任务上的 `workspace_kind` 字段已存在，默认值为 `"scratch"`；新增 `"worktree"` 值为增量变更。
- 部署：拉取分支并重启服务端——无需配置变更。
- 回滚：移除分支，重启服务端。无持久状态变更。