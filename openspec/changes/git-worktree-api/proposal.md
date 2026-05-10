## Why（动机）

当前 Hermes 的多个 agent 在同一个 workspace 目录下执行任务，并发 agent 会互相覆盖文件。Kanban 任务模型中已有 `workspace_kind` 和 `workspace_path` 字段，但始终默认为 `"scratch"` 和 `None`，从未被实际填充。Git worktree 隔离是多 agent 并行执行的底层基础能力——每个 agent 任务拥有独立分支和目录，避免文件冲突。

## What Changes（变更内容）

- 新增 `/api/worktree/create` — 创建隔离的 git worktree，基于 base ref 新建分支；返回 `{worktree_id, path, branch}`
- 新增 `/api/worktree/list` — 列出当前 session workspace 下的所有 worktree
- 新增 `/api/worktree/remove` — 移除 worktree 并清理分支
- Kanban 任务 claim 时填充 `workspace_kind="worktree"` 和 `workspace_path`，将 worktree 路径绑定到任务
- 新增 MCP worktree 工具（`worktree_create`、`worktree_list`、`worktree_remove`），供外部 agent 客户端调用
- Kanban 任务卡片前端显示 worktree 状态标识

```mermaid
flowchart LR
    CLAIM["任务被认领"] --> CREATE["/api/worktree/create"]
    CREATE --> WT["git worktree add -b task-N"]
    WT --> BIND["Task workspace_path = wt_path"]
    BIND --> EXEC["Agent 在 worktree 中执行"]
    EXEC --> DONE["任务完成"]
    DONE --> REMOVE["/api/worktree/remove"]
    REMOVE --> CLEAN["git worktree remove"]
```

## Capabilities（能力清单）

### New Capabilities（新增能力）
- `worktree-api`：REST API 端点，支持 git worktree 的创建、列表、移除与分支隔离
- `worktree-mcp`：MCP 工具面，对外部 agent 客户端暴露 worktree CRUD 操作
- `worktree-kanban-binding`：集成层，在任务认领时将 worktree 路径绑定到 kanban 任务，完成时自动清理

### Modified Capabilities（修改能力）
- （无 — 这是项目的首个 openspec change）

## Impact（影响范围）

- **新增文件**：`api/worktree.py`（worktree CRUD 函数）
- **后端修改**：`api/routes.py`（3 个新端点）、`api/kanban_bridge.py`（任务 claim 绑定逻辑）、`mcp_server.py`（3 个新 MCP 工具）
- **前端修改**：`static/panels.js`（kanban 任务卡片中的 worktree 状态标识）
- **依赖**：要求服务器主机可用 `git` CLI；通过 `subprocess.run` 执行 `git worktree add/remove/list`
- **无 breaking change** — kanban 任务模型中 `workspace_kind` 字段已存在，新增 `"worktree"` 值为增量变更而非替换