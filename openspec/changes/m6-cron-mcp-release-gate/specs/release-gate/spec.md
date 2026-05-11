## ADDED Requirements

### Requirement: Release gate on done tasks with worktree
The system SHALL submit a `kind="release_gate"` clarify when a task with `workspace_path` transitions to `done`. The clarify SHALL present the merge action for human approval.

#### Scenario: Done task with worktree triggers release gate
- **WHEN** a task with `workspace_path="/path/to/wt-branch"` transitions to `done`
- **THEN** a clarify entry with `kind="release_gate"` is submitted containing the branch name and merge instructions

#### Scenario: Done task without worktree skips release gate
- **WHEN** a task with `workspace_path=null` transitions to `done`
- **THEN** no release gate clarify is submitted (task archives normally)

### Requirement: Release gate approve executes merge + cleanup
The system SHALL execute `git merge <branch>` and `worktree_remove` when a `kind="release_gate"` clarify is approved.

#### Scenario: Approve merge succeeds
- **WHEN** release_gate clarify is approved and git merge succeeds
- **THEN** the worktree is removed and the task is archived

#### Scenario: Merge conflict blocks task
- **WHEN** release_gate clarify is approved but git merge fails (conflict)
- **THEN** the task is set to `blocked` with the merge error in comments

#### Scenario: Reject release gate blocks task
- **WHEN** release_gate clarify is rejected
- **THEN** the task is moved to `blocked` status