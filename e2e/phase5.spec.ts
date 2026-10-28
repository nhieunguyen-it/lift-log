import { readFileSync } from 'node:fs';
import { expect, rawTest } from './fixtures';
import {
  clearSetting,
  createProfileViaSwitcher,
  logQuickWorkout,
  nav,
  openAndSkipOnboarding,
  readSetting,
  switchViaSwitcher,
} from './profileHelpers';

const history = (page: import('@playwright/test').Page) =>
  nav(page).getByRole('link', { name: 'History' });

rawTest('profiles are isolated: unit and workouts stay in their own profile', async ({ page }) => {
  await openAndSkipOnboarding(page);
  await expect(page.getByTestId('profile-active-name')).toHaveText('Default');

  await createProfileViaSwitcher(page, 'Alt');
  await openAndSkipOnboarding(page);
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('unit-lbs').click();
  await expect(page.getByTestId('unit-lbs')).toHaveAttribute('aria-pressed', 'true');
  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await logQuickWorkout(page);
  await history(page).click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  await switchViaSwitcher(page, 'Default');
  await openAndSkipOnboarding(page);
  await history(page).click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByTestId('unit-kg')).toHaveAttribute('aria-pressed', 'true');

  // Each profile keeps its own data after a reload.
  await page.reload();
  await expect(page.getByTestId('profile-active-name')).toHaveText('Default');
  await expect(page.getByTestId('unit-kg')).toHaveAttribute('aria-pressed', 'true');
  await switchViaSwitcher(page, 'Alt');
  await expect(page.getByTestId('unit-lbs')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByTestId('profile-active-name')).toHaveText('Alt');
  await expect(page.getByTestId('unit-lbs')).toHaveAttribute('aria-pressed', 'true');
  await history(page).click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
});

rawTest(
  'delete flow: type-name confirm, not the active profile, others untouched',
  async ({ page }) => {
    await openAndSkipOnboarding(page);
    await logQuickWorkout(page);
    await createProfileViaSwitcher(page, 'Doomed');
    await openAndSkipOnboarding(page);
    await logQuickWorkout(page);

    await page.goto('/settings#profiles');
    const manager = page.locator('#profiles');
    // The active profile (Doomed) cannot be deleted.
    await expect(manager.getByRole('button', { name: 'Delete Doomed' })).toBeDisabled();

    await switchViaSwitcher(page, 'Default');
    await page.goto('/settings#profiles');
    await manager.getByRole('button', { name: 'Delete Doomed' }).click();
    const confirm = page.getByTestId('profile-delete-confirm');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('profile-delete-confirm-input').fill('doom');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('profile-delete-confirm-input').fill('Doomed');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(manager.getByText('Doomed')).toHaveCount(0);

    await history(page).click();
    await expect(page.getByTestId('history-item')).toHaveCount(1);
    const dbs = await page.evaluate<(string | undefined)[]>(
      `indexedDB.databases().then((l) => l.map((d) => d.name))`,
    );
    expect(dbs).toContain('lift-log');
    expect(dbs.filter((n) => n?.startsWith('lift-log-p-'))).toHaveLength(0);
  },
);

rawTest('onboarding runs per profile and does not touch Default flags', async ({ page }) => {
  await openAndSkipOnboarding(page);
  expect(await readSetting(page, 'lift-log', 'onboardingDone')).toBe(true);
  await clearSetting(page, 'lift-log', 'onboardingDone');

  await createProfileViaSwitcher(page, 'Fresh');
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-unit-lbs').click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('onboarding-dialog')).toBeHidden();

  // Default's flag is still cleared: onboarding was finished only in Fresh.
  expect(await readSetting(page, 'lift-log', 'onboardingDone')).toBeUndefined();
  await switchViaSwitcher(page, 'Default');
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
});

rawTest("what's new phase 5 shows once for Default, never for a new profile", async ({ page }) => {
  await openAndSkipOnboarding(page);
  await clearSetting(
    page,
    'lift-log',
    'whatsNewPhase3Seen',
    'whatsNewPhase4Seen',
    'whatsNewPhase5Seen',
  );
  await page.reload();
  const dlg = page.getByTestId('whats-new-dialog');
  await expect(dlg.getByRole('heading', { name: "What's new in phase 5" })).toBeVisible();
  await page.getByTestId('whats-new-dismiss').click();
  await expect(dlg).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('profile-switcher')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(dlg).toBeHidden();

  await createProfileViaSwitcher(page, 'Newbie');
  await openAndSkipOnboarding(page);
  await page.waitForTimeout(400);
  await expect(dlg).toBeHidden();
  await page.reload();
  await page.waitForTimeout(400);
  await expect(dlg).toBeHidden();
});

rawTest(
  'active-session guard: switching asks, the workout stays in its profile',
  async ({ page }) => {
    await openAndSkipOnboarding(page);
    await createProfileViaSwitcher(page, 'Other');
    await openAndSkipOnboarding(page);
    await switchViaSwitcher(page, 'Default');
    await openAndSkipOnboarding(page);

    await page.getByTestId('start-workout').click();
    await expect(page.getByTestId('session-status')).toBeVisible();
    await page.getByTestId('profile-switcher').click();
    await page
      .getByTestId('profile-sheet')
      .locator('[data-testid^="profile-item-"]')
      .filter({ hasText: 'Other' })
      .click();
    await expect(page.getByTestId('profile-guard-dialog')).toBeVisible();
    await expect(page.getByTestId('profile-active-name')).toHaveText('Default');
    await page.getByTestId('profile-guard-proceed').click();

    await expect(page.getByTestId('profile-active-name')).toHaveText('Other');
    await expect(page.getByTestId('start-workout')).toBeVisible();
    await expect(page.getByTestId('session-status')).toHaveCount(0);

    await switchViaSwitcher(page, 'Default');
    await expect(page.getByTestId('session-status')).toBeVisible();
  },
);

rawTest('import a backup into a new profile', async ({ page }) => {
  await openAndSkipOnboarding(page, '/settings');
  await page.getByTestId('profile-import-file').setInputFiles({
    name: 'phase5-export.json',
    mimeType: 'application/json',
    buffer: readFileSync('src/db/__fixtures__/phase5-export.json'),
  });
  await expect(page.getByTestId('profile-import-name')).toHaveValue('Fixture Lifter');
  await page.getByTestId('profile-import-confirm').click();
  await expect(page.getByTestId('profile-active-name')).toHaveText('Fixture Lifter');
  await history(page).click();
  await expect(page.getByTestId('history-item').first()).toBeVisible();

  await switchViaSwitcher(page, 'Default');
  await history(page).click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
});

rawTest('profile sheet renders in dark mode without horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openAndSkipOnboarding(page);
  await createProfileViaSwitcher(page, 'A really quite long prof');
  await openAndSkipOnboarding(page);
  await page.getByTestId('profile-switcher').click();
  const sheet = page.getByTestId('profile-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const overflow = await page.evaluate<number>(
    `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const box = (await sheet.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
