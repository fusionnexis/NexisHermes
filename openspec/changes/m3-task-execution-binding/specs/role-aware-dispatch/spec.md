## ADDED Requirements

### Requirement: Role-filtered dispatch
The system SHALL accept an optional `role` query parameter on `POST /api/kanban/dispatch`. When `role` is provided, the dispatcher SHALL only claim tasks whose `assignee` field ends with `/{role}` (e.g., `assignee="coder-profile/coder"` matches `role=coder`). When `role` is absent, dispatch behavior is unchanged (claims any ready task).

#### Scenario: Role-filtered dispatch claims matching task
- **WHEN** POST `/api/kanban/dispatch?role=qa` is called
- **THEN** only tasks with `assignee` ending in `/qa` are eligible for claiming

#### Scenario: Role-filtered dispatch ignores non-matching tasks
- **WHEN** POST `/api/kanban/dispatch?role=coder` is called and all ready tasks have `assignee="planner-profile/planner"`
- **THEN** the dispatcher claims 0 tasks and returns `{spawned: 0}`

#### Scenario: Dispatch without role is unchanged
- **WHEN** POST `/api/kanban/dispatch` is called without `role` param
- **THEN** dispatch behavior is identical to pre-M3 (claims any assignable ready task)

### Requirement: Assignee format profile/role
The system SHALL support task `assignee` values in the format `{profile_name}/{role}` (e.g., `"coder/coder"`, `"qa-agent/qa"`). The UI task creation modal and claim endpoint SHALL default the assignee to `{active_profile}/{active_role}` when the user does not specify one explicitly.

#### Scenario: Claim sets assignee in profile/role format
- **WHEN** POST `/api/kanban/claim` is called with active profile `"coder"` (role=coder)
- **THEN** the task `assignee` is set to `"coder/coder"`