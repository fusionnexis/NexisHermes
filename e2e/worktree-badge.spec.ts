import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Switch to the Kanban panel via the sidebar rail. */
async function switchToKanban(page: Page) {
  await page.locator('button[data-panel="kanban"]').click();
}

/** Wait for the kanban board to render at least one card. */
async function waitForKanbanBoard(page: Page) {
  await page.locator('.kanban-card').first().waitFor({ state: 'visible', timeout: 10000 });
}

/** Mock /api/kanban/board to return a predictable set of tasks. */
async function mockKanbanBoard(
  page: Page,
  tasks: Array<Record<string, unknown>>,
) {
  const columns = [
    { name: 'triage', tasks: [] },
    { name: 'todo', tasks: [] },
    { name: 'ready', tasks: tasks },
    { name: 'running', tasks: [] },
    { name: 'blocked', tasks: [] },
    { name: 'done', tasks: [] },
  ];

  const boardPayload = {
    columns,
    tenants: [],
    assignees: [],
    latest_event_id: 0,
    changed: true,
    read_only: false,
    filters: { tenant: null, assignee: null, include_archived: false, only_mine: false, profile: null },
  };

  await page.route('/api/kanban/board', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(boardPayload),
    });
  });

  // Also mock SSE stream to avoid real connection errors
  await page.route('/api/kanban/events/stream**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: hello\ndata: {"cursor":0,"board":null}\n\n',
    });
  });
}

// ---------------------------------------------------------------------------
// US-1: Worktree badge visible on kanban task card
// ---------------------------------------------------------------------------

