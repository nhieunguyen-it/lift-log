import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { fillSetRow, finishWorkout } from './profileHelpers';

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

const EXAMPLE = 'e2e/data/test-program.json';

async function importAndActivateExample(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('start-workout')).toBeVisible();
  const onboarding = page.getByTestId('onboarding-dialog');
  const shown = await onboarding
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await page
      .getByTestId('onboarding-skip')
      .click({ timeout: 2000 })
      .catch(() => expect(onboarding).toBeHidden());
  }
  await expect(onboarding).toBeHidden();
  await page.goto('/programs');
  await page.getByTestId('import-program-file').setInputFiles(EXAMPLE);
  await page.getByTestId('import-program-confirm').click();
  await expect(page).toHaveURL(/\/programs\/[^/]+$/);
  const activate = page.getByTestId('activate-program');
  await activate.click();
  await expect(activate).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
}

test('program day shows system badges, main focus and pre-filled rows', async ({ page }) => {
  await importAndActivateExample(page);
  await page.getByTestId('start-program-day').filter({ hasText: 'Lower' }).click();

  const squat = page.getByTestId('exercise-card').filter({ hasText: 'Barbell Back Squat' }).first();
  await expect(squat.getByTestId('main-focus')).toHaveText('★ Main focus');
  await expect(squat.getByTestId('system-badge')).toHaveText('Progression');

  const press = page.getByTestId('exercise-card').filter({ hasText: 'Leg Press' }).first();
  await expect(press.getByTestId('system-badge')).toHaveText('Pyramid ▲');
  await expect(press.getByTestId('main-focus')).toHaveCount(0);
  const rows = press.getByTestId('set-row');
  await expect(rows).toHaveCount(3);
  for (const [i, reps] of ['15', '14', '12'].entries()) {
    await expect(rows.nth(i).getByTestId('reps-input')).toHaveValue(reps);
  }

  // Ad-hoc exercise: no badge.
  const before = await page.getByTestId('exercise-card').count();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('bench');
  await page.getByTestId('picker-item').first().click();
  const adhoc = page.getByTestId('exercise-card').nth(before);
  await expect(adhoc).toBeVisible();
  await expect(adhoc.getByTestId('system-badge')).toHaveCount(0);
  await expect(adhoc.getByTestId('main-focus')).toHaveCount(0);

  // Log Leg Press, finish, start again: the planner moves the pyramid weights.
  for (const [i, [w, r]] of [
    ['100', '15'],
    ['100', '13'],
    ['100', '12'],
  ].entries()) {
    await fillSetRow(rows.nth(i), w, r, '2');
  }
  await finishWorkout(page);
  await page.getByTestId('start-program-day').filter({ hasText: 'Lower' }).click();
  const press2 = page.getByTestId('exercise-card').filter({ hasText: 'Leg Press' }).first();
  const rows2 = press2.getByTestId('set-row');
  await expect(rows2).toHaveCount(3);
  for (const [i, w] of ['105', '100', '105'].entries()) {
    await expect(rows2.nth(i).getByTestId('weight-input')).toHaveValue(w);
  }
});

test('PITT timer counts, stops early and logs reps; mute persists', async ({ page }) => {
  // Minimal Web Audio stand-in: headless browsers may refuse to start real audio.
  await page.addInitScript(() => {
    const param = () => ({
      setValueAtTime() {},
      linearRampToValueAtTime() {},
    });
    class FakeAudioContext {
      destination = {};
      get currentTime() {
        return performance.now() / 1000;
      }
      createOscillator() {
        return { frequency: param(), connect() {}, start() {}, stop() {} };
      }
      createGain() {
        return { gain: param(), connect() {} };
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
  });
  const t0 = new Date('2026-11-09T18:00:00');
  await page.clock.install({ time: t0 });
  await importAndActivateExample(page);
  await page.getByTestId('start-program-day').filter({ hasText: 'Lower' }).click();

  const curl = page.getByTestId('exercise-card').filter({ hasText: 'Lying Leg Curl' }).first();
  const start = curl.getByTestId('pitt-start');
  await expect(start).toBeEnabled();
  const reps = curl.getByTestId('set-row').first().getByTestId('reps-input');
  await expect(reps).toHaveValue('20');

  // From here the clock only moves through runFor(); live queries need a tick to deliver.
  await page.clock.pauseAt(new Date(t0.getTime() + 10 * 60_000));
  const quick = expect.configure({ timeout: 50 });
  const settle = (assertion: () => Promise<void>) =>
    expect(async () => {
      await page.clock.runFor(1);
      await assertion();
    }).toPass({ intervals: [10] });

  await start.click();
  await expect(curl.getByTestId('pitt-phase')).toHaveText('3');
  await page.clock.runFor(9000);
  await expect(curl.getByTestId('pitt-rep')).toHaveText('Rep 2 / 20');
  await expect(curl.getByTestId('pitt-phase')).toHaveText('GO');

  await curl.getByTestId('pitt-stop').click();
  // Rep 1 finished at 5000 ms; rep 2 was still running.
  const log = curl.getByTestId('pitt-log');
  await expect(log).toHaveText('Log 1 reps');
  await log.click();
  await settle(() => quick(reps).toHaveValue('1'));

  const mute = curl.getByTestId('pitt-mute');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await settle(() => quick(mute).toHaveAttribute('aria-pressed', 'true'));
  await page.reload();
  await settle(() =>
    quick(
      page
        .getByTestId('exercise-card')
        .filter({ hasText: 'Lying Leg Curl' })
        .first()
        .getByTestId('pitt-mute'),
    ).toHaveAttribute('aria-pressed', 'true'),
  );
});
