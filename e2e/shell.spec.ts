import { expect, test } from '@playwright/test';

test('app shell: bottom nav navigates through all four tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Lift Log');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Primary' });
  for (const [label, path] of [
    ['History', '/history'],
    ['Exercises', '/exercises'],
    ['Settings', '/settings'],
    ['Workout', '/'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }
});
