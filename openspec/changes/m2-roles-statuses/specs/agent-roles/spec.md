## ADDED Requirements

### Requirement: Session role field
The system SHALL store a `role` field on every Session object. The field MUST default to `"coder"` when not specified. Valid values are `"coder"`, `"qa"`, `"planner"`, `"reviewer"`. The `role` field MUST be persisted to the session JSON file and returned in all session API responses.

#### Scenario: New session defaults to coder role
- **WHEN** POST `/api/session/new` is called without a `role` field
- **THEN** the created session has `role="coder"` and the field is present in the response

#### Scenario: Session created with explicit role
- **WHEN** POST `/api/session/new` is called with `role="qa"`
- **THEN** the created session has `role="qa"` in the response

#### Scenario: Invalid role value rejected
- **WHEN** POST `/api/session/new` is called with `role="superagent"`
- **THEN** the system returns HTTP 400 with an error message

### Requirement: Profile config role key
The system SHALL read a `role` key from profile `config.yaml`. When the key is present, all sessions created under that profile SHALL default to that profile's role. When the key is absent, the default role is `"coder"`.

#### Scenario: Profile config drives session role
- **WHEN** the active profile's `config.yaml` contains `role: qa`
- **AND** POST `/api/session/new` is called without an explicit `role`
- **THEN** the created session has `role="qa"`

### Requirement: Role badge in session sidebar
The frontend SHALL display a role badge next to each session entry in the sidebar when `role` is not `"coder"` (coder is the default and shown without a badge to reduce noise). The badge MUST use distinct colors: `qa`=green, `planner`=purple, `reviewer`=orange.

#### Scenario: QA session shows role badge in sidebar
- **WHEN** a session with `role="qa"` is rendered in the session sidebar
- **THEN** a green badge labelled "qa" is visible next to the session title

#### Scenario: Coder session shows no role badge
- **WHEN** a session with `role="coder"` is rendered in the session sidebar
- **THEN** no role badge is displayed