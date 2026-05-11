## ADDED Requirements

### Requirement: MCP kanban_create_task tool
The system SHALL expose a `kanban_create_task` MCP tool that creates a kanban task via the WebUI API. Accepts `title` (required), `body`, `assignee`, `status`, `priority`, `task_size`, `tenant`. Authenticates via WebUI password.

#### Scenario: Create task via MCP
- **WHEN** MCP client calls `kanban_create_task` with `title="MCP task"`
- **THEN** a kanban task is created and the response contains `{task: {id, title, status}}`

### Requirement: MCP kanban_list_tasks tool
The system SHALL expose a `kanban_list_tasks` MCP tool that returns all tasks from the active board. Accepts optional `status` filter.

#### Scenario: List tasks filtered by status
- **WHEN** MCP client calls `kanban_list_tasks` with `status="ready"`
- **THEN** only tasks with `status="ready"` are returned

### Requirement: MCP kanban_update_task_status tool
The system SHALL expose a `kanban_update_task_status` MCP tool that updates a task's status via PATCH. Accepts `task_id` and `status`.

#### Scenario: Update task status via MCP
- **WHEN** MCP client calls `kanban_update_task_status` with `task_id` and `status="done"`
- **THEN** the task status is updated and the response confirms the change

### Requirement: MCP kanban_get_task tool
The system SHALL expose a `kanban_get_task` MCP tool that returns full task details including comments, events, and links.

#### Scenario: Get task detail via MCP
- **WHEN** MCP client calls `kanban_get_task` with `task_id`
- **THEN** the response contains `{task, comments, events, links}`