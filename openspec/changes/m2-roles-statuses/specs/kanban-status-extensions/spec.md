## ADDED Requirements

### Requirement: 9-column board status model
The system SHALL extend `BOARD_COLUMNS` from 6 to 9 columns: `["triage", "todo", "ready", "running", "in_review", "qa_verify", "blocked", "release_ready", "done"]`. The `/api/kanban/board` endpoint MUST return all 9 columns. The `/api/kanban/config` endpoint MUST return the 9-column list.

#### Scenario: Board returns 9 columns
- **WHEN** GET `/api/kanban/board` is called
- **THEN** the response `columns` array has exactly 9 entries with names matching the extended list

### Requirement: task_size field on kanban tasks
The system SHALL support a `task_size` field on kanban tasks. Valid values are `"small"`, `"medium"`, `"large"`, or `null` (unset). The field MUST be accepted on POST `/api/kanban/tasks` (create) and PATCH `/api/kanban/tasks/<id>` (edit). The field MUST be returned in all task detail responses.

#### Scenario: Create task with size
- **WHEN** POST `/api/kanban/tasks` is called with `task_size="medium"`
- **THEN** the created task has `task_size="medium"` in the response

#### Scenario: Create task without size defaults to null
- **WHEN** POST `/api/kanban/tasks` is called without `task_size`
- **THEN** the created task has `task_size=null`

#### Scenario: Invalid task_size rejected
- **WHEN** POST `/api/kanban/tasks` is called with `task_size="huge"`
- **THEN** the system returns HTTP 400

### Requirement: Status transition validation
The system SHALL enforce the following transition rules for the new statuses via PATCH `/api/kanban/tasks/<id>`:
- `in_review` is only reachable from `running`
- `qa_verify` is only reachable from `in_review`
- `release_ready` is only reachable from `qa_verify`
Transitions from any status to `blocked`, `triage`, `todo`, `ready`, `done`, or `archived` remain unrestricted (existing behavior preserved).

#### Scenario: running → in_review succeeds
- **WHEN** PATCH `/api/kanban/tasks/<id>` sets `status="in_review"` and the task's current status is `"running"`
- **THEN** the task status is updated to `"in_review"` and HTTP 200 is returned

#### Scenario: todo → in_review rejected
- **WHEN** PATCH `/api/kanban/tasks/<id>` sets `status="in_review"` and the task's current status is `"todo"`
- **THEN** the system returns HTTP 400 with an error describing the invalid transition

#### Scenario: in_review → qa_verify succeeds
- **WHEN** PATCH `/api/kanban/tasks/<id>` sets `status="qa_verify"` and current status is `"in_review"`
- **THEN** the task status is updated to `"qa_verify"` and HTTP 200 is returned

#### Scenario: qa_verify → release_ready succeeds
- **WHEN** PATCH `/api/kanban/tasks/<id>` sets `status="release_ready"` and current status is `"qa_verify"`
- **THEN** the task status is updated to `"release_ready"` and HTTP 200 is returned