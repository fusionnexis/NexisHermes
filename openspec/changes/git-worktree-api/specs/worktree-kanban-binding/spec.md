## ADDED Requirements

### Requirement: Worktree binding on kanban task creation
The system SHALL allow kanban tasks to be created with `workspace_kind="worktree"` and a `workspace_path` value. When a task is created with `workspace_kind="worktree"`, the system MUST validate that the `workspace_path` corresponds to an existing git worktree directory.

#### Scenario: Create task with worktree workspace
- **WHEN** POST `/api/kanban/tasks/` is called with `workspace_kind="worktree"` and `workspace_path="/path/to/worktree"`
- **THEN** the system creates the kanban task with those workspace fields populated, replacing the default `"scratch"` and `None` values

#### Scenario: Create task with invalid worktree path
- **WHEN** POST `/api/kanban/tasks/` is called with `workspace_kind="worktree"` and `workspace_path="/nonexistent/path"`
- **THEN** the system returns an error indicating the worktree path does not exist

### Requirement: Worktree status display in kanban task cards
The frontend SHALL display a worktree status indicator in kanban task cards when `workspace_kind="worktree"`. The indicator MUST show the branch name and a "worktree" label. When `workspace_kind="scratch"` or `None`, no worktree indicator MUST be shown.

#### Scenario: Task card shows worktree badge
- **WHEN** a kanban task card is rendered for a task with `workspace_kind="worktree"` and `workspace_path="/path/to/wt-task-123"`
- **THEN** the card displays a "worktree" badge with the branch name extracted from the path

#### Scenario: Task card without worktree
- **WHEN** a kanban task card is rendered for a task with `workspace_kind="scratch"`
- **THEN** the card does NOT display any worktree badge