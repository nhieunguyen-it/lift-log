# Workout Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live, pausable workout timer on the Workout page and make recorded duration mean active time (start → finish minus paused time) everywhere.

**Architecture:** Pause state lives on the `Session` row as two optional, unindexed fields (`pausedMs`, `pausedAt`). A pure helper `activeMs` derives elapsed active time from those fields; `summarize()` uses it, so every duration display switches at once. A small `WorkoutTimer` component re-renders once a second from `Date.now()`.

**Tech Stack:** React 19, TypeScript, Dexie 4 (IndexedDB) + `dexie-react-hooks`, zod 4, Vitest + fake-indexeddb, Playwright, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-29-workout-timer-design.md`

## Global Constraints

- No Dexie schema version bump: new `Session` fields are optional and unindexed.
- `BACKUP_VERSION` stays `5`.
- A finished session never has `pausedAt` set.
- Clearing a field in Dexie: use a `modify((s) => { delete s.pausedAt; … })` callback, not `update({ pausedAt: undefined })`.
- Live timer format: `MM:SS` under one hour, `H:MM:SS` from one hour. Summaries keep `formatDuration`.
- Test ids: `workout-timer`, `pause-workout`, `resume-workout`. Aria labels: "Pause workout timer", "Resume workout timer".
- Status line copy: `In progress · started HH:MM` / `Paused · started HH:MM`.
- Run `npm run check` (typecheck + lint + unit tests) green before every commit.

## Review Focus

1. **Reload while paused** — the timer must come back frozen at the same value and show Resume (state is in IndexedDB, not React). → e2e in Task 4.
2. **Ticking a set in History on a finished session** must not change that session's pause fields or duration. → repo test in Task 2.
3. **Device clock earlier than `pausedAt`** (clock changed, `end < pausedAt`) — open pause contributes 0, result never negative. → unit test in Task 1.
4. **Un-ticking a set while paused** keeps the session paused. → repo test in Task 2.
5. **Stale "Finish it" while paused** — open pause after the last set contributes 0; finished row has no `pausedAt`. → repo test in Task 2.

---

### Task 1: Pure timer helpers

**Files:**

- Create: `src/lib/workoutTimer.ts`
- Test: `src/lib/workoutTimer.test.ts`

**Interfaces:**

- Produces:
  - `type PauseFields = Pick<Session, 'startedAt' | 'pausedMs' | 'pausedAt'>` (import `Session` type from `@/db/types`)
  - `activeMs(session: PauseFields, end: number): number`
  - `isPaused(session: Pick<Session, 'pausedAt'>): boolean`
  - `formatClock(ms: number): string`

- [ ] **Step 1: Write failing tests** in `src/lib/workoutTimer.test.ts`

```ts
const MIN = 60_000;
describe('activeMs', () => {
  it('never paused', () => expect(activeMs({ startedAt: 0 }, 30 * MIN)).toBe(30 * MIN));
  it('subtracts closed pauses', () =>
    expect(activeMs({ startedAt: 0, pausedMs: 5 * MIN }, 30 * MIN)).toBe(25 * MIN));
  it('subtracts an open pause up to end', () =>
    expect(activeMs({ startedAt: 0, pausedMs: 5 * MIN, pausedAt: 20 * MIN }, 30 * MIN)).toBe(
      15 * MIN,
    ));
  it('open pause starting after end contributes 0', () =>
    expect(activeMs({ startedAt: 0, pausedAt: 40 * MIN }, 30 * MIN)).toBe(30 * MIN));
  it('never negative', () =>
    expect(activeMs({ startedAt: 0, pausedMs: 60 * MIN }, 30 * MIN)).toBe(0));
});
describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [59 * MIN + 59_000, '59:59'],
    [60 * MIN, '1:00:00'],
    [10 * 60 * MIN + 5 * MIN + 3_000, '10:05:03'],
    [1_999, '00:01'], // floors to whole seconds
  ])('%i ms -> %s', (ms, out) => expect(formatClock(ms)).toBe(out));
});
it('isPaused', () => {
  expect(isPaused({})).toBe(false);
  expect(isPaused({ pausedAt: 1 })).toBe(true);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/workoutTimer.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the three functions per the formula in the spec (`activeMs`). `formatClock` floors to whole seconds; minutes/seconds zero-padded to 2, hours unpadded.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(timer): add active-time and clock helpers"`

---

### Task 2: Session pause state in repos (+ auto-resume)

**Files:**

- Modify: `src/db/types.ts` (`Session`)
- Modify: `src/db/sessionsRepo.ts` (`summarize`, `finishSession`; add `pauseSession`, `resumeSession`)
- Modify: `src/db/setsRepo.ts` (`setDone`)
- Test: `src/db/workoutTimer.test.ts` (new; same setup as `repos.test.ts`: `import 'fake-indexeddb/auto'`, `beforeEach(resetDb)`)

**Interfaces:**

- Consumes: `activeMs`, `isPaused` from Task 1.
- Produces:
  - `Session.pausedMs?: number` — doc: "Sum of all closed pauses, in ms."
  - `Session.pausedAt?: number` — doc: "Set while the session is paused: when the current pause began."
  - `sessionsRepo.pauseSession(sessionId: string, now = Date.now()): Promise<void>`
  - `sessionsRepo.resumeSession(sessionId: string, now = Date.now()): Promise<void>`

- [ ] **Step 1: Write failing tests** (times are explicit numbers; use `sessions.startSession(0)`)

```ts
it('pause/resume accumulates pausedMs; repeats are no-ops', async () => {
  const s = await sessions.startSession(0);
  await sessions.pauseSession(s.id, 10);
  await sessions.pauseSession(s.id, 20); // no-op
  await sessions.resumeSession(s.id, 50);
  await sessions.resumeSession(s.id, 60); // no-op
  const row = await db.sessions.get(s.id);
  expect(row?.pausedMs).toBe(40);
  expect(row && 'pausedAt' in row).toBe(false);
});
it('cannot pause a finished session', async () => {
  const s = await sessions.startSession(0);
  await sessions.finishSession(s.id, 100);
  await sessions.pauseSession(s.id, 200);
  expect((await db.sessions.get(s.id))?.pausedAt).toBeUndefined();
});
it('finish while paused closes the pause; duration is active time', async () => {
  const s = await sessions.startSession(0);
  await sessions.pauseSession(s.id, 1_000);
  const summary = await sessions.finishSession(s.id, 4_000);
  const row = await db.sessions.get(s.id);
  expect(row?.pausedAt).toBeUndefined();
  expect(row?.pausedMs).toBe(3_000);
  expect(summary?.durationMs).toBe(1_000);
});
it('stale finish at an earlier time ignores a later open pause', async () => {
  const s = await sessions.startSession(0);
  await sessions.pauseSession(s.id, 5_000);
  const summary = await sessions.finishSession(s.id, 2_000);
  expect(summary?.durationMs).toBe(2_000);
  expect((await db.sessions.get(s.id))?.pausedAt).toBeUndefined();
});
it('summarize subtracts closed and open pauses', async () => {
  /* pause 10→30, pause again at 80; summarize(detail, 100).durationMs === 60 */
});
it('ticking a set done auto-resumes at completedAt', async () => {
  vi.useFakeTimers({ now: 0, toFake: ['Date'] });
  // start(0), add exercise + set with reps 5, pause at 10, vi.setSystemTime(70), setDone(true)
  // expect pausedAt undefined and pausedMs === 60
  vi.useRealTimers();
});
it('un-ticking a set while paused stays paused', async () => {
  /* setDone(false) → pausedAt unchanged */
});
it('ticking a set in a finished session leaves pause fields alone', async () => {
  /* finish session, snapshot the session row, setDone(true) on its set → session row toEqual snapshot */
});
```

Write the bodies left as comments with the stated values; each asserts exactly what its comment says.

- [ ] **Step 2: Run** `npx vitest run src/db/workoutTimer.test.ts` — Expected: FAIL (`pauseSession` is not a function).
- [ ] **Step 3: Implement**
  - `types.ts`: add the two fields with the doc comments above.
  - `pauseSession`: `db.sessions.where('id').equals(id).filter(s => s.finishedAt === undefined && s.pausedAt === undefined).modify({ pausedAt: now })`.
  - `resumeSession`: filter `pausedAt !== undefined`; `modify` callback adds `Math.max(0, now - pausedAt)` to `pausedMs ?? 0` and deletes `pausedAt`.
  - `finishSession`: in the existing unfinished-only `modify`, switch to a callback that sets `finishedAt = now` and, if paused, folds `Math.max(0, now - pausedAt)` into `pausedMs` and deletes `pausedAt`.
  - `summarize`: `durationMs: activeMs(detail.session, end)`.
  - `setDone`: sequential, guarded writes, deliberately **not** one `db.transaction` (an explicit transaction defers live-query delivery via `setTimeout(0)`, which starves under Playwright's fake clock). Stamp `completedAt`; when `markDone`, look up set → sessionExercise → session; if `session.finishedAt === undefined` and `isPaused(session)`, call `resumeSession(session.id, completedAt)` (import from `./sessionsRepo`; it does not import `setsRepo`, so no cycle). Each write is atomic and `resumeSession` only acts on a paused, unfinished session, so the sequence is safe.
- [ ] **Step 4: Run** `npx vitest run src/db` — Expected: PASS, including existing `repos.test.ts` (unpaused durations unchanged).
- [ ] **Step 5: Commit** — `git commit -m "feat(timer): store pause state and count active time"`

---

### Task 3: Backup carries pause fields

**Files:**

- Modify: `src/db/backup.ts` (`SessionSchema`, and the header comment noting the v5 additive fields)
- Test: `src/db/backupV5.test.ts` (add one `it`)

**Interfaces:**

- Consumes: `Session.pausedMs`, `Session.pausedAt` from Task 2.

- [ ] **Step 1: Write failing test** — `'roundtrips session pause fields'`: `bindDb('lift-log')`, `ensureSeed()`, add session `{ id: 's1', startedAt: 0, pausedMs: 1234, pausedAt: 5000 }`, `exportData()`, wipe tables, `importData(exported)`, expect `db.sessions.get('s1')` to equal the original object. (Existing `it.each` over v1–v5 fixtures already covers files without the fields.)
- [ ] **Step 2: Run** `npx vitest run src/db/backupV5.test.ts` — Expected: FAIL (fields stripped).
- [ ] **Step 3: Implement** — add `pausedMs: z.number().min(0).optional()` and `pausedAt: z.number().optional()` to `SessionSchema`. Keep `BACKUP_VERSION = 5`.
- [ ] **Step 4: Run** same command — Expected: PASS (all fixtures still import).
- [ ] **Step 5: Commit** — `git commit -m "feat(timer): include pause state in backups"`

---

### Task 4: Timer UI, page wiring, guide, e2e

**Files:**

- Create: `src/components/WorkoutTimer.tsx`
- Modify: `src/pages/WorkoutPage.tsx` (in-progress header block, ~lines 83–101)
- Modify: `src/guide/content/02-logging.md` (new `## Workout timer {#logging-timer}` section before `## Finish a workout`)
- Test: `e2e/workoutTimer.spec.ts` (new; `import { expect, test } from './fixtures'`)

**Interfaces:**

- Consumes: `activeMs`, `isPaused`, `formatClock` (Task 1); `sessionsRepo.pauseSession` / `resumeSession` (Task 2).
- Produces: `export default function WorkoutTimer({ session }: { session: Session })`

- [ ] **Step 1: Write failing e2e** — one test, clock installed before navigation:

```ts
test('timer ticks, pauses, auto-resumes on a ticked set, and survives reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-29T18:00:00') });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Workout' })
    .click();
  await page.getByTestId('start-workout').click();
  const timer = page.getByTestId('workout-timer');
  await expect(timer).toHaveText('00:00');
  await page.clock.runFor('01:05');
  await expect(timer).toHaveText('01:05');

  await page.getByTestId('pause-workout').click();
  await expect(page.getByTestId('session-status')).toContainText('Paused');
  await page.clock.runFor('10:00');
  await expect(timer).toHaveText('01:05');

  await page.reload();
  await expect(page.getByTestId('workout-timer')).toHaveText('01:05');
  await expect(page.getByTestId('resume-workout')).toBeVisible();

  await page.getByTestId('resume-workout').click();
  await page.clock.runFor('00:55');
  await expect(timer).toHaveText('02:00');

  // pause, then log a set -> auto-resume
  await page.getByTestId('pause-workout').click();
  await page.clock.runFor('05:00');
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('picker-search').fill('barbell bench press');
  await page
    .locator('[data-testid="picker-item"]', { hasText: 'Barbell Bench Press' })
    .first()
    .click();
  await page.getByTestId('add-set').click();
  const row = page.getByTestId('set-row').first();
  await row.getByTestId('reps-input').fill('5');
  await row.getByTestId('done-checkbox').click();
  await expect(page.getByTestId('pause-workout')).toBeVisible();
  await expect(page.getByTestId('session-status')).toContainText('In progress');
  await expect(timer).toHaveText('02:00');

  await page.clock.runFor('03:00');
  await expect(timer).toHaveText('05:00');
  await page.getByTestId('finish-workout').click();
  await page.getByTestId('finish-confirm').click();
  await expect(page.getByTestId('summary-duration')).toContainText('5m');
});
```

- [ ] **Step 2: Run** `npx playwright test e2e/workoutTimer.spec.ts` — Expected: FAIL (no `workout-timer`).
- [ ] **Step 3: Implement `WorkoutTimer`** — `useState(Date.now)`; `useEffect` keyed on `session.pausedAt` starts a 1 s `setInterval(() => setNow(Date.now()))` only when not paused, and resyncs `now` once on change. Render a flex row: `<span role="timer" data-testid="workout-timer" className="text-2xl font-semibold tabular-nums">` (add `text-muted-foreground` when paused) with `formatClock(activeMs(session, now))`, and a `Button variant="outline" size="icon"` with `Pause`/`Play` icon, aria labels and test ids from Global Constraints, `onClick` → `void sessionsRepo.pauseSession(session.id)` / `resumeSession`.
- [ ] **Step 4: Wire `WorkoutPage`** — render `<WorkoutTimer session={active} />` beneath the status line inside the header's left column; status text prefix becomes `isPaused(active) ? 'Paused' : 'In progress'`.
- [ ] **Step 5: Guide** — add a short section: the timer counts active training time; **Pause** freezes it; ticking a set done resumes it automatically; History and the finish summary show active time.
- [ ] **Step 6: Run** `npx playwright test e2e/workoutTimer.spec.ts` then `npm run check` — Expected: PASS.
- [ ] **Step 7: Run full e2e** `npm run e2e` — Expected: PASS (existing `session-status` / duration assertions unaffected for unpaused sessions).
- [ ] **Step 8: Commit** — `git commit -m "feat(timer): show pausable workout timer"`
