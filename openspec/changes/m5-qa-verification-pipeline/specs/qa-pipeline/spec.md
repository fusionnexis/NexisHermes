## ADDED Requirements

### Requirement: QA pipeline 4-phase execution
The system SHALL track QA pipeline progress through 4 ordered phases: Integration Testing (IT), API Testing, E2E Testing, Security Review. Phase results MUST be stored in the QA task's `result` field as JSON: `{"phases": [{"name": "...", "status": "pass"|"fail"|"pending", "detail": "..."}]}`.

#### Scenario: QA task result tracks phase completion
- **WHEN** the QA agent updates the task result to `{"phases":[{"name":"IT","status":"pass"},{"name":"API","status":"pass"},{"name":"E2E","status":"pending"},{"name":"Security","status":"pending"}]}`
- **THEN** GET on the task returns the full phases array

### Requirement: QA pass → clarify report → parent done
The system SHALL submit a `kind="qa_report"` clarify when all 4 QA phases pass. When approved, the parent task's status MUST be set to `done`.

#### Scenario: All phases pass → qa_report submitted
- **WHEN** all 4 phases have `status="pass"` in the QA task result
- **THEN** a clarify entry with `kind="qa_report"`, `outcome="pass"` is submitted for the QA session

#### Scenario: QA report approved → parent done
- **WHEN** the qa_report clarify is approved
- **THEN** the parent task (linked via task_links) transitions to `done`

### Requirement: QA fail → parent blocked
The system SHALL move the parent task to `blocked` status when any QA phase fails. The failure detail MUST be recorded as a comment on the parent task.

#### Scenario: Phase fails → parent blocked
- **WHEN** any phase has `status="fail"` in the QA result
- **THEN** the parent task is set to `blocked` with a failure comment