## ADDED Requirements

### Requirement: QA progress indicator on kanban task cards
The frontend SHALL display a QA progress indicator on kanban task cards that have a `result` field containing QA phase data. The indicator MUST show the status of each phase using visual symbols: ✅ (pass), ❌ (fail), ⬜ (pending).

#### Scenario: QA task card shows progress dots
- **WHEN** a kanban task card has `result` containing `{"phases":[{"name":"IT","status":"pass"},{"name":"API","status":"pass"},{"name":"E2E","status":"pending"},{"name":"Security","status":"pending"}]}`
- **THEN** the card displays `✅✅⬜⬜` in the meta row

#### Scenario: No result field → no progress indicator
- **WHEN** a kanban task has no `result` field (or result is null)
- **THEN** no progress indicator is displayed

### Requirement: kind="qa_report" clarify card rendering
The frontend SHALL render clarify entries with `kind="qa_report"` as a QA report card showing pass/fail status per phase, with an Approve button (when all pass) or an Acknowledge button (when failures exist).

#### Scenario: QA report card with all pass
- **WHEN** a clarify entry has `kind="qa_report"` and `outcome="pass"`
- **THEN** the card shows "All 4 phases passed" with green checkmarks and an Approve button

#### Scenario: QA report card with failures
- **WHEN** a clarify entry has `kind="qa_report"` and `outcome="fail"`
- **THEN** the card shows failed phases highlighted in red with failure detail, and an Acknowledge button