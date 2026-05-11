## ADDED Requirements

### Requirement: QA failure auto-retry
The system SHALL automatically retry QA-failed tasks by setting the parent task to `ready` (instead of `blocked`) when `qa_retries < max_qa_retries`. The `qa_retries` counter MUST be stored in the parent task's `result` JSON and incremented on each QA failure.

#### Scenario: First QA failure — parent goes back to ready
- **WHEN** QA reports a failure and `qa_retries` is 0 (or absent)
- **THEN** parent task `status` is set to `ready`, `result.qa_retries` is set to 1, and the failure detail is added as a comment

#### Scenario: Max retries reached — escalate to human
- **WHEN** QA reports a failure and `qa_retries >= max_qa_retries` (default 3)
- **THEN** parent task is set to `blocked` and a `kind="escalation"` clarify is submitted ("QA failed N times — manual intervention needed")

#### Scenario: Re-claim after retry reuses existing worktree
- **WHEN** a coder re-claims a task that was set back to `ready` after QA failure
- **THEN** `claim_task_with_binding` uses `create_worktree=False` (workspace_path already set)

### Requirement: Retry count visible on task card
The frontend SHALL display a retry badge (e.g., "🔄 2/3") on kanban task cards when `result.qa_retries > 0`.

#### Scenario: Card shows retry badge
- **WHEN** a task has `result.qa_retries = 2` and max is 3
- **THEN** the card displays "🔄 2/3" badge in the meta row