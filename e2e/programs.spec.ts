import { expect, test } from './fixtures';

test('program page shows a loaded thumbnail for each exercise', async ({ page }) => {
  await page.goto('/programs/builtin-full-body');
  const rows = page.getByTestId('program-exercise');
  await expect(rows.first()).toBeVisible();

  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const img = rows.nth(i).getByTestId('program-exercise-image');
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('src', /^\/exercises\/.+\.jpg$/);
    await expect
      .poll(() => img.evaluate((el) => (el as { naturalWidth: number }).naturalWidth))
      .toBeGreaterThan(0);
  }
});
