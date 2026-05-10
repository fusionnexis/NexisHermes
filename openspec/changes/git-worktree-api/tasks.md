## 1. Backend - Worktree CRUD Module

- [x] 1.1 Create `api/worktree.py` with `_run_git_worktree(args, cwd)` helper function (reuses `_run_git` pattern from `workspace.py`)
- [x] 1.2 Implement `create_worktree(workspace, branch_name=None, base_ref=None)` — runs `git worktree add`, returns `{worktree_id, path, branch}`
- [x] 1.3 Implement `list_worktrees(workspace)` — runs `git worktree list --porcelain`, parses output into array of `{worktree_id, path, branch, is_locked}`
- [x] 1.4 Implement `remove_worktree(workspace, worktree_id)` — runs `git worktree remove --force`, optionally deletes branch
- [x] 1.5 Add error handling: return `None` on git failure, graceful degradation when git unavailable

## 2. Backend - REST API Endpoints

- [x] 2.1 Add `POST /api/worktree/create` route in `api/routes.py` — reads `session_id` from body, resolves workspace from session, calls `create_worktree`, returns JSON or error
- [x] 2.2 Add `GET /api/worktree/list` route in `api/routes.py` — reads `session_id` from query params, resolves workspace, calls `list_worktrees`, returns JSON array
- [x] 2.3 Add `POST /api/worktree/remove` route in `api/routes.py` — reads `worktree_id` from body, validates existence, calls `remove_worktree`, returns JSON or 404
- [x] 2.4 Add validation for non-git workspace (return 400) and git-unavailable host (return 503) in all 3 endpoints

## 3. Backend - Kanban Worktree Binding

- [x] 3.1 Add worktree path validation in `api/kanban_bridge.py` `_create_task_payload()` — when `workspace_kind="worktree"`, validate that `workspace_path` exists on disk
- [x] 3.2 Return error from kanban task creation when `workspace_kind="worktree"` and `workspace_path` does not exist

## 4. Backend - MCP Worktree Tools

- [x] 4.1 Add 3 `Tool` objects to `TOOLS` list in `mcp_server.py`: `worktree_create`, `worktree_list`, `worktree_remove` with proper `inputSchema` definitions
- [x] 4.2 Add 3 handler functions to `HANDLERS` dict: `handle_worktree_create` (POST via `_api_post`), `handle_worktree_list` (filesystem read), `handle_worktree_remove` (POST via `_api_post`)
- [x] 4.3 Add profile scoping to MCP handlers using `_active_profile()` and `_profiles_match()` pattern

## 5. Frontend - Kanban Worktree Status

- [x] 5.1 Add worktree badge rendering in `static/panels.js` `_kanbanCard()` — when task has `workspace_kind="worktree"`, display branch name and "worktree" label
- [x] 5.2 Extract branch name from `workspace_path` for display in the badge

## 6. Testing

- [x] 6.1 Add `test_worktree_api.py` in `tests/` — test create/list/remove endpoints with pytest against isolated test server
- [x] 6.2 Add `test_worktree_mcp.py` — test MCP tool registration and handler dispatch
- [x] 6.3 Add `test_worktree_kanban_binding.py` — test kanban task creation with `workspace_kind="worktree"` and validation
- [x] 6.4 Run full test suite (`pytest tests/`) and fix any failures