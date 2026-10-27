import type { Page } from '@playwright/test';
import { expect, rawTest, test } from './fixtures';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

/** Local Monday 00:00 of this week (the backups below pin weekStartsOn to Monday). */
function thisMonday(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}
/** A timestamp `minutesAgo` before now, but never before this week's start. */
const thisWeek = (minutesAgo: number) => Math.max(thisMonday(), Date.now() - minutesAgo * 60_000);

interface Spec {
  id: string;
  startedAt: number;
  programId?: string;
  programDayId?: string;
  exercises: { exerciseId: string; sets: { weightKg: number; reps: number; rir?: number }[] }[];
}

function backup(
  specs: Spec[],
  extra: { settings?: Record<string, unknown>; programs?: unknown[] } = {},
) {
  const sessions: unknown[] = [];
  const sessionExercises: unknown[] = [];
  const sets: unknown[] = [];
  for (const s of specs) {
    sessions.push({
      id: s.id,
      startedAt: s.startedAt,
      finishedAt: s.startedAt + 3_600_000,
      programId: s.programId,
      programDayId: s.programDayId,
    });
    s.exercises.forEach((e, ei) => {
      const seId = `${s.id}-e${ei}`;
      sessionExercises.push({ id: seId, sessionId: s.id, exerciseId: e.exerciseId, order: ei });
      e.sets.forEach((st, si) =>
        sets.push({
          id: `${seId}-s${si}`,
          sessionExerciseId: seId,
          order: si,
          weightKg: st.weightKg,
          reps: st.reps,
          rir: st.rir,
          isWarmup: false,
          completedAt: s.startedAt + 60_000 * (si + 1),
        }),
      );
    });
  }
  return {
    app: 'lift-log',
    version: 4,
    exportedAt: Date.now(),
    settings: { unit: 'kg', weekStartsOn: 1, ...extra.settings },
    sessions,
    sessionExercises,
    sets,
    programs: extra.programs,
  };
}

