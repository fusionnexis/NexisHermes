## Context

Hermes agents currently execute all tasks in the same workspace directory. The kanban task model has `workspace_kind` and `workspace_path` fields but they default to `"scratch"` and `None`. No mechanism exists to create isolated git worktrees for concurrent agent execution. The server uses Python stdlib (`http.server`) with procedural routing in `routes.py`, `subprocess.run` for git operations in `workspace.py`, and MCP tools registered via `TOOLS`/`HANDLERS` dicts in `mcp_server.py`.

## Goals / Non-Goals

**Goals:**
- Create/list/remove git worktrees via REST API endpoints (`/api/worktree/*`)
- Bind worktree path to kanban task on claim (populate `workspace_kind` and `workspace_path`)
- Expose worktree CRUD as MCP tools for external agent clients
- Show worktree status in kanban task cards (frontend)

**Non-Goals:**
- Merge workflow (that belongs to M6 — release gate)
- Agent role-based routing (that belongs to M3)
- DAG dependency enforcement (that belongs to M3)
- Worktree auto-provisioning on dispatch (deferred to M3 when binding is implemented)

## Decisions

### D1: Use `git worktree` CLI via subprocess (not libgit2)

**Why:** Hermes already uses `subprocess.run` for git operations in `api/workspace.py` (`_run_git` helper). Adding `libgit2` would introduce a new external dependency, violating the "minimal deps" principle (only `pyyaml`). The git CLI is universally available on server hosts where Hermes runs.

**Alternative considered:** `pygit2`/`libgit2` bindings — rejected because it's a C dependency that requires compilation and breaks the "no build step" philosophy.

### D2: Worktree CRUD as standalone module `api/worktree.py`

**Why:** Following the existing pattern where each domain has its own module (kanban → `kanban_bridge.py`, workspace → `workspace.py`, terminal → `terminal.py`). Worktree operations are distinct from general workspace file browsing, so they deserve their own module. The `worktree.py` module reuses `_run_git` patterns from `workspace.py` but adds worktree-specific logic.

### D3: Worktree IDs use human-readable names, not UUIDs

**Why:** Git worktree directories are identified by their path, and branches by their name. Using the kanban task ID as the worktree branch prefix (e.g., `task-{task_id}`) creates a natural mapping. This avoids an extra mapping table and keeps the state in git itself.

**Alternative considered:** UUID-based worktree IDs with a state file — rejected because git already tracks worktrees in `.git/worktrees/`; no extra state file needed.

### D4: Kanban binding via PATCH on task creation/claim, not automatic dispatch

**Why:** For M1, the binding happens when the user explicitly claims a task or creates a task with `workspace_kind="worktree"`. Automatic worktree provisioning on dispatch (claiming a `ready` task and automatically creating a worktree) is deferred to M3 where the task-to-execution binding is implemented. M1 provides the primitives; M3 wires them into the dispatch flow.

### D5: MCP tools use `_api_post` for mutations

**Why:** Following the existing MCP pattern where mutations go through the local HTTP API with password auth, while reads access the filesystem directly. This ensures all mutations go through the same validation/authorization path as browser-initiated requests.

## Risks / Trade-offs

- **[Git not available on host]** → Graceful degradation: `_run_git` returns `None` on failure. Worktree endpoints return `{"error": "git not available or not a git repo"}` with 503 status. MCP tools return error dict. No crash.
- **[Worktree directory cleanup race]** → `worktree_remove` calls `git worktree remove --force` after checking the worktree exists. If another process removes it first, the command fails gracefully and returns `{"error": "worktree not found"}`.
- **[Concurrent worktree creation on same branch]** → `git worktree add` fails if branch already exists. Return the error message from git as a 409 Conflict response.
- **[Disk space exhaustion from uncleaned worktrees]** → Mitigation: `worktree/list` endpoint returns worktree paths and sizes, enabling monitoring. A future cron job (M6) can auto-clean stale worktrees.
- **[Worktree operations on non-git workspace]** → Pre-check: all endpoints verify the workspace is a git repo before attempting worktree operations. Return 400 if not.

## Migration Plan

- No migration needed — this is purely additive. No existing data or API contracts change.
- The `workspace_kind` field on kanban tasks already exists with default `"scratch"`; new `"worktree"` value is additive.
- Deploy by pulling the branch and restarting the server — no config changes required.
- Rollback: remove the branch, restart server. No persistent state changes.