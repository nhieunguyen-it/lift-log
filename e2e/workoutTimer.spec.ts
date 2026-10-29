import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// With the clock paused, Dexie live queries only deliver when the clock moves.
// Nudge it 1 ms at a time until the assertion holds.
// Short per-attempt timeout: settle() does the retrying.
const quick = expect.configure({ timeout: 50 });
const settle = (page: Page, assertion: () => Promise<void>) =>
  expect(async () => {
    await page.clock.runFor(1);
    await assertion();
  }).toPass({ intervals: [10] });

test('timer ticks, pauses, auto-resumes on a ticked set, and survives reload', async ({ page }) => {
  const t0 = new Date('2026-10-29T18:00:00');
  await page.clock.install({ time: t0 });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Workout' })
    .click();
  await expect(page.getByTestId('start-workout')).toBeVisible();
  // Freeze real-time flow so the clock only moves through runFor(); t0 has
  // already passed, so pause a minute later. Live queries need a clock tick
  // to deliver, hence the 1 ms settle after each write.
  await page.clock.pauseAt(new Date(t0.getTime() + 60_000));
  await page.getByTestId('start-workout').click();
  const timer = page.getByTestId('workout-timer');
  await settle(page, () => quick(timer).toBeVisible());
  await expect(timer).toHaveText('00:00');
  await page.clock.runFor('01:05');
  await expect(timer).toHaveText('01:05');

  await page.getByTestId('pause-workout').click();
  await settle(page, () => quick(page.getByTestId('session-status')).toContainText('Paused'));
  await page.clock.runFor('10:00');
  await expect(timer).toHaveText('01:05');

  await page.reload();
  await settle(page, () => quick(page.getByTestId('resume-workout')).toBeVisible());
  await expect(timer).toHaveText('01:05');

  await page.getByTestId('resume-workout').click();
  await settle(page, () => quick(page.getByTestId('pause-workout')).toBeVisible());
  await page.clock.runFor('00:55');
  await expect(timer).toHaveText('02:00');

  // Pause, then log a set -> auto-resume.
  await page.getByTestId('pause-workout').click();
  await settle(page, () => quick(page.getByTestId('resume-workout')).toBeVisible());
  await page.clock.runFor('05:00');
  await expect(timer).toHaveText('02:00');

  // Everything stays on the frozen clock; each step settles before the next.
  const sel = (id: string) => page.getByTestId(id);
  await sel('add-exercise').click();
  await settle(page, () => quick(sel('picker-search')).toBeVisible());
  await sel('picker-search').fill('barbell bench press');
  const item = page
    .locator('[data-testid="picker-item"]', { hasText: 'Barbell Bench Press' })
    .first();
  await settle(page, () => quick(item).toBeVisible());
  await item.click();
  const card = page.getByTestId('exercise-card').first();
  await settle(page, () => quick(card).toBeVisible());
  await card.getByTestId('add-set').click();
  const row = card.getByTestId('set-row').first();
  await settle(page, () => quick(row).toBeVisible());
  await row.getByTestId('reps-input').fill('5');
  await row.getByTestId('done-checkbox').click();
  await settle(page, () => quick(sel('pause-workout')).toBeVisible());
  await expect(sel('session-status')).toContainText('In progress');
  await expect(timer).toHaveText('02:00');
  await page.clock.runFor('03:00');
  await expect(timer).toHaveText('05:00');

  await page.getByTestId('finish-workout').click();
  await page.getByTestId('finish-confirm').click();
  await settle(page, () => quick(page.getByTestId('summary-duration')).toContainText('5m'));
});
