## ADDED Requirements

### Requirement: 9-column kanban board rendering
The frontend SHALL render all 9 kanban columns. The 3 new columns MUST display with descriptive labels: `in_review`→"In Review", `qa_verify`→"QA Verify", `release_ready`→"Release Ready". The board layout MUST support horizontal scrolling when columns exceed viewport width.

#### Scenario: All 9 columns visible on kanban board
- **WHEN** the user navigates to the Kanban panel
- **THEN** the board renders 9 column headers including "In Review", "QA Verify", and "Release Ready"

#### Scenario: Tasks in new columns appear under correct header
- **WHEN** a task has `status="in_review"`
- **THEN** the task card appears under the "In Review" column header

### Requirement: task_size badge on kanban task cards
The frontend SHALL display a size badge on kanban task cards when `task_size` is set. Badge labels: `small`→"S", `medium`→"M", `large`→"L". When `task_size` is null, no badge is shown.

#### Scenario: Medium task shows size badge
- **WHEN** a kanban task card has `task_size="medium"` 
- **THEN** a badge labelled "M" is visible on the card

#### Scenario: Task without size shows no badge
- **WHEN** a kanban task card has `task_size=null`
- **THEN** no size badge is displayed on the card

### Requirement: task_size field in task creation and edit modal
The task creation and edit modal SHALL include a size selector field with options: (none), Small, Medium, Large. The selected value MUST be sent as `task_size` in the create/patch request body.

#### Scenario: Task creation modal has size selector
- **WHEN** the user opens the new task modal
- **THEN** a "Size" dropdown is visible with options for None, Small, Medium, Large

### Requirement: Worktree kanban binding compatibility
The `worktree-kanban-binding` capability MUST continue to work with the extended status model. Tasks with `workspace_kind="worktree"` in any of the 9 statuses MUST display the worktree badge. The worktree binding MUST NOT be cleared when a task transitions to `in_review`, `qa_verify`, or `release_ready`.

#### Scenario: Worktree badge persists through in_review transition
- **WHEN** a task with `workspace_kind="worktree"` transitions to `status="in_review"`
- **THEN** the task card still shows the worktree badge with the branch name