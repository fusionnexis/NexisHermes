## ADDED Requirements

### Requirement: Persistent execution scheduler
The system SHALL provide an `ExecutionScheduler` daemon thread that periodically (configurable interval, default 5s) scans for `ready` tasks and dispatches them via `dispatch_once`. The scheduler MUST respect `max_concurrent` worker limit.

#### Scenario: Scheduler dispatches ready tasks
- **WHEN** the scheduler runs and there are `ready` tasks and active workers < max_concurrent
- **THEN** `dispatch_once` is called and tasks are claimed

#### Scenario: Scheduler respects worker limit
- **WHEN** active workers >= max_concurrent
- **THEN** the scheduler skips dispatch until a slot opens

#### Scenario: Scheduler disabled by default
- **WHEN** `config.yaml execution.enabled` is false (or absent)
- **THEN** no scheduler thread is started

### Requirement: Timeout enforcer
The system SHALL periodically check running tasks for `max_runtime_seconds` and `claim_expires` violations. Tasks exceeding their timeout MUST be set to `blocked` with a "timeout exceeded" comment.

#### Scenario: Task exceeds max_runtime_seconds
- **WHEN** a running task's `started_at + max_runtime_seconds < now`
- **THEN** the task is set to `blocked` and a comment "Execution timeout exceeded" is added

### Requirement: Health monitor — stale task reclaim
The system SHALL detect stale tasks (running but `claim_expires < now`) and auto-reclaim them by setting status back to `ready`.

#### Scenario: Stale task reclaimed
- **WHEN** a running task has `claim_expires < now` and `last_heartbeat_at` is older than 2× scheduler interval
- **THEN** the task is set to `ready` for re-dispatch