import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, rawTest } from './fixtures';
import {
  addExerciseWithSets,
  createProfileViaSwitcher,
  fillSetRow,
  finishWorkout,
  nav,
  openAndSkipOnboarding,
  switchViaSwitcher,
} from './profileHelpers';

const PROFILE = 'test_account';

/** Mon..Sat of the week to log: this week on Sat/Sun, otherwise the previous week. */
function weekDays(real: Date) {
  const dow = real.getDay(); // 0 Sun .. 6 Sat
  const sinceMonday = (dow + 6) % 7;
  const weeksBack = dow === 0 || dow === 6 ? 0 : 1;
  const monday = new Date(real.getFullYear(), real.getMonth(), real.getDate() - sinceMonday);
  monday.setDate(monday.getDate() - 7 * weeksBack);
  const at = (offset: number) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset, 18, 0, 0);
  return { weeksBack, mon: at(0), wed: at(2), fri: at(4), sat: at(5) };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Fills every pre-created set row of every exercise card (weight, reps and RIR). */
async function fillProgramDay(page: Page) {
  const cards = page.getByTestId('exercise-card');
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().getByTestId('set-row').first()).toBeVisible();
  const nCards = await cards.count();
  expect(nCards).toBeGreaterThan(0);
  for (let c = 0; c < nCards; c++) {
    const rows = cards.nth(c).getByTestId('set-row');
    const nRows = await rows.count();
    for (let r = 0; r < nRows; r++) await fillSetRow(rows.nth(r), String(20 + c * 5), '10', '2');
  }
}

async function logProgramDay(page: Page, dayIndex: number, start: Date) {
  await page.clock.setFixedTime(start);
  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await page.getByTestId('start-program-day').nth(dayIndex).click();
  await expect(page.getByTestId('session-status')).toBeVisible();
  await fillProgramDay(page);
  await page.clock.setFixedTime(new Date(start.getTime() + 55 * 60_000));
  await finishWorkout(page);
}

rawTest('test_account: full week through the real UI', async ({ browser }, testInfo) => {
  testInfo.setTimeout(240_000);
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const real = new Date();
  const week = weekDays(real);

  // Start in Default, create and switch to test_account.
  await openAndSkipOnboarding(page);
  await expect(page.getByTestId('profile-active-name')).toHaveText('Default');
  await createProfileViaSwitcher(page, PROFILE);

  // Onboarding: kg, Monday week start, Full Body 3x/week.
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-unit-kg').click();
  await page.getByTestId('onboarding-week-start').selectOption('1');
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-program-builtin-full-body').click();
  await expect(page.getByTestId('onboarding-program-builtin-full-body')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('onboarding-dialog')).toBeHidden();
  await expect(page.getByTestId('start-program-day')).toHaveCount(3);

  // Fake clock: a Monday-evening start; each day's time is pinned before its session starts.
  await page.clock.install({ time: week.mon });
  await logProgramDay(page, 0, week.mon); // Full Body A
  await logProgramDay(page, 1, week.wed); // Full Body B
  await logProgramDay(page, 2, week.fri); // Full Body C

  // Saturday: freestyle accessories.
  await page.clock.setFixedTime(week.sat);
  await nav(page).getByRole('link', { name: 'Workout' }).click();
  await page.getByTestId('start-workout').click();
  await addExerciseWithSets(page, 'Dumbbell Bicep Curl', 3);
  await addExerciseWithSets(page, 'Triceps Pushdown', 3);
  await page.clock.setFixedTime(new Date(week.sat.getTime() + 30 * 60_000));
  await finishWorkout(page);

  // History lists 4 sessions.
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toHaveCount(4);

  // Analyze the logged week (back to real "now", then step back if the week is in the past).
  await page.clock.setFixedTime(real);
  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  for (let i = 0; i < week.weeksBack; i++) await page.getByTestId('week-prev').click();
  const summary = page.getByTestId('analyze-summary');
  await expect(summary).toBeVisible();
  const total = page.getByTestId('summary-total');
  await expect(total).not.toHaveText(/^0/);
  const hardSets = Number(await total.evaluate((e) => e.firstChild?.textContent));
  expect(hardSets).toBeGreaterThan(0);
  const sessionsText = (await page.getByTestId('summary-sessions').innerText()).replace(
    /\s+/g,
    ' ',
  );
  expect(sessionsText).toMatch(/4\s*\/\s*3/);
  await expect(page.getByTestId('body-map')).toBeVisible();
  const pva = page.getByTestId('plan-vs-actual');
  await expect(pva).toContainText('3 of 3 days done');
  await expect(page.getByTestId('pva-skipped')).toHaveCount(0);
  await expect(page.getByTestId('deload-card')).toHaveCount(0);
  const deltaText = (await page.getByTestId('summary-delta').innerText()).trim();

  const shotDir = process.env.SCREENSHOT_DIR;
  if (shotDir) {
    mkdirSync(shotDir, { recursive: true });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(page.locator('html')).toHaveClass(scheme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({
        path: path.join(shotDir, `analyze-${scheme}.png`),
        fullPage: true,
      });
    }
    await page.emulateMedia({ colorScheme: null });
  }

  // Back to Default: still empty. Then again to test_account after a reload: data persists.
  await switchViaSwitcher(page, 'Default');
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await switchViaSwitcher(page, PROFILE);
  await page.reload();
  await expect(page.getByTestId('profile-active-name')).toHaveText(PROFILE);
  await nav(page).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-item')).toHaveCount(4);

  // Export a backup and check its content.
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click(),
  ]);
  const file = readFileSync(await download.path(), 'utf8');
  if (process.env.BACKUP_OUT) {
    mkdirSync(path.dirname(path.resolve(process.env.BACKUP_OUT)), { recursive: true });
    writeFileSync(process.env.BACKUP_OUT, file);
  }
  const data = JSON.parse(file) as {
    profile?: { name: string };
    sessions: { startedAt: number }[];
    sets: { rir?: number; weightKg?: number; reps: number; isWarmup: boolean }[];
  };
  expect(data.profile?.name).toBe(PROFILE);
  expect(data.sessions).toHaveLength(4);
  const dates = data.sessions.map((s) => iso(new Date(s.startedAt))).sort();
  expect(dates).toEqual([iso(week.mon), iso(week.wed), iso(week.fri), iso(week.sat)]);
  for (const s of data.sets.filter((x) => !x.isWarmup)) {
    expect(s.weightKg).toBeGreaterThan(0);
    expect(s.reps).toBeGreaterThan(0);
    expect(s.rir).toBeDefined();
  }

  console.log(
    `test_account summary: sessions ${dates.join(', ')}; hard sets ${hardSets}; ` +
      `sessions ${sessionsText}; ${deltaText}; logged sets ${data.sets.length}`,
  );
  await context.close();
});
