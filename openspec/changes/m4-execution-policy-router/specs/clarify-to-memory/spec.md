## ADDED Requirements

### Requirement: Clarify approval triggers memory write
The system SHALL automatically write the clarify content to memory when a clarify entry with `kind="plan"` or `kind="proposal"` is approved. The memory write MUST use the existing `/api/memory/write` logic with `source="clarify"` and the task ID as context key.

#### Scenario: Approving a plan saves to memory
- **WHEN** POST `/api/clarify/respond` is called with `response="approve"` on a clarify entry with `kind="plan"` and non-empty `content`
- **THEN** the plan content is written to memory with `source="clarify"`, `context_key=task_id`
- **AND** the clarify entry is resolved normally

#### Scenario: Rejecting a plan does NOT save to memory
- **WHEN** POST `/api/clarify/respond` is called with `response="reject"` on a clarify entry with `kind="plan"`
- **THEN** NO memory write occurs
- **AND** the task is moved to `planned` status if `task_id` is present in clarify data

#### Scenario: Approving proposal Phase 1 triggers Phase 2
- **WHEN** POST `/api/clarify/respond` is called with `response="approve"` on a `kind="proposal"` entry with `phase=1`
- **THEN** Phase 1 content is written to memory AND a new clarify entry for Phase 2 is submitted automatically

#### Scenario: Text clarify approval has no side effects
- **WHEN** POST `/api/clarify/respond` is called on a `kind="text"` entry (or no kind)
- **THEN** behavior is identical to pre-M4 (no memory write, no phase progression)