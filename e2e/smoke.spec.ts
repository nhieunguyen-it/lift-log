import { expect, test } from '@playwright/test';

const nav = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Primary' });

test('log a workout, finish, history, reload, switch to lbs', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-workout').click();

  for (const query of ['bench', 'squat']) {
    await page.getByTestId('add-exercise').click();
    await page.getByTestId('picker-search').fill(query);
    await page.getByTestId('picker-item').first().click();
  }
  await expect(page.getByTestId('exercise-card')).toHaveCount(2);

  for (let card = 0; card < 2; card++) {
    const c = page.getByTestId('exercise-card').nth(card);
    for (let i = 0; i < 3; i++) {
      await c.getByTestId('add-set').click();
      await expect(c.getByTestId('set-row')).toHaveCount(i + 1);
      const row = c.getByTestId('set-row').nth(i);
      await row.getByTestId('weight-input').fill('100');
      await row.getByTestId('reps-input').fill('5');
      await row.getByTestId('done-checkbox').click();
      await expect(row.getByTestId('done-checkbox')).toHaveAttribute('data-state', 'checked');
    }
  }

  await page.getByTestId('finish-workout').click();
  await page.getByTestId('finish-confirm').click();
  await expect(page.getByTestId('summary-sets')).toHaveText('6');
  await page.getByTestId('summary-done').click();
  await expect(page.getByTestId('start-workout')).toBeVisible();

  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('history-item').click();
  await expect(page.getByTestId('set-row')).toHaveCount(6);
  await expect(page.getByTestId('weight-input').first()).toHaveValue('100');

  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('unit-lbs').click();
  await nav(page).getByRole('link', { name: 'History' }).click();
  await page.getByTestId('history-item').click();
  await expect(page.getByTestId('set-row')).toHaveCount(6);
  for (const w of await page.getByTestId('weight-input').all()) {
    await expect(w).toHaveValue('220');
  }
});

test('works offline after service worker activation', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.reload(); // now controlled by the SW
  await expect.poll(() => page.evaluate('!!navigator.serviceWorker.controller')).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Exercises' }).click();
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  await expect(page.getByRole('heading', { name: 'Analyze' })).toBeVisible();
  // Deep link to a client route also works offline (navigateFallback).
  await page.goto('/analyze');
  await expect(page.getByRole('heading', { name: 'Analyze' })).toBeVisible();
  await context.setOffline(false);
});

test('manifest meets installability basics', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const m = await (await page.request.get(href!)).json();
  expect(m.name).toBe('Lift Log');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const i of m.icons) expect((await page.request.get(i.src)).ok()).toBe(true);
});

test('exercise detail shows two loaded images', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('link', { name: 'Exercises' }).click();
  await page.getByTestId('exercise-search').fill('bench');
  await page.getByTestId('exercise-item').first().click();
  const imgs = page.getByTestId('exercise-images').locator('img');
  await expect(imgs).toHaveCount(2);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el) => (el as unknown as { naturalWidth: number }).naturalWidth))
      .toBeGreaterThan(0);
  }
});