async function importBackup(page: Page, data: unknown) {
  // A fresh app opens onboarding; clear it first so it can't cover the import dialog.
  await page.goto('/');
  await expect(page.getByTestId('start-workout')).toBeVisible();
  const onboarding = page.getByTestId('onboarding-dialog');
  if (await onboarding.isVisible()) {
    // The fixture's locator handler may dismiss it first; a lost race is fine.
    await page
      .getByTestId('onboarding-skip')
      .click({ timeout: 2000 })
      .catch(() => undefined);
    await expect(onboarding).toBeHidden();
  }
  await page.goto('/settings');
  await page.getByTestId('import-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toContainText('Import complete');
}

const PROGRAM = {
  id: 'p4-prog',
  name: 'Phase Four Plan',
  builtIn: false,
  days: [
    {
      id: 'p4-d1',
      name: 'Alpha',
      exercises: [
        { exerciseId: 'barbell-back-squat', targetSets: 3 },
        { exerciseId: 'pull-up', targetSets: 3 },
      ],
    },
    {
      id: 'p4-d2',
      name: 'Bravo',
      exercises: [{ exerciseId: 'barbell-bench-press', targetSets: 3 }],
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};

const sets = (n: number, weightKg: number, reps: number) =>
  Array.from({ length: n }, () => ({ weightKg, reps, rir: 2 }));

/** A week of varied training in the current week, for the Analyze tests. */
const weekData = () =>
  backup([
    {
      id: 'a1',
      startedAt: thisWeek(30),
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: sets(4, 60, 8) },
        { exerciseId: 'barbell-back-squat', sets: sets(3, 80, 8) },
        { exerciseId: 'dumbbell-bicep-curl', sets: sets(2, 12, 10) },
      ],
    },
  ]);

test('Analyze summary fits the first screen and the legend filter highlights one status', async ({
  page,
}) => {
  await importBackup(page, weekData());
  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  const summary = page.getByTestId('analyze-summary');
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('status-bar')).toBeVisible();
  const box = (await summary.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  const chest = page.locator('[data-testid="muscle-row"][data-muscle-id="chest"]');
  const chosen = (await chest.getAttribute('data-status'))!;
  const pressed = page.getByTestId(`legend-filter-${chosen}`);
  await expect(pressed).toHaveAttribute('aria-pressed', 'false');
  await pressed.click();
  await expect(pressed).toHaveAttribute('aria-pressed', 'true');

  // Only muscles in the chosen status keep full opacity; everything else is dimmed.
  const paths = page.locator('[data-testid="body-map"] path[data-muscle-id]');
  await expect
    .poll(async () =>
      paths.evaluateAll(
        (els, status) =>
          els.every(
            (el) =>
              ((el as unknown as { style: { opacity: string } }).style.opacity === '') ===
              (el.getAttribute('data-status') === status),
          ),
        chosen,
      ),
    )
    .toBe(true);
  expect(await paths.evaluateAll((els) => els.length)).toBeGreaterThan(0);
  await expect(page.getByTestId('legend-filter-over')).toHaveAttribute(
    'aria-pressed',
    chosen === 'over' ? 'true' : 'false',
  );

  await pressed.click();
  await expect(pressed).toHaveAttribute('aria-pressed', 'false');
});

test('block: activate from the program, preview the ramp, then start a ramped day', async ({
  page,
}) => {
  await importBackup(
    page,
    backup([], { settings: { activeProgramId: PROGRAM.id }, programs: [PROGRAM] }),
  );
  await page.goto(`/programs/${PROGRAM.id}`);
  await page.getByTestId('block-start').click();
  await expect(page.getByTestId('block-status')).toContainText('Week 1 of 5');
  await expect(page.getByTestId('block-strip')).toBeVisible();
  await page.getByTestId('block-week-2').click();
  // Week 2 ramps the first exercise of each day by one set (3 -> 4), others stay at 3.
  const detail = page.getByTestId('block-week-detail');
  await expect(detail).toContainText('Barbell Back Squat');
  await expect(detail.getByText('4 sets', { exact: true })).toHaveCount(2);
  await expect(page.getByTestId('block-week-5')).toContainText('Deload');

  // Re-import with the block started a week ago so the current week is week 2.
  const block = {
    startDate: thisMonday() - WEEK,
    weeks: 5,
    ramp: { setsPerWeek: 1, maxExtraSets: 3 },
    rampExerciseIds: ['barbell-back-squat', 'barbell-bench-press'],
  };
  await importBackup(
    page,
    backup([], {
      settings: { activeProgramId: PROGRAM.id, programBlocks: { [PROGRAM.id]: block } },
      programs: [PROGRAM],
    }),
  );
  await page.goto('/');
  await expect(page.getByTestId('start-block-week')).toContainText('Block week 2 of 5');
  await page.getByTestId('start-program-day').first().click();
  const cards = page.getByTestId('exercise-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByTestId('set-row')).toHaveCount(4); // squat: 3 + 1 ramp
  await expect(cards.nth(1).getByTestId('set-row')).toHaveCount(3); // pull-up: not ramped
});

test('plan vs. actual lists a skipped program day', async ({ page }) => {
  await importBackup(
    page,
    backup(
      [
        {
          id: 'pv1',
          startedAt: thisWeek(30),
          programId: PROGRAM.id,
          programDayId: 'p4-d1',
          exercises: [{ exerciseId: 'barbell-back-squat', sets: sets(2, 80, 8) }],
        },
      ],
      { settings: { activeProgramId: PROGRAM.id }, programs: [PROGRAM] },
    ),
  );
  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  const pva = page.getByTestId('plan-vs-actual');
  await expect(pva).toContainText('1 of 2 days done');
  await expect(page.getByTestId('pva-skipped')).toContainText('Bravo');
  await expect(page.getByTestId('pva-skipped')).not.toContainText('Alpha');
});

test('per-exercise deload hint appears in a workout and can be dismissed', async ({ page }) => {
  // Bench e1RM falls over four sessions; nothing else is logged, so only an exercise hint fires.
  const reps = [6, 6, 5, 3];
  await importBackup(
    page,
    backup(
      reps.map((r, i) => ({
        id: `h${i}`,
        startedAt: Date.now() - (12 - i * 3) * DAY,
        exercises: [{ exerciseId: 'barbell-bench-press', sets: sets(3, 100, r) }],
      })),
    ),
  );
  await page.goto('/');
  await page.getByTestId('start-workout').click();
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('Barbell Bench Press');
  await page.getByTestId('picker-item').first().click();
  const hint = page.getByTestId('exercise-deload-hint');
  await expect(hint).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss fatigue hint' }).click();
  await expect(hint).toBeHidden();
});

test('Analyze renders in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await importBackup(page, weekData());
  await nav(page).getByRole('link', { name: 'Analyze' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByTestId('analyze-summary')).toBeVisible();
  await expect(page.getByTestId('body-map')).toBeVisible();
  await expect(page.getByTestId('muscle-list')).toBeVisible();
  const bg = (await page.evaluate('getComputedStyle(document.body).backgroundColor')) as string;
  const [r, g, b] = bg.match(/\d+/g)!.map(Number);
  expect(r + g + b).toBeLessThan(200);
});

async function clearSetting(page: Page, ...keys: string[]) {
  await page.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open('lift-log');
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

rawTest(
  "what's new for phase 4 shows once to existing users, without stacking",
  async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('onboarding-skip').click();
    await expect(page.getByTestId('onboarding-dialog')).toBeHidden();
    // New users skip it.
    await page.reload();
    await expect(page.getByTestId('start-workout')).toBeVisible();
    await expect(page.getByTestId('whats-new-dialog')).toBeHidden();

    // Existing user who has seen neither: only the phase 4 dialog, then nothing more.
    await clearSetting(page, 'whatsNewPhase3Seen', 'whatsNewPhase4Seen');
    await page.reload();
    const dlg = page.getByTestId('whats-new-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('heading', { name: "What's new in phase 4" })).toBeVisible();
    await expect(dlg).toContainText('Legend filter');
    await expect(dlg).toContainText('Plan vs. actual');
    await page.getByTestId('whats-new-dismiss').click();
    await expect(dlg).toBeHidden();
    await page.waitForTimeout(300);
    await expect(dlg).toBeHidden();

    await page.reload();
    await expect(page.getByTestId('start-workout')).toBeVisible();
    await expect(dlg).toBeHidden();
  },
);
