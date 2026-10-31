import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function addExercise(page: Page, query: string) {
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill(query);
  await page.getByTestId('picker-item').first().click();
}

async function startWithRunning(page: Page) {
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await addExercise(page, 'Running');
  return page.getByTestId('exercise-card').first();
}

test('log a running entry by minutes and intensity', async ({ page }) => {
  const card = await startWithRunning(page);
  await expect(card.getByTestId('add-entry')).toBeVisible();
  await expect(card.getByTestId('add-set')).toHaveCount(0);
  await expect(card.getByTestId('swap-exercise')).toHaveCount(0);
  await expect(card.getByTestId('weight-input')).toHaveCount(0);
  await expect(card.getByText('Reps', { exact: true })).toHaveCount(0);

  await card.getByTestId('add-entry').click();
  const entry = card.getByTestId('cardio-entry');
  await expect(entry).toHaveCount(1);
  await expect(entry.getByTestId('cardio-intensity-relaxed')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await entry.getByTestId('cardio-minutes').fill('30');
  await entry.getByTestId('cardio-minutes').blur();
  await expect(entry.getByTestId('cardio-estimate')).toHaveText('≈ 4.3 km · 7:00 /km');
  await entry.getByTestId('cardio-intensity-hard').click();
  await expect(entry.getByTestId('cardio-estimate')).toHaveText('≈ 6.0 km · 5:00 /km');

  await entry.getByTestId('cardio-done').click();
  await expect(entry.getByTestId('cardio-done')).toHaveAttribute('data-state', 'checked');

  // Clearing minutes un-completes the entry.
  await entry.getByTestId('cardio-minutes').fill('');
  await entry.getByTestId('cardio-minutes').blur();
  await expect(entry.getByTestId('cardio-done')).toHaveAttribute('data-state', 'unchecked');
  await expect(entry.getByTestId('cardio-estimate')).toHaveCount(0);
});

test('removing a cardio card asks for confirmation', async ({ page }) => {
  const card = await startWithRunning(page);
  await card.getByTestId('add-entry').click();
  let message = '';
  page.once('dialog', (d) => {
    message = d.message();
    void d.accept();
  });
  await card.getByTestId('remove-exercise').click();
  await expect(page.getByTestId('exercise-card')).toHaveCount(0);
  expect(message).toContain('Remove exercise');
});

test('picker shows the cardio badge', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('Running');
  await expect(page.getByTestId('picker-item').first().getByTestId('cardio-badge')).toBeVisible();
});

test('swimming detail shows placeholder and cardio history, no e1RM chart', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await addExercise(page, 'Swimming (Freestyle)');
  await page.getByTestId('exercise-info').click();
  const dlg = page.getByTestId('exercise-detail');
  await expect(dlg.getByTestId('no-photos')).toBeVisible();
  await expect(dlg.getByTestId('cardio-history')).toBeVisible();
  await expect(dlg.getByTestId('exercise-e1rm')).toHaveCount(0);
});

test('cardio minutes credit quads in the Analyze detail sheet', async ({ page }) => {
  const card = await startWithRunning(page);
  await card.getByTestId('add-entry').click();
  const entry = card.getByTestId('cardio-entry');
  await entry.getByTestId('cardio-minutes').fill('30');
  await entry.getByTestId('cardio-minutes').blur();
  await entry.getByTestId('cardio-done').click();
  await expect(entry.getByTestId('cardio-done')).toHaveAttribute('data-state', 'checked');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Analyze' })
    .click();
  await page.getByRole('button', { name: /^Quads 3 sets/ }).click();
  await expect(page.getByTestId('contributions')).toContainText('Running · 30 min → 3.0 sets');
});
