import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, rawTest, test } from './fixtures';

// Mirrors src/program/templates.ts FULL_BODY day 1 (e2e can't import src via the '@' alias).
const FULL_BODY = {
  name: 'Full Body 3x/week',
  days: [
    {
      exercises: [
        { exerciseId: 'barbell-back-squat', targetSets: 4 },
        { exerciseId: 'incline-dumbbell-press', targetSets: 4 },
        { exerciseId: 'pull-up', targetSets: 4 },
        { exerciseId: 'close-grip-bench-press', targetSets: 3 },
        { exerciseId: 'leg-press', targetSets: 4 },
        { exerciseId: 'push-up', targetSets: 4 },
        { exerciseId: 'face-pull', targetSets: 4 },
        { exerciseId: 'dumbbell-bicep-curl', targetSets: 3 },
        { exerciseId: 'russian-twist', targetSets: 4 },
      ],
    },
  ],
};

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const exerciseNames = new Map(
  (
    JSON.parse(readFileSync('src/data/exercises.json', 'utf8')) as { id: string; name: string }[]
  ).map((e) => [e.id, e.name]),
);

async function logSets(page: Page, cardIndex: number, n: number, rir = 2) {
  const card = page.getByTestId('exercise-card').nth(cardIndex);
  for (let i = 0; i < n; i++) {
    await card.getByTestId('add-set').click();
    await expect(card.getByTestId('set-row')).toHaveCount(i + 1);
    const row = card.getByTestId('set-row').nth(i);
    await row.getByTestId('weight-input').fill('20');
    await row.getByTestId('reps-input').fill('10');
    await row.getByTestId('rir-input').fill(String(rir));
    await row.getByTestId('done-checkbox').click();
    await expect(row.getByTestId('done-checkbox')).toHaveAttribute('data-state', 'checked');
  }
}

async function finish(page: Page) {
  await page.getByTestId('finish-workout').click();
  await page.getByTestId('finish-confirm').click();
  await page.getByTestId('summary-done').click();
  await expect(page.getByTestId('start-workout')).toBeVisible();
}

test('program from template: duplicate, activate, start Day 1', async ({ page }) => {
  await page.goto('/programs');
  await page.getByRole('button', { name: `Duplicate ${FULL_BODY.name}` }).click();
  await expect(page.getByTestId('program-editor')).toBeVisible();
  await page.getByTestId('activate-program').click();
  await expect(page.getByTestId('activate-program')).toHaveAttribute('aria-pressed', 'true');

  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await page.getByRole('button', { name: /^Start Day 1/ }).click();

  const day = FULL_BODY.days[0];
  const cards = page.getByTestId('exercise-card');
  await expect(cards).toHaveCount(day.exercises.length);
  for (const [i, pe] of day.exercises.entries()) {
    const card = cards.nth(i);
    await expect(card.getByTestId('exercise-name')).toHaveText(exerciseNames.get(pe.exerciseId)!);
    await expect(card.getByTestId('set-row')).toHaveCount(pe.targetSets);
    await expect(card.getByTestId('reps-input').first()).toHaveValue('');
    await expect(card.getByTestId('done-checkbox').first()).not.toHaveAttribute(
      'data-state',
      'checked',
    );
  }
});

test('custom exercise counts toward analyzed muscles', async ({ page }) => {
  await page.goto('/exercises');
  await page.getByTestId('new-exercise').click();
  const dlg = page.getByTestId('custom-exercise-dialog');
  await dlg.getByTestId('custom-name').fill('Zottman Test Curl');
  await dlg.getByLabel('Muscle 1', { exact: true }).selectOption({ label: 'Biceps' });
  await dlg.getByTestId('custom-add-muscle').click();
  await dlg.getByLabel('Muscle 2', { exact: true }).selectOption({ label: 'Forearms' });
  await dlg.getByLabel('Muscle 2 weight').selectOption({ label: '50%' });
  await dlg.getByTestId('custom-save').click();
  await expect(dlg).toBeHidden();

  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('Zottman');
  await page.getByTestId('picker-item').first().click();
  await logSets(page, 0, 3, 2);
  await finish(page);

  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  const biceps = page.locator('[data-testid="muscle-row"][data-muscle-id="biceps"]');
  await expect(biceps).toContainText(/^Biceps\s*3 \//);
  await expect(biceps).not.toHaveAttribute('data-status', 'none');
  const forearms = page.locator('[data-testid="muscle-row"][data-muscle-id="forearms"]');
  await expect(forearms).toContainText(/Forearms\s*1\.5 \//);
});

test('encrypted export round-trip with wrong and correct passphrase', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('bench');
  await page.getByTestId('picker-item').first().click();
  await logSets(page, 0, 2);
  await finish(page);

  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('export-passphrase').fill('correct horse');
  await page.getByTestId('export-passphrase-confirm').fill('correct horse');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click(),
  ]);
  expect(download.suggestedFilename()).toContain('encrypted');
  const path = await download.path();
  const file = { name: 'enc.json', mimeType: 'application/json', buffer: readFileSync(path) };
  expect(file.buffer.toString()).not.toContain('barbell');

  // Wipe local data by importing an empty backup so the round trip is observable.
  await page.getByTestId('import-file').setInputFiles({
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'lift-log',
        version: 2,
        exportedAt: Date.now(),
        settings: { unit: 'kg' },
        sessions: [],
        sessionExercises: [],
        sets: [],
      }),
    ),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toContainText('Import complete');
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-empty')).toBeVisible();

  // Wrong passphrase: error, data unchanged.
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('import-file').setInputFiles(file);
  await page.getByTestId('import-passphrase').fill('wrong passphrase');
  await page.getByTestId('import-passphrase-submit').click();
  await expect(page.getByTestId('import-passphrase-error')).toBeVisible();
  await expect(page.getByTestId('import-dialog')).toBeHidden();
  await page.keyboard.press('Escape');
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-empty')).toBeVisible();

  // Correct passphrase imports.
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('import-file').setInputFiles(file);
  await page.getByTestId('import-passphrase').fill('correct horse');
  await page.getByTestId('import-passphrase-submit').click();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toContainText('Import complete');
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
});

test('guide opens offline from the Analyze help button', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.reload();
  await expect.poll(() => page.evaluate('!!navigator.serviceWorker.controller')).toBe(true);
  // Visit the guide once online so its lazy chunk is available, then return.
  await page.goto('/guide');
  await expect(page.getByTestId('guide-search')).toBeVisible();
  await page.goto('/analyze');

  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('help-analyze-statuses').click();
  await expect(page).toHaveURL(/\/guide#analyze-statuses$/);
  const heading = page.locator('#analyze-statuses');
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();

  const img = page.locator('img[src*="/guide/"]').first();
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(() => img.evaluate((el) => (el as unknown as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0);
  await context.setOffline(false);
});

rawTest('onboarding shows on a fresh app, can be skipped and replayed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await page.getByTestId('onboarding-skip').click();
  await expect(page.getByTestId('onboarding-dialog')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('start-workout')).toBeVisible();
  await expect(page.getByTestId('onboarding-dialog')).toBeHidden();

  await page.goto('/guide');
  await page.getByTestId('guide-replay-onboarding').click();
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Lift Log' })).toBeVisible();
});
