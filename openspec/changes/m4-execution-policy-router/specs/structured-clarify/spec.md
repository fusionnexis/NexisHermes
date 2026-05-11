## ADDED Requirements

### Requirement: Clarify kind field
The system SHALL support a `kind` field on clarify entries submitted via `submit_pending`. Valid values are `"text"` (default), `"plan"`, `"proposal"`. The `kind` field MUST be returned in `GET /api/clarify/pending` responses so the frontend can render appropriately.

#### Scenario: Default clarify kind is text
- **WHEN** `submit_pending` is called without a `kind` field
- **THEN** the clarify entry has `kind="text"` and the frontend renders it as a plain question

#### Scenario: Plan kind surfaces in clarify pending response
- **WHEN** `submit_pending` is called with `kind="plan"` and content containing Markdown
- **THEN** `GET /api/clarify/pending` returns `{kind: "plan", question: "...", content: "..."}` and frontend renders a plan card with Markdown formatting

#### Scenario: Proposal kind with phase
- **WHEN** `submit_pending` is called with `kind="proposal"`, `phase=1`, `phase_label="Design Review"`
- **THEN** `GET /api/clarify/pending` returns `{kind: "proposal", phase: 1, phase_label: "Design Review", content: "..."}`

### Requirement: Frontend clarify card rendering
The frontend SHALL render clarify entries with `kind="plan"` as a formatted Markdown document card in `static/messages.js`. For `kind="proposal"`, the card SHALL display the phase label and a "Approve" / "Reject" button pair. For `kind="text"`, existing rendering is unchanged.

#### Scenario: Plan card renders Markdown
- **WHEN** a clarify entry with `kind="plan"` is displayed in the chat
- **THEN** the clarify card shows the plan content formatted as Markdown (not raw text)

#### Scenario: Proposal card shows phase header
- **WHEN** a clarify entry with `kind="proposal"` and `phase=1` is displayed
- **THEN** the card shows "Phase 1: Design Review" as a header with Approve/Reject buttons