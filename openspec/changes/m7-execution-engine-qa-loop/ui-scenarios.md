# UI Scenario Test Specification

## Change: m7-execution-engine-qa-loop
## Generated: 2026-05-11
## Max Scenarios: 5

## Test Infrastructure
- Framework: Playwright
- Base URL: http://127.0.0.1:8787
- Auth: No auth
- Setup: page.route() mocks before page.goto('/')

## Scenarios

### US-1: Retry badge on task card
- **Goal**: Verify tasks with `result.qa_retries > 0` show a retry badge
- **Preconditions**: Board mock with task having `result={"qa_retries":2}`, max_retries=3
- **Steps**: Mock board → switch to Kanban → assert `[data-testid="retry-badge"]` visible with "🔄 2/3"
- **Key Selectors**: `[data-testid="retry-badge"]`
- **Assertions**: Badge visible, text contains "2/3"

### US-2: No retry badge when qa_retries is 0
- **Goal**: Verify no retry badge when retries=0 or absent
- **Preconditions**: Board mock with task having no qa_retries in result
- **Steps**: Assert `[data-testid="retry-badge"]` count = 0
- **Key Selectors**: `[data-testid="retry-badge"]`
- **Assertions**: Count = 0

### US-3: Plan clarify card renders via page.evaluate (M4 fix)
- **Goal**: Fix M4 US-2 — verify plan clarify card renders when injected directly
- **Preconditions**: Page loaded, showClarifyCard available
- **Steps**: page.evaluate(() => showClarifyCard({kind:"plan", question:"Review plan", content:"## Plan\n- Step 1", _session_id:"test"})) → assert .clarify-plan-card visible
- **Key Selectors**: `.clarify-plan-card`, `.clarify-approve-btn`
- **Assertions**: Plan card visible, Approve button visible

### US-4: Proposal clarify card with phase label (M4 fix)
- **Goal**: Fix M4 US-3 — verify proposal card shows phase header
- **Steps**: page.evaluate(() => showClarifyCard({kind:"proposal", phase:1, phase_label:"Design Review", content:"# Design", _session_id:"test"})) → assert .clarify-phase-label visible
- **Key Selectors**: `.clarify-proposal-card`, `.clarify-phase-label`
- **Assertions**: Phase label contains "Phase 1" and "Design Review"

### US-5: Approve button on clarify card sends respond (M4 fix)
- **Goal**: Fix M4 US-4 — verify clicking Approve sends POST /api/clarify/respond
- **Steps**: Inject plan card → mock /api/clarify/respond → click .clarify-approve-btn → assert POST sent with response="approve"
- **Key Selectors**: `.clarify-approve-btn`
- **Assertions**: POST /api/clarify/respond called, body.response = "approve"

## Notes
- US-3/4/5 fix the 3 M4 Playwright failures by using `page.evaluate()` to inject clarify cards directly
- Playwright test file: `e2e/m7-execution-engine-qa-loop.spec.ts` for US-1/2; M4 spec file updated for US-3/4/5
- The `showClarifyCard` function must be globally accessible (it is — it's in messages.js loaded as a script tag)