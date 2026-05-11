## ADDED Requirements

### Requirement: Execution policy router endpoint
The system SHALL provide a `POST /api/kanban/execute` endpoint that routes task execution based on `task_size`. The endpoint MUST accept `task_id` (required), `plan_content` (optional string for medium path), `board` (optional). The endpoint MUST return `{route, task, session, worktree}` where `route` is one of `"small"`, `"medium"`, `"large"`.

#### Scenario: Small task routes directly to claim
- **WHEN** POST `/api/kanban/execute` is called with a task that has `task_size="small"`
- **THEN** the system calls `claim_task_with_binding`, task enters `in_progress`, and `route="small"` is returned

#### Scenario: Task with no size defaults to small
- **WHEN** POST `/api/kanban/execute` is called with a task that has `task_size=null`
- **THEN** the system treats it as `small` and routes directly to claim

#### Scenario: Medium task enters clarify flow
- **WHEN** POST `/api/kanban/execute` is called with `task_size="medium"` and `plan_content="..."` provided
- **THEN** the task is claimed, a clarify entry with `kind="plan"` is submitted, and `route="medium"` is returned with `clarify_pending=true`

#### Scenario: Large task enters multi-phase clarify flow
- **WHEN** POST `/api/kanban/execute` is called with `task_size="large"`
- **THEN** the task is claimed, Phase 1 clarify entry (`kind="proposal"`, `phase=1`) is submitted, and `route="large"`, `clarify_phase=1` is returned

#### Scenario: Task not found returns 404
- **WHEN** POST `/api/kanban/execute` is called with a non-existent `task_id`
- **THEN** the system returns HTTP 404 `{"error": "task not found"}`