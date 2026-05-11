## 背景

Cron 系统（`cron.jobs`）已有完整的调度/执行/输出机制，但结果只存在 cron log 中——无法自动转化为可追踪的 kanban 任务。MCP server（`mcp_server.py`）已有 session/project CRUD 工具，但 kanban 操作需要用户手动通过 WebUI。`done` 状态的任务直接归档，无人工确认代码是否可以合并到主分支。

## 目标 / 非目标

**目标：**
- Cron config 新增 `on_success_create_task` / `on_failure_create_task` 字段
- Cron 完成后自动调用 kanban `create_task`，标记 `cron_run_id` 和成功/失败 tag
- 4 个 MCP kanban 工具：create_task、list_tasks、update_task_status、get_task
- Release gate：task `done` → clarify(`kind="release_gate"`) → approve → `git merge` + `worktree_remove` → archive
- 前端 release gate clarify 卡片

**非目标：**
- Cron 调度器改造（保持 hermes_cli `cron.jobs` 不变）
- 多分支合并策略（只支持 `git merge <branch>` 到当前 HEAD）
- 自动化 CI/CD pipeline（M6 是人工 gate，不是 auto-deploy）

## 设计决策

### D1：Cron-to-Kanban 通过 cron 完成回调实现

**原因：** `api/routes.py` 中 `_handle_cron_output` 已被 cron runner 调用。在该回调中读取 job config 的新字段，若配置了 `on_success_create_task`（或 `on_failure_create_task`），则内部调用 `_create_task_payload` 创建任务。复用现有 kanban CRUD，无需新的触发机制。

### D2：MCP 工具复用 kanban_bridge 内部函数

**原因：** `mcp_server.py` 已有 `_api_post` 模式（写操作通过 HTTP API + 密码认证）。kanban MCP 工具同样通过 `_api_post("/api/kanban/tasks", {...})` 实现，确保权限和验证与浏览器一致。读操作（list_tasks）可直接使用 hermes_cli.kanban_db。

### D3：Release gate 在 `_patch_task` 的 `done` 分支中触发

**原因：** 与 M5 的 QA spawn 在 `in_review` 分支触发模式一致。当 `complete_task` 成功后，检查任务是否有 `workspace_path`（表示有待合并的 worktree），若有则提交 `kind="release_gate"` clarify 而不是直接归档。

### D4：Merge 操作通过 `subprocess.run(['git', 'merge', branch])` 执行

**原因：** 与 M1 worktree API 模式一致（通过 subprocess 执行 git CLI）。在主 workspace 目录执行 `git merge <worktree_branch>` —— worktree 的分支名存储在 `workspace_path` 的 basename 中（与 `create_worktree` 的命名约定一致）。

### D5：Agent memory/skills namespace 通过 profile home 路径隔离

**原因：** 每个 role profile 已有独立的 `~/.hermes/profiles/<name>/` 目录。Memory 存在 `memories/` 子目录，skills 存在 `skills/` 子目录。M6 不需要新的隔离机制——只需确保 agent session 在正确的 profile home 下运行（已由 M2 profile switching 保证）。

## 风险 / 权衡

- **[Merge 冲突]** → 缓解：`git merge` 失败时返回错误并将任务设为 `blocked`（`{"error": "merge conflict"}`），需人工解决。
- **[Cron 回调中 kanban 不可用]** → 缓解：cron 回调中的 kanban 调用包裹在 try/except 中，失败不影响 cron 本身的状态记录。
- **[MCP 工具认证]** → 缓解：MCP 工具通过 `_api_post` 使用 WebUI 密码认证，与现有 MCP session/project 工具一致。
- **[Worktree remove 失败]** → 缓解：merge 成功后 worktree remove 失败不阻塞归档——记录警告，任务仍进入 archived。

## 迁移计划

- 纯增量：cron config 新字段可选，MCP 新工具不影响现有，release gate 仅在有 workspace_path 的 done 任务上触发
- 无数据库迁移
- 部署：拉取分支，重启服务端