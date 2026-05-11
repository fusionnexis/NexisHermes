## ADDED Requirements

### Requirement: Execution status endpoint
The system SHALL provide `GET /api/execution/status` that returns real-time execution engine metrics.

#### Scenario: Status returns active workers and queue depth
- **WHEN** GET `/api/execution/status` is called
- **THEN** the response contains `{enabled, active_workers, max_concurrent, queue_depth, scheduler_interval, uptime_seconds}`

#### Scenario: Status when scheduler disabled
- **WHEN** GET `/api/execution/status` is called and scheduler is disabled
- **THEN** the response contains `{enabled: false}`

### Requirement: Config.yaml execution section
The system SHALL read execution configuration from `config.yaml` under the `execution:` key. Fields: `enabled` (bool, default false), `max_concurrent` (int, default 4), `scheduler_interval` (float, default 5.0), `max_qa_retries` (int, default 3).