## ADDED Requirements

### Requirement: Create worktree endpoint
The system SHALL provide a `POST /api/worktree/create` endpoint that creates an isolated git worktree from the current session's workspace. The endpoint MUST accept `branch_name` (optional, auto-generated if omitted) and `base_ref` (optional, defaults to current HEAD). The system MUST return `{worktree_id, path, branch}` on success. The system MUST reject requests when the workspace is not a git repo or git is unavailable on the host.

#### Scenario: Successful worktree creation
- **WHEN** POST `/api/worktree/create` is called with a session that has a git workspace
- **THEN** the system creates a git worktree with a new branch, returns `{worktree_id: "wt-task-123", path: "/path/to/repo-worktrees/wt-task-123", branch: "task-123"}`, and the worktree directory exists on disk

#### Scenario: Auto-generated branch name
- **WHEN** POST `/api/worktree/create` is called without `branch_name`
- **THEN** the system generates a branch name using the pattern `wt-{timestamp}` and returns it in the response

#### Scenario: Workspace not a git repo
- **WHEN** POST `/api/worktree/create` is called with a session whose workspace is not a git repository
- **THEN** the system returns `{"error": "workspace is not a git repo"}` with HTTP 400

#### Scenario: Git not available on host
- **WHEN** POST `/api/worktree/create` is called and the `git` command is not available on the host system
- **THEN** the system returns `{"error": "git not available"}` with HTTP 503

#### Scenario: Branch already exists
- **WHEN** POST `/api/worktree/create` is called with a `branch_name` that already has a worktree
- **THEN** the system returns `{"error": "worktree or branch already exists"}` with HTTP 409

### Requirement: List worktrees endpoint
The system SHALL provide a `GET /api/worktree/list` endpoint that returns all git worktrees for the current session's workspace. The endpoint MUST accept `session_id` as a query parameter. The system MUST return an array of `{worktree_id, path, branch, is_locked}` objects.

#### Scenario: List existing worktrees
- **WHEN** GET `/api/worktree/list?session_id=abc` is called and the session has a git workspace with 2 worktrees
- **THEN** the system returns an array of 2 worktree objects with paths, branches, and lock status

#### Scenario: No worktrees exist
- **WHEN** GET `/api/worktree/list?session_id=abc` is called and the workspace has no worktrees
- **THEN** the system returns an empty array `[]`

#### Scenario: Session without git workspace
- **WHEN** GET `/api/worktree/list?session_id=abc` is called and the session workspace is not a git repo
- **THEN** the system returns `{"error": "workspace is not a git repo"}` with HTTP 400

### Requirement: Remove worktree endpoint
The system SHALL provide a `POST /api/worktree/remove` endpoint that removes a git worktree and its branch. The endpoint MUST accept `worktree_id` (the worktree path or human-readable ID). The system MUST call `git worktree remove --force` and optionally delete the associated branch. The system MUST return `{removed: true, worktree_id}` on success.

#### Scenario: Successful worktree removal
- **WHEN** POST `/api/worktree/remove` with `worktree_id="wt-task-123"` is called and the worktree exists
- **THEN** the system removes the worktree directory, deletes the branch, and returns `{removed: true, worktree_id: "wt-task-123"}`

#### Scenario: Worktree not found
- **WHEN** POST `/api/worktree/remove` with `worktree_id="wt-nonexistent"` is called and no such worktree exists
- **THEN** the system returns `{"error": "worktree not found"}` with HTTP 404

#### Scenario: Force removal with uncommitted changes
- **WHEN** POST `/api/worktree/remove` is called on a worktree that has uncommitted changes
- **THEN** the system uses `--force` flag to remove regardless of changes and returns `{removed: true}`