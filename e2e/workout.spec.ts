import { expect, test } from '@playwright/test';

test('log a workout, finish, see history, survive reload, switch units', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('bench');
  await page.getByTestId('picker-item').first().click();

  await page.getByTestId('add-set').click();
  await page.getByTestId('weight-input').first().fill('100');
  await page.getByTestId('reps-input').first().fill('5');
  await page.getByTestId('done-checkbox').first().click();
  await page.getByTestId('add-set').click(); // prefilled from previous set
  await expect(page.getByTestId('weight-input').nth(1)).toHaveValue('100');
  await expect(page.getByTestId('reps-input').nth(1)).toHaveValue('5');
  await page.getByTestId('done-checkbox').nth(1).click();

  await expect(page.getByTestId('done-checkbox').nth(1)).toHaveAttribute('data-state', 'checked');
  // active session survives reload and shows Resume state
  await page.reload();
  await expect(page.getByTestId('weight-input').first()).toHaveValue('100');

  await page.getByTestId('finish-workout').click();
  await expect(page.getByTestId('summary-sets')).toHaveText('2');
  await expect(page.getByTestId('summary-volume')).toHaveText('1,000 kg');
  await page.getByTestId('finish-confirm').click();
  await expect(page.getByTestId('summary-volume')).toHaveText('1,000 kg');
  await page.getByTestId('summary-done').click();
  await expect(page.getByTestId('start-workout')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('history-item').click();
  await expect(page).toHaveURL(/\/history\/.+/);
  await expect(page.getByTestId('weight-input')).toHaveCount(2);

  await nav.getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('unit-lbs').click();
  await nav.getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toContainText('2,205 lbs');
});