test.describe('US-1: Worktree badge visible on kanban task card', () => {
  test('shows worktree badge with branch name on worktree task', async ({ page }) => {
    await page.goto('/');

    await mockKanbanBoard(page, [
      {
        id: 'wt-001',
        title: 'Worktree task',
        status: 'ready',
        priority: 1,
        workspace_kind: 'worktree',
        workspace_path: '/Users/user/Code/project-wt-feature-x',
        assignee: null,
        tenant: null,
        body: null,
        link_counts: { parents: 0, children: 0 },
        comment_count: 0,
        age_seconds: 100,
        age: '2m',
        progress: null,
      },
    ]);

    await switchToKanban(page);
    await waitForKanbanBoard(page);

    const wtCard = page.locator('.kanban-card[data-kanban-task-id="wt-001"]');
    await expect(wtCard).toBeVisible();

    const badge = wtCard.locator('[data-testid="worktree-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('wt-feature-x');
  });
});

// ---------------------------------------------------------------------------
// US-2: No worktree badge on scratch tasks
// ---------------------------------------------------------------------------

test.describe('US-2: No worktree badge on scratch tasks', () => {
  test('scratch task does not show worktree badge', async ({ page }) => {
    await page.goto('/');

    await mockKanbanBoard(page, [
      {
        id: 'scratch-001',
        title: 'Scratch task',
        status: 'ready',
        priority: 0,
        workspace_kind: 'scratch',
        workspace_path: null,
        assignee: null,
        tenant: null,
        body: null,
        link_counts: { parents: 0, children: 0 },
        comment_count: 0,
        age_seconds: 200,
        age: '3m',
        progress: null,
      },
    ]);

    await switchToKanban(page);
    await waitForKanbanBoard(page);

    const scratchCard = page.locator('.kanban-card[data-kanban-task-id="scratch-001"]');
    await expect(scratchCard).toBeVisible();

    const badge = scratchCard.locator('[data-testid="worktree-badge"]');
    await expect(badge).toHaveCount(0);
  });

  test('task without workspace_kind does not show worktree badge', async ({ page }) => {
    await page.goto('/');

    await mockKanbanBoard(page, [
      {
        id: 'plain-001',
        title: 'Plain task',
        status: 'ready',
        priority: 0,
        workspace_path: null,
        assignee: null,
        tenant: null,
        body: null,
        link_counts: { parents: 0, children: 0 },
        comment_count: 0,
        age_seconds: 300,
        age: '5m',
        progress: null,
      },
    ]);

    await switchToKanban(page);
    await waitForKanbanBoard(page);

    const plainCard = page.locator('.kanban-card[data-kanban-task-id="plain-001"]');
    await expect(plainCard).toBeVisible();

    const badge = plainCard.locator('[data-testid="worktree-badge"]');
    await expect(badge).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// US-3: Worktree badge updates when task workspace changes (SSE-driven)
// ---------------------------------------------------------------------------

test.describe('US-3: Worktree badge updates when task workspace changes', () => {
  test('badge appears after SSE update changes workspace_kind to worktree', async ({ page }) => {
    const scratchTask = {
      id: 'dynamic-001',
      title: 'Dynamic task',
      status: 'ready',
      priority: 0,
      workspace_kind: 'scratch',
      workspace_path: null,
      assignee: null,
      tenant: null,
      body: null,
      link_counts: { parents: 0, children: 0 },
      comment_count: 0,
      age_seconds: 100,
      age: '2m',
      progress: null,
    };

    const worktreeTask = {
      ...scratchTask,
      workspace_kind: 'worktree',
      workspace_path: '/Users/user/Code/project-wt-dynamic-branch',
    };

    await page.goto('/');

    let currentTasks = [scratchTask];

    await page.route('/api/kanban/board', async (route: Route) => {
      const columns = [
        { name: 'triage', tasks: [] },
        { name: 'todo', tasks: [] },
        { name: 'ready', tasks: currentTasks },
        { name: 'running', tasks: [] },
        { name: 'blocked', tasks: [] },
        { name: 'done', tasks: [] },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns,
          tenants: [],
          assignees: [],
          latest_event_id: 0,
          changed: true,
          read_only: false,
          filters: { tenant: null, assignee: null, include_archived: false, only_mine: false, profile: null },
        }),
      });
    });

    await page.route('/api/kanban/events/stream**', async (route: Route) => {
      const helloFrame = 'event: hello\ndata: {"cursor":0,"board":null}\n\n';
      const eventFrame =
        'id: 1\n' +
        'event: events\n' +
        'data: {"events":[{"id":1,"task_id":"dynamic-001","kind":"updated","payload":{"fields":["workspace_kind","workspace_path"],"source":"webui"},"created_at":1000}],"cursor":1}\n\n';

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: helloFrame + eventFrame,
      });
    });

    await switchToKanban(page);
    await waitForKanbanBoard(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="dynamic-001"]');
    await expect(card).toBeVisible();
    const badgeBefore = card.locator('[data-testid="worktree-badge"]');
    await expect(badgeBefore).toHaveCount(0);

    // Simulate the SSE update: change mock data to worktree version
    currentTasks = [worktreeTask];

    const badgeAfter = card.locator('[data-testid="worktree-badge"]');
    await expect(badgeAfter).toBeVisible({ timeout: 10000 });
    await expect(badgeAfter).toContainText('wt-dynamic-branch');
  });
});

// ---------------------------------------------------------------------------
// US-4: Create Worktree button in task detail panel
// ---------------------------------------------------------------------------

