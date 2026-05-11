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
// US-2: Medium task execute triggers plan clarify card
// ---------------------------------------------------------------------------

test.describe('US-2: Medium task execute triggers plan clarify card', () => {
  test('clicking Execute on medium task shows clarify-plan-card with Approve/Reject', async ({ page }) => {
    const mediumTask = {
      ...BASE_TASK,
      id: 'exec-medium-001',
      title: 'Medium Task',
      status: 'ready',
      session_id: null,
      task_size: 'medium',
    };

    await mockKanbanBoard(page, { ready: [mediumTask] });
    await mockTaskDetail(page, mediumTask);

    // Mock execute endpoint returning medium route with clarify_pending
    await page.route('/api/kanban/execute', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          route: 'medium',
          clarify_pending: true,
          session: { session_id: 'sess-medium-abc123' },
        }),
      });
    });

    // Mock clarify SSE stream to push a plan card
    await page.route('**/api/clarify/stream**', async (route: Route) => {
      const sseBody = [
        'event: initial',
        `data: ${JSON.stringify({ pending: { kind: 'plan', question: 'Review plan?', choices: [], content: '## Plan\n- Step 1\n- Step 2' } })}`,
        '',
        '',
      ].join('\n');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      });
    });

    // Mock clarify/pending fallback endpoint
    await page.route('**/api/clarify/pending**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pending: { kind: 'plan', question: 'Review plan?', choices: [], content: '## Plan\n- Step 1\n- Step 2' },
        }),
      });
    });

    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="exec-medium-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    const executeBtn = page.locator('[data-testid="execute-task-btn"]');
    await expect(executeBtn).toBeVisible();
    await executeBtn.click();

    // Assert clarify plan card appears with Approve and Reject buttons
    const planCard = page.locator('.clarify-plan-card');
    await expect(planCard).toBeVisible({ timeout: 10000 });

    const approveBtn = page.locator('.clarify-approve-btn');
    await expect(approveBtn).toBeVisible();

    const rejectBtn = page.locator('.clarify-reject-btn');
    await expect(rejectBtn).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-3: Large task shows Phase label on proposal card
// ---------------------------------------------------------------------------

test.describe('US-3: Large task shows Phase label on proposal card', () => {
  test('proposal card displays phase label with Phase 1 and Design Review', async ({ page }) => {
    const largeTask = {
      ...BASE_TASK,
      id: 'exec-large-001',
      title: 'Large Task',
      status: 'ready',
      session_id: null,
      task_size: 'large',
    };

    await mockKanbanBoard(page, { ready: [largeTask] });
    await mockTaskDetail(page, largeTask);

    // Mock execute endpoint returning large route
    await page.route('/api/kanban/execute', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          route: 'large',
          clarify_pending: true,
          session: { session_id: 'sess-large-xyz789' },
        }),
      });
    });

    // Mock clarify SSE stream to push a proposal card with phase label
    await page.route('**/api/clarify/stream**', async (route: Route) => {
      const sseBody = [
        'event: initial',
        `data: ${JSON.stringify({ pending: { kind: 'proposal', phase: 1, phase_label: 'Design Review', question: 'Review proposal?', choices: [], content: '## Proposal\n- Architecture design' } })}`,
        '',
        '',
      ].join('\n');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      });
    });

    // Mock clarify/pending fallback
    await page.route('**/api/clarify/pending**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pending: { kind: 'proposal', phase: 1, phase_label: 'Design Review', question: 'Review proposal?', choices: [], content: '## Proposal\n- Architecture design' },
        }),
      });
    });

    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="exec-large-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    const executeBtn = page.locator('[data-testid="execute-task-btn"]');
    await expect(executeBtn).toBeVisible();
    await executeBtn.click();

    // Assert proposal card with phase label is visible
    const proposalCard = page.locator('.clarify-proposal-card');
    await expect(proposalCard).toBeVisible({ timeout: 10000 });

    const phaseLabel = page.locator('.clarify-phase-label');
    await expect(phaseLabel).toBeVisible();
    await expect(phaseLabel).toContainText('Phase 1');
    await expect(phaseLabel).toContainText('Design Review');
  });
});

// ---------------------------------------------------------------------------
// US-4: Approve button on plan card sends correct API call
// ---------------------------------------------------------------------------

test.describe('US-4: Approve button on plan card sends approve response', () => {
  test('clicking Approve sends POST /api/clarify/respond with response="approve"', async ({ page }) => {
    const mediumTask = {
      ...BASE_TASK,
      id: 'exec-approve-001',
      title: 'Approve Task',
      status: 'ready',
      session_id: null,
      task_size: 'medium',
    };

    await mockKanbanBoard(page, { ready: [mediumTask] });
    await mockTaskDetail(page, mediumTask);

    // Mock execute endpoint
    await page.route('/api/kanban/execute', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          route: 'medium',
          clarify_pending: true,
          session: { session_id: 'sess-approve-def456' },
        }),
      });
    });

    // Mock clarify SSE stream
    await page.route('**/api/clarify/stream**', async (route: Route) => {
      const sseBody = [
        'event: initial',
        `data: ${JSON.stringify({ pending: { kind: 'plan', question: 'Approve this plan?', choices: [], content: '## Plan\n- Implementation steps' } })}`,
        '',
        '',
      ].join('\n');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      });
    });

    // Mock clarify/pending fallback
    await page.route('**/api/clarify/pending**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pending: { kind: 'plan', question: 'Approve this plan?', choices: [], content: '## Plan\n- Implementation steps' },
        }),
      });
    });

    // Mock clarify respond endpoint
    await page.route('/api/clarify/respond', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await switchToKanban(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="exec-approve-001"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible', timeout: 10000 });

    const executeBtn = page.locator('[data-testid="execute-task-btn"]');
    await expect(executeBtn).toBeVisible();
    await executeBtn.click();

    // Wait for clarify plan card to appear
    const approveBtn = page.locator('.clarify-approve-btn');
    await expect(approveBtn).toBeVisible({ timeout: 10000 });

    // Capture the network request when clicking Approve
    const respondRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/clarify/respond') && req.method() === 'POST',
    );

    await approveBtn.click();

    const respondRequest = await respondRequestPromise;
    const body = JSON.parse(respondRequest.postData() || '{}');
    expect(body.response).toBe('approve');
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
