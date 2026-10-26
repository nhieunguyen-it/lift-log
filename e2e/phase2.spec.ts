import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const HOUR = 3_600_000;

interface Seed {
  sessions: { id: string; startedAt: number; finishedAt?: number }[];
  sessionExercises: { id: string; sessionId: string; exerciseId: string; order: number }[];
  sets: Record<string, unknown>[];
}

/** Monday 00:00 (local) of the week containing `now`. */
function mondayOf(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function benchSession(tag: string, startedAt: number, setCount: number, seed: Seed) {
  const sid = `s-${tag}`;
  const seId = `se-${tag}`;
  seed.sessions.push({ id: sid, startedAt, finishedAt: startedAt + HOUR });
  seed.sessionExercises.push({
    id: seId,
    sessionId: sid,
    exerciseId: 'barbell-bench-press',
    order: 0,
  });
  for (let i = 0; i < setCount; i++) {
    seed.sets.push({
      id: `set-${tag}-${i}`,
      sessionExerciseId: seId,
      order: i,
      weightKg: 80,
      reps: 8,
      isWarmup: false,
      completedAt: startedAt + (i + 1) * 5 * 60_000,
    });
  }
}

function makeBackup(): string {
  const monday = mondayOf(Date.now());
  const seed: Seed = { sessions: [], sessionExercises: [], sets: [] };
  const prev = monday - 7 * 24 * HOUR;
  // Previous week: 3 sessions x 4 bench sets (chest weight 1) = 12 sets.
  for (let i = 0; i < 3; i++) benchSession(`p${i}`, prev + (i * 2 + 1) * 24 * HOUR, 4, seed);
  // Current week: 4 sets, early Monday so it is never after the week boundary.
  benchSession('c0', monday + 60_000, 4, seed);
  return JSON.stringify({
    app: 'lift-log',
    version: 2,
    exportedAt: Date.now(),
    settings: { unit: 'kg', weekStartsOn: 1 },
    ...seed,
  });
}

async function importBackup(page: Page, json: string) {
  await page.goto('/');
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('import-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toContainText('Import complete');
}

const row = (page: Page, id: string) =>
  page.locator(`[data-testid="muscle-row"][data-muscle-id="${id}"]`);

test('analyze shows previous week optimal, current week below, untouched muscle none', async ({
  page,
}) => {
  await importBackup(page, makeBackup());
  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  await expect(page.getByTestId('body-map')).toBeVisible();

  // Current week: 4 chest sets < MEV 8.
  await expect(row(page, 'chest')).toHaveAttribute('data-status', 'below');
  await expect(row(page, 'calves')).toHaveAttribute('data-status', 'none');

  // Previous week: 12 chest sets (bench weight 1.0) = lower edge of MAV 12-18.
  await page.getByTestId('week-prev').click();
  await expect(row(page, 'chest')).toHaveAttribute('data-status', 'optimal');
  await expect(row(page, 'calves')).toHaveAttribute('data-status', 'none');
});

test('target chip fills the first set from history', async ({ page }) => {
  await importBackup(page, makeBackup());
  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('barbell bench press');
  await page
    .locator('[data-testid="picker-item"]', { hasText: 'Barbell Bench Press' })
    .first()
    .click();

  const card = page.getByTestId('exercise-card').first();
  const chip = card.getByTestId('target-chip');
  await expect(chip).toBeVisible();
  await chip.click();
  const first = card.getByTestId('set-row').first();
  await expect(first.getByTestId('weight-input')).not.toHaveValue('');
  await expect(first.getByTestId('weight-input')).not.toHaveValue('0');
  await expect(first.getByTestId('reps-input')).not.toHaveValue('');
  await expect(first.getByTestId('reps-input')).not.toHaveValue('0');
});

test('swap keeps logged set values', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('bench');
  await page.getByTestId('picker-item').first().click();
  const card = page.getByTestId('exercise-card').first();
  const oldName = await card.getByTestId('exercise-name').innerText();

  await card.getByTestId('add-set').click();
  const r = card.getByTestId('set-row').first();
  await r.getByTestId('weight-input').fill('62.5');
  await r.getByTestId('reps-input').fill('7');
  await r.getByTestId('done-checkbox').click();
  await expect(r.getByTestId('done-checkbox')).toHaveAttribute('data-state', 'checked');

  await card.getByTestId('swap-exercise').click();
  await expect(page.getByTestId('swap-dialog')).toBeVisible();
  const alt = page.getByTestId('alternative-item').first();
  await expect(alt).toBeVisible();
  const newName = (await alt.locator('span.font-medium').first().innerText()).trim();
  await alt.getByRole('button').click();

  await expect(card.getByTestId('exercise-name')).toHaveText(newName);
  expect(newName).not.toBe(oldName);
  const r2 = card.getByTestId('set-row').first();
  await expect(r2.getByTestId('weight-input')).toHaveValue('62.5');
  await expect(r2.getByTestId('reps-input')).toHaveValue('7');
  await expect(r2.getByTestId('done-checkbox')).toHaveAttribute('data-state', 'checked');
});

test('stale active session prompts to finish or discard', async ({ page }) => {
  const started = Date.now() - 20 * HOUR;
  const seed: Seed = { sessions: [], sessionExercises: [], sets: [] };
  benchSession('stale', started, 2, seed);
  delete seed.sessions[0].finishedAt;
  await importBackup(
    page,
    JSON.stringify({
      app: 'lift-log',
      version: 2,
      exportedAt: Date.now(),
      settings: { unit: 'kg' },
      ...seed,
    }),
  );
  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await expect(page.getByTestId('stale-session')).toBeVisible();
  await page.getByTestId('stale-finish').click();
  await expect(page.getByTestId('start-workout')).toBeVisible();
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  // Finished at the last completed set (10 minutes in), so duration is 10m.
  await expect(page.getByTestId('history-item')).toContainText('10m');
});

test('history shows an empty state', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
});
