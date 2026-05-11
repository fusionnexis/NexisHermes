# UI Scenario Test Specification

## Change: m6-cron-mcp-release-gate
## Generated: 2026-05-11
## Max Scenarios: 5

## Test Infrastructure
- Framework: Playwright
- Base URL: http://127.0.0.1:8787
- Auth: No auth
- Setup: page.route() mocks before page.goto('/')

## Scenarios

### US-1: Cron badge on task card
- **Goal**: Verify kanban cards with `tenant="cron"` display a cron badge
- **Preconditions**: Board mock with task having `tenant="cron"`
- **Steps**: Mock board → switch to Kanban → assert cron badge visible with "⏱ cron" or "cron" text
- **Key Selectors**: `.kanban-badge.tenant`
- **Assertions**: Badge visible with cron text

### US-2: Release gate clarify card shows merge action
- **Goal**: Verify release_gate clarify renders branch name + Merge & Archive button
- **Preconditions**: Mock clarify pending with `kind="release_gate"`, `branch="task-123"`, `workspace_path="/path"`
- **Steps**: Trigger clarify card → assert `.clarify-release-gate-card` visible with branch name and Merge button
- **Key Selectors**: `.clarify-release-gate-card`, `.clarify-merge-btn`
- **Assertions**: Branch name visible, Merge & Archive button visible

### US-3: Release gate reject button visible
- **Goal**: Verify release_gate card has a Reject button
- **Preconditions**: release_gate clarify card visible
- **Steps**: Assert Reject button exists alongside Merge button
- **Key Selectors**: `.clarify-reject-btn`
- **Assertions**: Reject button visible

### US-4: Task card with tenant displays tenant badge
- **Goal**: Verify the existing tenant badge works for custom tenant values (not just cron)
- **Preconditions**: Board mock with task having `tenant="backend-team"`
- **Steps**: Mock board → assert tenant badge shows "backend-team"
- **Key Selectors**: `.kanban-badge.tenant`
- **Assertions**: Badge text = "backend-team"

### US-5: Release gate card shows workspace path
- **Goal**: Verify the release gate card displays the worktree path being merged
- **Preconditions**: release_gate clarify with `workspace_path="/Users/user/Code/project-wt-task-123"`
- **Steps**: Assert workspace path text visible in the card body
- **Key Selectors**: `.clarify-release-gate-card`
- **Assertions**: Text contains the workspace path

## Notes
- Playwright test file: `e2e/m6-cron-mcp-release-gate.spec.ts`
- Cron badge is handled by the existing `.kanban-badge.tenant` rendering — verify it shows "cron" text
- Release gate clarify card needs `data-testid` attributes added in implementation