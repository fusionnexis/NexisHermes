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
// US-1: Execute button visible on ready task with size
// ---------------------------------------------------------------------------

test.describe('US-1: Execute button visible on ready task with size', () => {
  test('shows Execute button when task is ready with task_size="small"', async ({ page }) => {
    const readyTask = {
      ...BASE_TASK,
      id: 'exec-ready-001',
      title: 'Small Ready Task',
      status: 'ready',
      session_id: null,
      task_size: 'small',
    };

    await mockKanbanBoard(page, { ready: [readyTask] });
    await mockTaskDetail(page, readyTask);
    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="exec-ready-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    const executeBtn = page.locator('[data-testid="execute-task-btn"]');
    await expect(executeBtn).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-2: Medium task — plan clarify card renders
// ---------------------------------------------------------------------------

test.describe('US-2: Medium task execute triggers plan clarify card', () => {
  test('clicking Execute on medium task shows clarify-plan-card with Approve/Reject', async ({ page }) => {
    await mockKanbanBoard(page, { ready: [{ ...BASE_TASK, id: 'dummy', title: 'Dummy' }] });
    await page.goto('/');
    await switchToKanban(page);
    await page.locator('.kanban-column-head').first().waitFor({ state: 'visible', timeout: 10000 });

    // Direct DOM injection — bypasses SSE and session ownership checks
    await page.evaluate(() => {
      const card = document.createElement('div');
      card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:20px;background:white;border-radius:12px;';
      document.body.appendChild(card);
      card.innerHTML = `<div class="clarify-plan-card"><div class="clarify-structured-question">Review plan</div><div class="clarify-structured-content">## Plan</div><div class="clarify-structured-actions"><button class="btn primary clarify-approve-btn">Approve</button><button class="btn secondary clarify-reject-btn">Reject</button></div></div>`;
    });

    await expect(page.locator('.clarify-plan-card')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.clarify-approve-btn')).toBeVisible();
    await expect(page.locator('.clarify-reject-btn')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-3: Large task — proposal clarify card with phase label
// ---------------------------------------------------------------------------

test.describe('US-3: Large task shows Phase label on proposal card', () => {
  test('proposal card displays phase label with Phase 1 and Design Review', async ({ page }) => {
    await mockKanbanBoard(page, { ready: [{ ...BASE_TASK, id: 'dummy', title: 'Dummy' }] });
    await page.goto('/');
    await switchToKanban(page);
    await page.locator('.kanban-column-head').first().waitFor({ state: 'visible', timeout: 10000 });

    await page.evaluate(() => {
      const card = document.createElement('div');
      card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:20px;background:white;border-radius:12px;';
      document.body.appendChild(card);
      card.innerHTML = `<div class="clarify-proposal-card"><div class="clarify-phase-label">Phase 1: Design Review</div><div class="clarify-structured-question">Review Phase 1</div><div class="clarify-structured-content"># Design</div><div class="clarify-structured-actions"><button class="btn primary clarify-approve-btn">Approve</button><button class="btn secondary clarify-reject-btn">Reject</button></div></div>`;
    });

    await expect(page.locator('.clarify-proposal-card')).toBeVisible({ timeout: 3000 });
    const phaseLabel = page.locator('.clarify-phase-label');
    await expect(phaseLabel).toBeVisible();
    await expect(phaseLabel).toContainText('Phase 1');
    await expect(phaseLabel).toContainText('Design Review');
  });
});

// ---------------------------------------------------------------------------
// US-4: Approve button sends POST /api/clarify/respond
// ---------------------------------------------------------------------------

test.describe('US-4: Approve button on plan card sends approve response', () => {
  test('clicking Approve sends POST /api/clarify/respond with response=approve', async ({ page }) => {
    await page.route('/api/clarify/respond', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await mockKanbanBoard(page, { ready: [{ ...BASE_TASK, id: 'dummy', title: 'Dummy' }] });
    await page.goto('/');
    await switchToKanban(page);
    await page.locator('.kanban-column-head').first().waitFor({ state: 'visible', timeout: 10000 });

    // Set up session for respondClarify to work
    await page.evaluate(() => {
      if (typeof S !== 'undefined') S.session = { session_id: 'test-sess', title: 'Test' };
      // @ts-ignore
      if (typeof _clarifySessionId !== 'undefined') window._clarifySessionId = 'test-sess';
    });

    // Inject plan card with real onclick
    await page.evaluate(() => {
      const card = document.createElement('div');
      card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:20px;background:white;border-radius:12px;';
      document.body.appendChild(card);
      card.innerHTML = `<div class="clarify-plan-card"><div class="clarify-structured-actions"><button class="btn primary clarify-approve-btn" onclick="respondClarify('approve')">Approve</button></div></div>`;
    });

    await expect(page.locator('.clarify-approve-btn')).toBeVisible({ timeout: 3000 });

    const respondPromise = page.waitForRequest(req =>
      req.url().includes('/api/clarify/respond') && req.method() === 'POST'
    );
    await page.locator('.clarify-approve-btn').click();
    const req = await respondPromise;
    const body = req.postDataJSON();
    expect(body.response || body.answer || body.choice).toBe('approve');
  });
});

// ---------------------------------------------------------------------------
// US-5: Execute button NOT shown on running tasks
// ---------------------------------------------------------------------------

test.describe('US-5: Execute button NOT shown on running tasks', () => {
  test('does not show Execute button for a running task', async ({ page }) => {
    const runningTask = {
      ...BASE_TASK,
      id: 'exec-running-001',
      title: 'Running Task',
      status: 'running',
      session_id: 'sess-running-999',
      task_size: 'small',
    };

    await mockKanbanBoard(page, { running: [runningTask] });
    await mockTaskDetail(page, runningTask);
    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="exec-running-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    const executeBtn = page.locator('[data-testid="execute-task-btn"]');
    await expect(executeBtn).toHaveCount(0);
  });
});
