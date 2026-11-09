import { expect, test } from './fixtures';

test('picks a system and main focus in the program editor', async ({ page }) => {
  // Read-only rendering of a built-in template (no system) shows the Progression summary.
  await page.goto('/programs/builtin-full-body');
  await expect(page.getByTestId('program-exercise').first()).toContainText(/ sets.* · Progression/);

  await page.getByTestId('edit-builtin').click();
  await expect(page).toHaveURL(/\/programs\/(?!builtin-)/);
  const rows = page.getByTestId('program-exercise');
  await expect(rows.first()).toBeVisible();

  const first = rows.nth(0);
  await first.getByTestId('system-select').selectOption('pyramid_up');
  await expect(first.getByTestId('system-hint')).toHaveText(
    'Start lighter, add weight each set; reps drop.',
  );
  await expect(first.getByRole('switch', { name: /^Main focus for / })).toBeHidden();

  const second = rows.nth(1);
  await second.getByTestId('system-select').selectOption('progression');
  const focus = second.getByRole('switch', { name: /^Main focus for / });
  await focus.click();
  await expect(focus).toBeChecked();

  await page.reload();
  await expect(rows.first()).toBeVisible();
  await expect(rows.nth(0).getByTestId('system-select')).toHaveValue('pyramid_up');
  await expect(rows.nth(1).getByTestId('system-select')).toHaveValue('progression');
  await expect(rows.nth(1).getByRole('switch', { name: /^Main focus for / })).toBeChecked();
});
