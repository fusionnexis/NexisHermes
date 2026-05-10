# UI Scenario Test Specification

## Change: git-worktree-api
## Generated: 2026-05-10
## Max Scenarios: 3

## Test Infrastructure
- Framework: Playwright
- Base URL: http://localhost:8787 (default test server)
- Auth: No auth by default (test mode); if password set, use login flow
- Setup: Test server running, test workspace initialized as git repo with at least one commit, kanban board with tasks

## Scenarios

### US-1: Worktree badge visible on kanban task card
- **Goal**: Verify that a kanban task with `workspace_kind="worktree"` displays a worktree badge with branch name
- **Preconditions**: Kanban board exists with at least one task that has `workspace_kind="worktree"` and a `workspace_path` containing a branch name
- **Steps**:
  1. Navigate to `/` and switch to the Kanban panel via sidebar rail
  2. Wait for kanban board to render with task cards
  3. Locate the task card that has `workspace_kind="worktree"`
  4. Assert: the card contains a "worktree" badge element with the branch name text
- **Key Selectors**: `.kanban-card`, `.kanban-card .worktree-badge`
- **Assertions**:
  - Visual: worktree badge element is visible
  - Text: badge contains the branch name extracted from workspace_path

### US-2: No worktree badge on scratch tasks
- **Goal**: Verify that kanban tasks with `workspace_kind="scratch"` or no workspace_kind do NOT show a worktree badge
- **Preconditions**: Kanban board with a task that has `workspace_kind="scratch"` (or default)
- **Steps**:
  1. Navigate to `/` and switch to the Kanban panel
  2. Wait for kanban board to render
  3. Locate the task card without worktree workspace
  4. Assert: no `.worktree-badge` element exists within that card
- **Key Selectors**: `.kanban-card`, `.kanban-card .worktree-badge`
- **Assertions**:
  - Visual: no worktree badge element is present in the scratch task card

### US-3: Worktree badge updates when task workspace changes
- **Goal**: Verify that changing a task's workspace_kind from "scratch" to "worktree" causes the badge to appear without full page reload
- **Preconditions**: Kanban board with a scratch task; SSE stream active
- **Steps**:
  1. Navigate to `/` and switch to Kanban panel
  2. Observe the scratch task card has no worktree badge
  3. Via API, update the task's `workspace_kind` to "worktree" and set `workspace_path`
  4. Wait for SSE update to propagate to the UI
  5. Assert: the task card now shows a worktree badge
- **Key Selectors**: `.kanban-card`, `.worktree-badge`
- **Assertions**:
  - State: badge appears after SSE update without page reload
  - Text: badge shows the correct branch name

## Notes
- Kanban UI uses SSE for real-time updates — scenarios should verify SSE-driven refresh works
- The worktree badge is a small visual indicator — keep it minimal per Hermes design philosophy
- No responsive considerations specific to this feature — badge follows existing kanban card layout