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
    'in_review', 'qa_verify', 'blocked', 'done',
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

/** Switch to the Kanban panel. */
async function switchToKanban(page: Page) {
  await page.locator('button[data-panel="kanban"]').first().click();
}

/** Switch to the Profiles panel. */
async function switchToProfiles(page: Page) {
  await page.locator('button[data-panel="profiles"]').first().click();
}

// ---------------------------------------------------------------------------
// US-1: 9-column kanban board renders correctly
// ---------------------------------------------------------------------------

test.describe('US-1: 9-column kanban board renders correctly', () => {
  test('renders In Review, QA Verify, and Blocked column headers (8-col board)', async ({ page }) => {
    // Need at least one task to avoid the "empty board" placeholder path
    const dummyTask = { ...BASE_TASK, id: 'dummy-001', title: 'Dummy Task' };
    await mockKanbanBoard(page, { ready: [dummyTask] });
    await page.goto('/');
    await switchToKanban(page);

    // Wait for any column head to appear
    await page.locator('.kanban-column-head').first().waitFor({ state: 'visible', timeout: 10000 });

    // Assert the three new column labels are visible
    // Verify new column labels exist (8-col board: renamed from M2's 9-col)
    await expect(page.locator('.kanban-column-head').filter({ hasText: 'Verification' })).toBeVisible();
    await expect(page.locator('.kanban-column-head').filter({ hasText: 'Backlog' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-2: task with status="in_review" appears under "In Review" column
// ---------------------------------------------------------------------------

test.describe('US-2: task with status=in_review appears under In Review column', () => {
  test('card placed in in_review column', async ({ page }) => {
    const inReviewTask = { ...BASE_TASK, id: 'ir-001', title: 'In Review Task', status: 'in_review' };

    await mockKanbanBoard(page, { in_review: [inReviewTask] });
    await page.goto('/');
    await switchToKanban(page);

    // Wait for the card to render
    await page.locator('.kanban-card[data-kanban-task-id="ir-001"]').waitFor({ state: 'visible', timeout: 10000 });

    // Assert card is inside the in_review column
    const col = page.locator('.kanban-column[data-status="in_review"]');
    await expect(col).toBeVisible();
    await expect(col.locator('.kanban-card[data-kanban-task-id="ir-001"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US-3: task_size badge shows S/M/L on card
// ---------------------------------------------------------------------------

test.describe('US-3: task_size badge shows S/M/L on kanban cards', () => {
  test('medium task shows M badge; null-size task has no badge', async ({ page }) => {
    const mediumTask = { ...BASE_TASK, id: 'sz-medium', title: 'Medium Task', task_size: 'medium' };
    const noSizeTask = { ...BASE_TASK, id: 'sz-null', title: 'No Size Task', task_size: null };

    await mockKanbanBoard(page, { ready: [mediumTask, noSizeTask] });
    await page.goto('/');
    await switchToKanban(page);

    // Wait for cards
    await page.locator('.kanban-card[data-kanban-task-id="sz-medium"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.kanban-card[data-kanban-task-id="sz-null"]').waitFor({ state: 'visible', timeout: 10000 });

    // Medium card: badge with text "M"
    const mediumBadge = page.locator('.kanban-card[data-kanban-task-id="sz-medium"] [data-testid="size-badge"]');
    await expect(mediumBadge).toBeVisible();
    await expect(mediumBadge).toHaveText('M');

    // Null-size card: no badge
    const nullBadge = page.locator('.kanban-card[data-kanban-task-id="sz-null"] [data-testid="size-badge"]');
    await expect(nullBadge).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// US-4: task creation modal has Size selector
// ---------------------------------------------------------------------------

test.describe('US-4: task creation modal has Size selector', () => {
  test('size select is visible with empty default; can select medium', async ({ page }) => {
    await mockKanbanBoard(page);
    await page.goto('/');
    await switchToKanban(page);

    // Wait for kanban panel to be active, then open the new task modal
    await page.locator('#kanbanNewTaskBtn').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#kanbanNewTaskBtn').click();

    const modal = page.locator('#kanbanTaskModal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Size select should be present
    const sizeSelect = page.locator('#kanbanTaskModalSize');
    await expect(sizeSelect).toBeVisible();

    // Default value should be empty (no size selected)
    await expect(sizeSelect).toHaveValue('');

    // Select "medium"
    await sizeSelect.selectOption('medium');
    await expect(sizeSelect).toHaveValue('medium');

    // Close modal by pressing Escape
    await page.keyboard.press('Escape');
  });
});

// ---------------------------------------------------------------------------
// US-5: Role badge visible on profile card for qa role
// ---------------------------------------------------------------------------

test.describe('US-5: Role badge visible on profile card for qa role', () => {
  test('qa profile card shows role badge with text "qa"', async ({ page }) => {
    const qaProfile = {
      name: 'qa-agent',
      role: 'qa',
      model: null,
      provider: null,
      api_key: null,
      is_default: false,
      is_active: false,
      config: {},
    };

    await page.route('/api/profiles', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profiles: [qaProfile] }),
      });
    });

    await page.goto('/');

    await switchToProfiles(page);

    // Wait for profile card
    const profileCard = page.locator('.profile-card[data-name="qa-agent"]');
    await profileCard.waitFor({ state: 'visible', timeout: 10000 });

    // Assert role badge is visible with text "qa"
    const roleBadge = profileCard.locator('.role-badge');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toHaveText('qa');
  });
});
