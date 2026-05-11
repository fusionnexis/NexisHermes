# UI Scenario Test Specification

## Change: m5-qa-verification-pipeline
## Generated: 2026-05-10
## Max Scenarios: 5

## Test Infrastructure
- Framework: Playwright
- Base URL: http://127.0.0.1:8787
- Auth: No auth
- Setup: page.route() mocks before page.goto('/')

## Scenarios

### US-1: QA progress indicator on task card
- **Goal**: Verify QA progress dots appear on task cards with QA phases result
- **Preconditions**: Board mock with task having result={"phases":[{"name":"IT","status":"pass"},{"name":"API","status":"pass"},{"name":"E2E","status":"pending"},{"name":"Security","status":"pending"}]}
- **Steps**: Mock board → switch to Kanban → assert [data-testid="qa-progress"] visible with "✅✅⬜⬜"
- **Key Selectors**: `[data-testid="qa-progress"]`
- **Assertions**: Visual: progress indicator visible; Text: contains pass/pending symbols

### US-2: No QA progress on tasks without result
- **Goal**: Verify tasks without result field show no QA progress
- **Preconditions**: Board mock with task having result=null
- **Steps**: Mock board → assert [data-testid="qa-progress"] count = 0
- **Key Selectors**: `[data-testid="qa-progress"]`
- **Assertions**: Count = 0

### US-3: QA report card — all pass
- **Goal**: Verify qa_report clarify card shows pass summary with Approve button
- **Preconditions**: Mock clarify pending with kind="qa_report", outcome="pass"
- **Steps**: Trigger clarify card → assert .clarify-qa-report-card visible with "All 4 phases passed" and Approve button
- **Key Selectors**: `.clarify-qa-report-card`, `.clarify-approve-btn`
- **Assertions**: Text contains "passed"; Approve button visible

### US-4: QA report card — failures
- **Goal**: Verify qa_report clarify card shows failure details with Acknowledge button
- **Preconditions**: Mock clarify pending with kind="qa_report", outcome="fail"
- **Steps**: Trigger clarify card → assert failure styling and Acknowledge button
- **Key Selectors**: `.clarify-qa-report-card`, `.clarify-acknowledge-btn`
- **Assertions**: Card has failure styling; Acknowledge button visible

### US-5: QA child task visible in qa_verify column
- **Goal**: Verify QA child task appears in the qa_verify column (Review column)
- **Preconditions**: Board mock with task in qa_verify status
- **Steps**: Mock board → switch to Kanban → assert task card in qa_verify column
- **Key Selectors**: `.kanban-column[data-status="qa_verify"] .kanban-card`
- **Assertions**: Task card visible under Review column

## Notes
- Playwright test file: `e2e/m5-qa-verification-pipeline.spec.ts`
- QA progress indicator requires parsing task.result JSON in the frontend
- data-testid="qa-progress" must be added to the progress element in implementation