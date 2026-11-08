import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const EXAMPLE = 'examples/programs/ppl-alternating.json';
const NOTE = 'PITT Force – 20 single reps, pause 3–4 s each';

/** A fresh app opens onboarding; clear it first so it can't cover the import dialog. */
async function clearOnboarding(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('start-workout')).toBeVisible();
  const onboarding = page.getByTestId('onboarding-dialog');
  const shown = await onboarding
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    // The fixture's locator handler may dismiss it first; only a still-open dialog is a failure.
    await page
      .getByTestId('onboarding-skip')
      .click({ timeout: 2000 })
      .catch(() => expect(onboarding).toBeHidden());
  }
  await expect(onboarding).toBeHidden();
}

async function importExample(page: Page) {
  await clearOnboarding(page);
  await page.goto('/programs');
  await page.getByTestId('import-program-file').setInputFiles(EXAMPLE);
  const preview = page.getByTestId('import-program-preview');
  await expect(preview).toContainText('6 days · 34 exercises');
  await page.getByTestId('import-program-confirm').click();
  await expect(page).toHaveURL(/\/programs\/[^/]+$/);
}

test('imports the example program and shows its days', async ({ page }) => {
  await importExample(page);
  await expect(page.getByText('Imported. Set it as active to start using it.')).toBeVisible();
  await expect(page.getByTestId('program-day')).toHaveCount(6);
  const names = page.getByTestId('day-name');
  await expect(names).toHaveCount(6);
  const expected = ['Legs #1', 'Push #1', 'Pull #1', 'Legs #2', 'Push #2', 'Pull #2'];
  for (let i = 0; i < expected.length; i++) {
    await expect(names.nth(i)).toHaveValue(expected[i]);
  }
});

test('imported note shows on the workout card after starting the day', async ({ page }) => {
  await importExample(page);
  const activate = page.getByTestId('activate-program');
  await activate.click();
  await expect(activate).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await page.getByTestId('start-program-day').filter({ hasText: 'Legs #1' }).click();
  const card = page.getByTestId('exercise-card').filter({ hasText: 'Lying Leg Curl' }).first();
  await expect(card.getByTestId('exercise-note')).toHaveText(NOTE);
});

test('an edited note persists after reload', async ({ page }) => {
  await importExample(page);
  const row = page.getByTestId('program-exercise').nth(3);
  await expect(row.getByTestId('exercise-note')).toHaveText(NOTE);
  await row.getByTestId('edit-note').click();
  const input = row.getByTestId('note-input');
  await input.fill('Slow eccentric, 3 s down');
  await input.press('Enter');
  await expect(row.getByTestId('exercise-note')).toHaveText('Slow eccentric, 3 s down');
  await page.reload();
  await expect(page.getByTestId('program-exercise').nth(3).getByTestId('exercise-note')).toHaveText(
    'Slow eccentric, 3 s down',
  );
});

test('a broken file lists errors, imports nothing, and can be picked again', async ({ page }) => {
  const program = JSON.parse(readFileSync(EXAMPLE, 'utf8')) as {
    program: { days: { exercises: { exerciseId: string }[] }[] };
  };
  program.program.days[0].exercises[3].exerciseId = 'leg-curl';
  const file = {
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(program)),
  };

  await clearOnboarding(page);
  await page.goto('/programs');
  const items = page.getByTestId('program-item');
  await expect(items.first()).toBeVisible();
  const before = await items.count();

  const input = page.getByTestId('import-program-file');
  const errors = page.getByTestId('import-program-errors');
  await input.setInputFiles(file);
  await expect(errors).toContainText('unknown exercise "leg-curl"');
  await page.keyboard.press('Escape');
  await expect(errors).toBeHidden();
  // The app must reset the input so picking the same file again fires a change event.
  await expect(input).toHaveValue('');
  await expect(items).toHaveCount(before);

  await input.setInputFiles(file);
  await expect(errors).toContainText('unknown exercise "leg-curl"');
  await page.keyboard.press('Escape');
  await expect(items).toHaveCount(before);
});
