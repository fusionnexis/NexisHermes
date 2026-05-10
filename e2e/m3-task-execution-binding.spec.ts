import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_TASK = {
  id: 'task-001',
  title: 'Test task',
  status: 'ready',
  priority: 0,
  workspace_kind: 'scratch',
  workspace_path: null,
  session_id: null,
  assignee: null,
  tenant: null,
  body: null,
  task_size: null,
  link_counts: { parents: 0, children: 0 },
  comment_count: 0,
  age_seconds: 100,
  age: '2m',
  progress: null,
};

/** Build a board payload with 9 columns. */
function buildBoardPayload(columnTaskMap: Record<string, Array<Record<string, unknown>>> = {}) {
  const columnNames = [
    'triage', 'todo', 'ready', 'running', 'blocked',
    'in_review', 'qa_verify', 'release_ready', 'done',
  ];
  const columns = columnNames.map(name => ({
    name,
    tasks: columnTaskMap[name] || [],
  }));
  return {
    columns,
    tenants: [],
    assignees: [],
    latest_event_id: 0,
    changed: true,
    read_only: false,
    filters: { tenant: null, assignee: null, include_archived: false, only_mine: false, profile: null },
  };
}

/** Mock /api/kanban/board and /api/kanban/events/stream. */
async function mockKanbanBoard(
  page: Page,
  columnTaskMap: Record<string, Array<Record<string, unknown>>> = {},
) {
  await page.route('/api/kanban/board', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildBoardPayload(columnTaskMap)),
    });
  });

  await page.route('/api/kanban/events/stream**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: hello\ndata: {"cursor":0,"board":null}\n\n',
    });
  });
}

/** Mock task detail and log endpoints for a given task. */
async function mockTaskDetail(page: Page, task: Record<string, unknown>) {
  const taskId = task.id as string;

  await page.route(`/api/kanban/tasks/${taskId}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        task,
        comments: [],
        events: [],
        links: { parents: [], children: [] },
        runs: [],
        read_only: false,
      }),
    });
  });

  await page.route(`/api/kanban/tasks/${taskId}/log*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        task_id: taskId,
        path: '',
        exists: false,
        size_bytes: 0,
        content: '',
        truncated: false,
      }),
    });
  });
}

/** Switch to the Kanban panel. */
async function switchToKanban(page: Page) {
  await page.locator('button[data-panel="kanban"]').first().click();
}

// ---------------------------------------------------------------------------
// US-1: Claim Task button visible on ready task detail
// ---------------------------------------------------------------------------

test.describe('US-1: Claim Task button visible on ready task detail', () => {
  test('shows Claim Task button when task is ready with no session_id', async ({ page }) => {
    const readyTask = { ...BASE_TASK, id: 'claim-ready-001', title: 'Ready Task', status: 'ready', session_id: null };

    await mockKanbanBoard(page, { ready: [readyTask] });
    await mockTaskDetail(page, readyTask);
    await page.goto('/');
    await switchToKanban(page);

    // Wait for card and click it
    const card = page.locator('.kanban-card[data-kanban-task-id="claim-ready-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    // Wait for task detail panel
    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    // Assert Claim Task button is visible
    const claimBtn = page.locator('[data-testid="claim-task-btn"]');
    await expect(claimBtn).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-2: Claim Task button NOT shown on non-ready tasks
// ---------------------------------------------------------------------------

test.describe('US-2: Claim Task button not shown on running task detail', () => {
  test('does not show Claim Task button for a running task', async ({ page }) => {
    const runningTask = { ...BASE_TASK, id: 'claim-running-001', title: 'Running Task', status: 'running', session_id: null };

    await mockKanbanBoard(page, { running: [runningTask] });
    await mockTaskDetail(page, runningTask);
    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="claim-running-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    const claimBtn = page.locator('[data-testid="claim-task-btn"]');
    await expect(claimBtn).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// US-3: Session badge on task card with session_id
// ---------------------------------------------------------------------------

test.describe('US-3: Session badge on task card with session_id', () => {
  test('shows session badge with first 6 chars of session_id', async ({ page }) => {
    const sessionTask = {
      ...BASE_TASK,
      id: 'session-badge-001',
      title: 'Session Task',
      status: 'ready',
      session_id: 'abc123def456',
    };

    await mockKanbanBoard(page, { ready: [sessionTask] });
    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="session-badge-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });

    const badge = card.locator('[data-testid="session-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('abc123');
  });
});

// ---------------------------------------------------------------------------
// US-4: No session badge on task without session_id
// ---------------------------------------------------------------------------

test.describe('US-4: No session badge on task without session_id', () => {
  test('card without session_id has no session badge', async ({ page }) => {
    const noSessionTask = {
      ...BASE_TASK,
      id: 'no-session-001',
      title: 'No Session Task',
      status: 'ready',
      session_id: null,
    };

    await mockKanbanBoard(page, { ready: [noSessionTask] });
    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="no-session-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });

    const badge = card.locator('[data-testid="session-badge"]');
    await expect(badge).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// US-5: Claim button triggers POST /api/kanban/claim
// ---------------------------------------------------------------------------

test.describe('US-5: Claim button triggers POST /api/kanban/claim', () => {
  test('clicking Claim Task sends POST with correct task_id', async ({ page }) => {
    const claimTask = {
      ...BASE_TASK,
      id: 'claim-post-001',
      title: 'Claimable Task',
      status: 'ready',
      session_id: null,
    };

    await mockKanbanBoard(page, { ready: [claimTask] });
    await mockTaskDetail(page, claimTask);

    // Mock the claim endpoint
    await page.route('/api/kanban/claim', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="claim-post-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    // Set up request capture BEFORE clicking the button
    const claimRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/kanban/claim') && req.method() === 'POST',
    );

    const claimBtn = page.locator('[data-testid="claim-task-btn"]');
    await expect(claimBtn).toBeVisible();
    await claimBtn.click();

    const claimRequest = await claimRequestPromise;
    const body = JSON.parse(claimRequest.postData() || '{}');
    expect(body.task_id).toBe('claim-post-001');
  });
});
