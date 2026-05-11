## ADDED Requirements

### Requirement: Auto-create QA task on in_review transition
The system SHALL automatically create a QA child task when a coder task transitions to `in_review` status. The QA task MUST inherit `workspace_path` and `tenant` from the parent task. The QA task MUST be linked as a child of the parent via `link_tasks`. The QA task MUST have `status="qa_verify"` and `assignee` set to the QA profile.

#### Scenario: Coder task enters in_review — QA task spawned
- **WHEN** PATCH status=in_review succeeds on a task with workspace_path set
- **THEN** a new QA task is created with title "QA: {parent_title}", status="qa_verify", same workspace_path
- **AND** the QA task is linked as child of the parent task

#### Scenario: QA task inherits workspace_path
- **WHEN** the QA task is created from a parent with workspace_path="/path/to/worktree"
- **THEN** the QA task has workspace_path="/path/to/worktree" and workspace_kind="worktree"

#### Scenario: in_review without workspace still spawns QA
- **WHEN** PATCH status=in_review on a task with workspace_path=null
- **THEN** QA task is still created (workspace_kind="scratch")

#### Scenario: QA spawn failure does not block status transition
- **WHEN** the QA task creation fails (e.g., DB error)
- **THEN** the parent task still transitions to in_review successfully