test.describe('US-4: Create Worktree button in task detail', () => {
  test('scratch task detail shows Create Worktree button', async ({ page }) => {
    await page.goto('/');

    const scratchTask = {
      id: 'wt-create-001',
      title: 'Create WT test',
      status: 'ready',
      priority: 0,
      workspace_kind: 'scratch',
      workspace_path: null,
      assignee: null,
      tenant: null,
      body: null,
      link_counts: { parents: 0, children: 0 },
      comment_count: 0,
      age_seconds: 100,
      age: '2m',
      progress: null,
    };

    await mockKanbanBoard(page, [scratchTask]);

    // Mock task detail API
    await page.route('/api/kanban/tasks/wt-create-001', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          task: scratchTask,
          comments: [],
          events: [],
          links: { parents: [], children: [] },
          runs: [],
          read_only: false,
        }),
      });
    });

    // Mock task log API
    await page.route('/api/kanban/tasks/wt-create-001/log*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task_id: 'wt-create-001', path: '', exists: false, size_bytes: 0, content: '', truncated: false }),
      });
    });

    await switchToKanban(page);
    await waitForKanbanBoard(page);

    // Click on the task card to open detail
    const card = page.locator('.kanban-card[data-kanban-task-id="wt-create-001"]');
    await card.click();

    // Wait for task detail to render
    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible' });

    // Assert: "Create Worktree" button is visible in the detail
    const createBtn = page.locator('.kanban-detail-worktree >> button', { hasText: 'Create Worktree' });
    await expect(createBtn).toBeVisible();
  });

  test('worktree task detail shows Remove Worktree button and badge', async ({ page }) => {
    await page.goto('/');

    const worktreeTask = {
      id: 'wt-remove-001',
      title: 'Remove WT test',
      status: 'ready',
      priority: 0,
      workspace_kind: 'worktree',
      workspace_path: '/Users/user/Code/project-wt-remove-branch',
      assignee: null,
      tenant: null,
      body: null,
      link_counts: { parents: 0, children: 0 },
      comment_count: 0,
      age_seconds: 100,
      age: '2m',
      progress: null,
    };

    await mockKanbanBoard(page, [worktreeTask]);

    await page.route('/api/kanban/tasks/wt-remove-001', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          task: worktreeTask,
          comments: [],
          events: [],
          links: { parents: [], children: [] },
          runs: [],
          read_only: false,
        }),
      });
    });

    await page.route('/api/kanban/tasks/wt-remove-001/log*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task_id: 'wt-remove-001', path: '', exists: false, size_bytes: 0, content: '', truncated: false }),
      });
    });

    await switchToKanban(page);
    await waitForKanbanBoard(page);

    const card = page.locator('.kanban-card[data-kanban-task-id="wt-remove-001"]');
    await card.click();

    await page.locator('#kanbanTaskPreview').waitFor({ state: 'visible' });

    // Assert: worktree badge in detail panel shows branch name
    const detailBadge = page.locator('[data-testid="worktree-badge-detail"]');
    await expect(detailBadge).toBeVisible();
    await expect(detailBadge).toContainText('wt-remove-branch');

    // Assert: "Remove Worktree" button is visible
    const removeBtn = page.locator('.kanban-detail-worktree >> button', { hasText: 'Remove Worktree' });
    await expect(removeBtn).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-5: Workspace selector in task creation modal
// ---------------------------------------------------------------------------

test.describe('US-5: Workspace selector in task creation modal', () => {
  test('task creation modal has workspace selector with scratch and worktree options', async ({ page }) => {
    await page.goto('/');
    await switchToKanban(page);

    // Click the "+" button to open new task modal
    const addBtn = page.locator('.kanban-add-btn, [onclick*="openKanbanCreate"], button.kanban-header-add');
    // Try common selectors for the new task button
    const newTaskBtn = page.locator('button').filter({ hasText: /New task|✎|\+/ }).first();
    if (await newTaskBtn.isVisible()) {
      await newTaskBtn.click();
    } else {
      // Fallback: look for kanban modal trigger
      await page.evaluate(() => { if (typeof openKanbanCreate === 'function') openKanbanCreate(); });
    }

    // Wait for modal to appear
    const modal = page.locator('#kanbanTaskModal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Assert: workspace selector exists
    const wsSelect = page.locator('#kanbanTaskModalWorkspaceKind');
    await expect(wsSelect).toBeVisible();

    // Assert: default value is "scratch"
    await expect(wsSelect).toHaveValue('scratch');

    // Assert: worktree option is available
    const options = wsSelect.locator('option');
    await expect(options).toHaveCount(2);

    // Switch to worktree — should show sub-fields
    await wsSelect.selectOption('worktree');
    const wtFields = page.locator('#kanbanTaskModalWorktreeFields');
    await expect(wtFields).toBeVisible();

    // Assert: branch name input and create button are visible
    await expect(page.locator('#kanbanTaskModalWorktreeBranch')).toBeVisible();
    await expect(page.locator('#kanbanTaskModalWorktreeCreateBtn')).toBeVisible();

    // Switch back to scratch — sub-fields should hide
    await wsSelect.selectOption('scratch');
    await expect(page.locator('#kanbanTaskModalWorktreeFields')).toBeHidden();
  });
});