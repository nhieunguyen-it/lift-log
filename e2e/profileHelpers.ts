import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

/** Opens the app and skips onboarding if it shows (used with `rawTest`). */
export async function openAndSkipOnboarding(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByTestId('profile-switcher')).toBeVisible();
  const skip = page.getByTestId('onboarding-skip');
  try {
    await skip.waitFor({ state: 'visible', timeout: 1500 });
    await skip.click();
  } catch {
    // Not shown (already done for this profile).
  }
  await expect(page.getByTestId('onboarding-dialog')).toBeHidden();
}

/** Creates a profile through the header switcher; the page reloads into it. */
export async function createProfileViaSwitcher(page: Page, name: string) {
  await page.getByTestId('profile-switcher').click();
  await page.getByTestId('profile-new').click();
  await page.getByTestId('profile-name-input').fill(name);
  await page.getByTestId('profile-create').click();
  await expect(page.getByTestId('profile-active-name')).toHaveText(name);
}

/** Switches via the header switcher by profile display name; waits for the reload. */
export async function switchViaSwitcher(page: Page, name: string) {
  await page.getByTestId('profile-switcher').click();
  await page
    .getByTestId('profile-sheet')
    .locator('[data-testid^="profile-item-"]')
    .filter({ hasText: name })
    .click();
  await expect(page.getByTestId('profile-active-name')).toHaveText(name);
}

export async function fillSetRow(
  row: ReturnType<Page['getByTestId']>,
  w: string,
  r: string,
  rir: string,
) {
  await row.getByTestId('weight-input').fill(w);
  await row.getByTestId('reps-input').fill(r);
  await row.getByTestId('rir-input').fill(rir);
  await row.getByTestId('done-checkbox').click();
  await expect(row.getByTestId('done-checkbox')).toHaveAttribute('data-state', 'checked');
}

/** Adds an exercise via the picker and logs `n` new sets on its card. */
export async function addExerciseWithSets(page: Page, query: string, n: number) {
  const before = await page.getByTestId('exercise-card').count();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill(query);
  await page.getByTestId('picker-item').first().click();
  const card = page.getByTestId('exercise-card').nth(before);
  await expect(card).toBeVisible();
  for (let i = 0; i < n; i++) {
    await card.getByTestId('add-set').click();
    await expect(card.getByTestId('set-row')).toHaveCount(i + 1);
    await fillSetRow(card.getByTestId('set-row').nth(i), '100', '5', '2');
  }
}

export async function finishWorkout(page: Page) {
  await page.getByTestId('finish-workout').click();
  await page.getByTestId('finish-confirm').click();
  await page.getByTestId('summary-done').click();
  await expect(page.getByTestId('start-workout')).toBeVisible();
}

export async function logQuickWorkout(page: Page, query = 'bench', sets = 2) {
  await page.getByTestId('start-workout').click();
  await addExerciseWithSets(page, query, sets);
  await finishWorkout(page);
}

/** Deletes settings keys from a profile database (default `lift-log`). */
export async function clearSetting(page: Page, dbName: string, ...keys: string[]) {
  await page.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open(${JSON.stringify(dbName)});
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const idb = open.result;
      const tx = idb.transaction('settings', 'readwrite');
      for (const k of ${JSON.stringify(keys)}) tx.objectStore('settings').delete(k);
      tx.oncomplete = () => { idb.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
}

/** Reads one settings value from a profile database. */
export async function readSetting(page: Page, dbName: string, key: string): Promise<unknown> {
  return page.evaluate(
    `new Promise((resolve, reject) => {
      const open = indexedDB.open(${JSON.stringify(dbName)});
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const idb = open.result;
        const req = idb.transaction('settings').objectStore('settings').get(${JSON.stringify(key)});
        req.onsuccess = () => { idb.close(); resolve(req.result ? req.result.value : undefined); };
        req.onerror = () => reject(req.error);
      };
    })`,
  );
}
