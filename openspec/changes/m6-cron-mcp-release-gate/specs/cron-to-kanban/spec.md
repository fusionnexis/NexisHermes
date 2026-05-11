## ADDED Requirements

### Requirement: Cron job config fields for kanban task creation
The cron job configuration SHALL support `on_success_create_task` and `on_failure_create_task` boolean fields. When set, a kanban task is auto-created upon cron completion.

#### Scenario: Cron success creates triage task
- **WHEN** a cron job with `on_success_create_task=true` completes successfully
- **THEN** a kanban task is created with `status="triage"`, `title="Cron: {job_name} — success"`, `tenant="cron"`, and `body` containing cron output summary

#### Scenario: Cron failure creates triage task with failure tag
- **WHEN** a cron job with `on_failure_create_task=true` fails
- **THEN** a kanban task is created with `status="triage"`, `title="Cron: {job_name} — failed"`, `tenant="cron"`, `priority=1`

#### Scenario: Cron without config fields creates no task
- **WHEN** a cron job without `on_success_create_task` completes
- **THEN** no kanban task is created (existing behavior preserved)