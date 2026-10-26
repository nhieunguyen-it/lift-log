import { test as base } from '@playwright/test';

/**
 * Pre-phase-3 specs don't care about first-run overlays: dismiss onboarding and
 * "What's new" whenever they appear. Phase-3 specs that test them use `rawTest`.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addLocatorHandler(page.getByTestId('onboarding-skip'), (l) => l.click());
    await page.addLocatorHandler(page.getByTestId('whats-new-dismiss'), (l) => l.click());
    await provide(page);
  },
});
export const rawTest = base;
export { expect } from '@playwright/test';
