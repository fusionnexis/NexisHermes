# API Test Specification

## Change: git-worktree-api
## Generated: 2026-05-10

## Test Discovery
- Test framework: pytest
- Test directory: tests/
- Base class/helpers: conftest.py provides `TEST_BASE`, `TEST_PORT`, `TEST_STATE_DIR`, `TEST_WORKSPACE`; uses `urllib.request` for HTTP calls
- Existing patterns: function-based tests, `urllib.request.urlopen` for HTTP, isolated test server on port 8788+, temporary state dir per worktree

## Test Cases

### TC-API-1: Create worktree successfully
- **Endpoint**: `POST /api/worktree/create`
- **Type**: integration
- **Setup**: Start test server; create a git-initialized test workspace with at least one commit
- **Request**: `{"session_id": "<sid>", "branch_name": "wt-test-1", "base_ref": "HEAD"}`
- **Expected Response**: 200, `{worktree_id: "wt-test-1", path: "<workspace>/wt-test-1", branch: "wt-test-1"}`; worktree directory exists on disk
- **Edge Cases**:
  - No `branch_name` provided → auto-generated `wt-{timestamp}` branch
  - `base_ref` omitted → defaults to HEAD
  - `base_ref` is a tag or remote ref → resolves correctly
- **Teardown**: Remove worktree via `/api/worktree/remove`

### TC-API-2: Create worktree on non-git workspace
- **Endpoint**: `POST /api/worktree/create`
- **Type**: integration
- **Setup**: Create a session with a non-git workspace directory (no `.git` folder)
- **Request**: `{"session_id": "<sid>"}`
- **Expected Response**: 400, `{"error": "workspace is not a git repo"}`
- **Edge Cases**: None
- **Teardown**: None

### TC-API-3: Create worktree with duplicate branch
- **Endpoint**: `POST /api/worktree/create`
- **Type**: integration
- **Setup**: Create a worktree with branch "wt-test-1" first; then attempt second creation with same branch
- **Request**: `{"session_id": "<sid>", "branch_name": "wt-test-1"}`
- **Expected Response**: 409, `{"error": "worktree or branch already exists"}`
- **Edge Cases**: None
- **Teardown**: Remove first worktree

### TC-API-4: List worktrees
- **Endpoint**: `GET /api/worktree/list?session_id=<sid>`
- **Type**: integration
- **Setup**: Create 2 worktrees in the test workspace
- **Request**: GET with session_id query param
- **Expected Response**: 200, array of 2 objects each with `worktree_id`, `path`, `branch`, `is_locked`
- **Edge Cases**:
  - No worktrees exist → returns `[]`
  - Session without git workspace → 400 error
- **Teardown**: Remove all worktrees

### TC-API-5: Remove worktree successfully
- **Endpoint**: `POST /api/worktree/remove`
- **Type**: integration
- **Setup**: Create a worktree first
- **Request**: `{"worktree_id": "wt-test-1"}`
- **Expected Response**: 200, `{removed: true, worktree_id: "wt-test-1"}`; worktree directory no longer exists on disk
- **Edge Cases**:
  - Worktree has uncommitted changes → force removal succeeds
- **Teardown**: None (worktree already removed)

### TC-API-6: Remove nonexistent worktree
- **Endpoint**: `POST /api/worktree/remove`
- **Type**: integration
- **Setup**: No worktrees exist
- **Request**: `{"worktree_id": "wt-nonexistent"}`
- **Expected Response**: 404, `{"error": "worktree not found"}`
- **Edge Cases**: None
- **Teardown**: None

### TC-API-7: Kanban task creation with worktree binding
- **Endpoint**: `POST /api/kanban/tasks/`
- **Type**: integration
- **Setup**: Create a valid worktree first; have kanban board available
- **Request**: `{"title": "test task", "board": "<board>", "workspace_kind": "worktree", "workspace_path": "<worktree_path>"}`
- **Expected Response**: 200, task created with `workspace_kind="worktree"` and `workspace_path` populated
- **Edge Cases**:
  - Invalid `workspace_path` (nonexistent directory) → error response
  - `workspace_kind="worktree"` with empty `workspace_path` → error
- **Teardown**: Delete task and remove worktree

### TC-API-8: MCP worktree tools
- **Endpoint**: MCP stdio (via mcp_server.py handlers)
- **Type**: integration
- **Setup**: MCP server running; test workspace is a git repo
- **Request**: `worktree_create({"session_id": "<sid>"}); worktree_list({"session_id": "<sid>"}); worktree_remove({"worktree_id": "<wt_id>"})`
- **Expected Response**: Each returns TextContent with JSON result matching the REST API responses
- **Edge Cases**:
  - MCP call without auth → `{error: "authentication required"}` for mutation tools
  - Profile mismatch → filtered or error
- **Teardown**: Remove worktrees

## Notes
- Test workspace MUST be a git repo with at least one commit for create/list/remove to work
- Use `conftest.py` patterns: isolated state dir, test server on auto-port, `urllib.request` for HTTP calls
- Git operations are subprocess calls — test server host must have `git` CLI available