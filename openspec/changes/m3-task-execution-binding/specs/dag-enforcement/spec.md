## ADDED Requirements

### Requirement: DAG parent completion check on status=ready
The system SHALL reject PATCH `status=ready` on a task when that task has one or more parent tasks that are NOT in `done` status. The check SHALL be performed in `kanban_bridge._patch_task()` before the status transition. Tasks with no parents are unaffected.

#### Scenario: Task with all parents done can become ready
- **WHEN** PATCH `/api/kanban/tasks/<id>/patch` sets `status=ready` and all parent tasks have `status=done`
- **THEN** the task transitions to `ready` and HTTP 200 is returned

#### Scenario: Task with incomplete parent is blocked
- **WHEN** PATCH `/api/kanban/tasks/<id>/patch` sets `status=ready` and at least one parent task has `status=todo`
- **THEN** the system returns HTTP 400 with `{"error": "parent tasks not complete: [<parent_id>]"}`

#### Scenario: Task with no parents can become ready freely
- **WHEN** PATCH `/api/kanban/tasks/<id>/patch` sets `status=ready` and the task has no parent links
- **THEN** the task transitions to `ready` without any DAG check

#### Scenario: DAG check only applies to ready transition
- **WHEN** PATCH `/api/kanban/tasks/<id>/patch` sets `status=todo` on a task with incomplete parents
- **THEN** the transition succeeds — DAG enforcement only applies to the `ready` status