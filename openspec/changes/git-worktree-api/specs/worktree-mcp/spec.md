## ADDED Requirements

### Requirement: MCP worktree_create tool
The system SHALL expose a `worktree_create` MCP tool that creates an git worktree via the WebUI API. The tool MUST accept `session_id` (required), `branch_name` (optional), and `base_ref` (optional). The tool MUST authenticate via the WebUI password and return the worktree creation result as JSON.

#### Scenario: Create worktree via MCP
- **WHEN** an MCP client calls `worktree_create` with `session_id="abc"` and `branch_name="task-456"`
- **THEN** the tool POSTs to `/api/worktree/create` with auth credentials and returns `{worktree_id, path, branch}` as TextContent

#### Scenario: Create worktree without auth
- **WHEN** `worktree_create` is called but no WebUI password is configured
- **THEN** the tool returns `{error: "authentication required"}` as TextContent

### Requirement: MCP worktree_list tool
The system SHALL expose a `worktree_list` MCP tool that lists git worktrees for a session's workspace. The tool MUST accept `session_id` (required). The tool MUST read worktree state from git directly (filesystem access, no HTTP call needed for reads).

#### Scenario: List worktrees via MCP
- **WHEN** an MCP client calls `worktree_list` with `session_id="abc"`
- **THEN** the tool reads the session's workspace, runs `git worktree list`, and returns the array of worktrees as TextContent

### Requirement: MCP worktree_remove tool
The system SHALL expose a `worktree_remove` MCP tool that removes a git worktree via the WebUI API. The tool MUST accept `worktree_id` (required). The tool MUST authenticate via the WebUI password and return the removal result as JSON.

#### Scenario: Remove worktree via MCP
- **WHEN** an MCP client calls `worktree_remove` with `worktree_id="wt-task-123"`
- **THEN** the tool POSTs to `/api/worktree/remove` with auth credentials and returns `{removed: true, worktree_id}` as TextContent