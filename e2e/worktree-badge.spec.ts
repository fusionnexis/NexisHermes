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
    // Navigate first so route interception can take effect
    await page.goto('/');

    // Mock the kanban board API to return a task with workspace_kind="worktree"
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

    // Switch to kanban panel
    await switchToKanban(page);

    // Wait for the board to render
    await waitForKanbanBoard(page);

    // Find the worktree task card
    const wtCard = page.locator('.kanban-card[data-kanban-task-id="wt-001"]');
    await expect(wtCard).toBeVisible();

    // Assert: worktree badge is visible inside the card
    const badge = wtCard.locator('[data-testid="worktree-badge"]');
    await expect(badge).toBeVisible();

    // Assert: badge text contains the branch name (last segment of workspace_path)
    await expect(badge).toContainText('wt-feature-x');
  });
});

// ---------------------------------------------------------------------------
// US-2: No worktree badge on scratch tasks
// ---------------------------------------------------------------------------

test.describe('US-2: No worktree badge on scratch tasks', () => {
  test('scratch task does not show worktree badge', async ({ page }) => {
    await page.goto('/');

    // Mock the kanban board with a scratch task (default workspace_kind)
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

    // Find the scratch task card
    const scratchCard = page.locator('.kanban-card[data-kanban-task-id="scratch-001"]');
    await expect(scratchCard).toBeVisible();

    // Assert: no worktree badge exists in the scratch task card
    const badge = scratchCard.locator('[data-testid="worktree-badge"]');
    await expect(badge).toHaveCount(0);
  });

  test('task without workspace_kind does not show worktree badge', async ({ page }) => {
    await page.goto('/');

    // Mock the kanban board with a task that has no workspace_kind at all
    await mockKanbanBoard(page, [
      {
        id: 'plain-001',
        title: 'Plain task',
        status: 'ready',
        priority: 0,
        // workspace_kind is undefined/null (not set)
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
    // Start with a scratch task — no worktree badge
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

    // The worktree version of the same task
    const worktreeTask = {
      ...scratchTask,
      workspace_kind: 'worktree',
      workspace_path: '/Users/user/Code/project-wt-dynamic-branch',
    };

    await page.goto('/');

    // Initial mock: scratch task (no badge)
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

    // Mock SSE stream — after a delay, deliver an update event and then
    // return the worktree version on the next board fetch
    await page.route('/api/kanban/events/stream**', async (route: Route) => {
      // Return an SSE hello frame, then an events frame that triggers board refresh
      const helloFrame = 'event: hello\ndata: {"cursor":0,"board":null}\n\n';
      // After a short simulated delay, the SSE stream delivers an "updated" event
      // for the task — this causes the JS to re-fetch /api/kanban/board
      // which will now return the worktree version.
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

    // Initially, no worktree badge
    const card = page.locator('.kanban-card[data-kanban-task-id="dynamic-001"]');
    await expect(card).toBeVisible();
    const badgeBefore = card.locator('[data-testid="worktree-badge"]');
    await expect(badgeBefore).toHaveCount(0);

    // Simulate the SSE update: change mock data to worktree version
    // so the next board fetch returns the worktree badge
    currentTasks = [worktreeTask];

    // The SSE event triggers a board refresh via _scheduleKanbanRefresh.
    // Wait for the badge to appear (the board re-fetches automatically).
    const badgeAfter = card.locator('[data-testid="worktree-badge"]');
    await expect(badgeAfter).toBeVisible({ timeout: 10000 });
    await expect(badgeAfter).toContainText('wt-dynamic-branch');
  });
});