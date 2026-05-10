## ADDED Requirements

### Requirement: Task claim endpoint
The system SHALL provide a `POST /api/kanban/claim` endpoint that atomically creates a worktree (optional), creates a session with the task's role and worktree as workspace, binds the session to the task, and transitions the task to `running`. The endpoint MUST accept `task_id` (required), `session_id` (optional, creates new if absent), `create_worktree` (bool, default true), and `board` (optional).

#### Scenario: Full claim with new worktree and session
- **WHEN** POST `/api/kanban/claim` is called with `task_id="t_abc"` and `create_worktree=true`
- **THEN** a new worktree is created (`wt-t_abc`), a new session is created with `role=<active_profile_role>` and `workspace=<worktree_path>`, the task gets `session_id` and `workspace_path` populated, task status becomes `running`
- **AND** the response includes `{task, session, worktree}`

#### Scenario: Claim without worktree (planner role)
- **WHEN** POST `/api/kanban/claim` is called with `task_id` and `create_worktree=false`
- **THEN** no worktree is created, session is created with default workspace, task enters `running` with `session_id` set but no `workspace_path`

#### Scenario: Claim conflict (task already running)
- **WHEN** POST `/api/kanban/claim` is called on a task already in `running` state
- **THEN** the system returns HTTP 409 with `{"error": "task already claimed"}`

#### Scenario: Worktree creation failure blocks claim
- **WHEN** POST `/api/kanban/claim` is called with `create_worktree=true` on a non-git workspace
- **THEN** the system returns HTTP 400 with `{"error": "workspace is not a git repo"}` and the task status is NOT changed

### Requirement: Session kanban_task_id binding
The system SHALL store a `kanban_task_id` field on Session objects set during claim. The field MUST be returned in all session API responses. A GET on the session MUST include `kanban_task_id`.

#### Scenario: Session shows kanban_task_id after claim
- **WHEN** a session is created via `/api/kanban/claim`
- **THEN** `GET /api/session?session_id=<sid>` returns the session with `kanban_task_id` set to the claimed task ID

#### Scenario: Normal sessions have null kanban_task_id
- **WHEN** a session is created via `/api/session/new`
- **THEN** the session has `kanban_task_id=null`