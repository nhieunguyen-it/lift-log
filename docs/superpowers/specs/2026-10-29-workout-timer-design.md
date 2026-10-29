# Workout timer — design

Date: 2026-10-29
Status: implemented

## Goal

While a workout is in progress, show a live, pausable timer of how long the user has been
training. The recorded workout duration everywhere in the app (finish summary, History list and
detail, Finish dialog preview) becomes **active time**: time since start minus paused time.

## Decisions

| Question                                        | Decision                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Pausable?                                       | Yes — Pause / Resume button next to the timer.                                              |
| What does "duration" mean for a paused workout? | Active time only (paused time excluded), everywhere.                                        |
| Completing a set while paused                   | Auto-resumes the timer at the set's `completedAt`.                                          |
| Pause state storage                             | Running total + open pause on the session (approach A).                                     |
| Persistence                                     | Derived from stored session fields, so it survives reloads, app close and profile switches. |

Rejected: a list of pause intervals (exact but more data and logic than needed); timer state in
`localStorage` (not backed up, not visible to History).

## Data model

`src/db/types.ts` — two optional, unindexed fields on `Session` (no Dexie version bump, same as the
Phase 4 program tags):

```ts
/** Sum of all closed pauses, in ms. */
pausedMs?: number;
/** Set while the session is paused: when the current pause began. */
pausedAt?: number;
```

Invariant: a finished session never has `pausedAt` set.

## Logic

### `src/lib/workoutTimer.ts` (new, pure)

- `activeMs(session: Pick<Session, 'startedAt' | 'pausedMs' | 'pausedAt'>, end: number): number`
  = `max(0, end − startedAt − (pausedMs ?? 0) − (pausedAt !== undefined ? max(0, end − pausedAt) : 0))`.
- `formatClock(ms: number): string` — `MM:SS` under one hour, `H:MM:SS` from one hour. Used only
  by the live timer; summaries keep `formatDuration` (`1h 15m`).

### `src/db/sessionsRepo.ts`

- `pauseSession(id, now = Date.now())` — sets `pausedAt = now` if the session is unfinished and
  not already paused; otherwise no-op.
- `resumeSession(id, now = Date.now())` — if paused: `pausedMs += max(0, now − pausedAt)`, clear
  `pausedAt`; otherwise no-op.
- `summarize(detail, now)` — `durationMs = activeMs(detail.session, finishedAt ?? now)`.
  All duration displays go through `summarize`, so they switch together.
- `finishSession(id, now)` — if paused, closes the open pause at `now` (folds into `pausedMs`,
  clears `pausedAt`) in the same update that sets `finishedAt`. Finishing twice still keeps the
  original end time.

### `src/db/setsRepo.ts`

- `setDone(setId, true, …)` — sequential, guarded writes (not one transaction, which would defer
  live-query delivery): after stamping `completedAt`, look up the parent session; if it is paused
  and unfinished, resume it at that `completedAt`. `setDone(false)` and `updateSet` do not touch pause state.

### Stale "Finish it" (`src/components/StaleSessionPrompt.tsx`)

No code change. It calls `finishSession(id, lastSetTime)`; an open pause that began after
`lastSetTime` contributes `max(0, …) = 0`. Known limitation (accepted with approach A): pauses that
were **closed** after the last completed set are still subtracted, so such a session can slightly
under-report; the result is clamped at 0.

### Backup (`src/db/backup.ts`)

Add to `SessionSchema`:

```ts
pausedMs: z.number().min(0).optional(),
pausedAt: z.number().optional(),
```

`BACKUP_VERSION` stays 5: the fields are optional, so existing v1–v5 files import unchanged. An
older app importing a newer file strips the unknown keys and shows wall-clock duration for those
sessions — acceptable.

## UI

### `src/components/WorkoutTimer.tsx` (new)

- Props: the active `Session`.
- Renders `formatClock(activeMs(session, now))` with `tabular-nums`, `role="timer"`,
  `data-testid="workout-timer"`.
- While running, a `setInterval` (1 s) updates `now` from `Date.now()` (never accumulates ticks,
  so it stays correct after backgrounding/sleep). While paused, no interval; the value is frozen
  and styled `text-muted-foreground`.
- Icon button: `Pause` / `Play` (lucide), `aria-label` "Pause workout timer" / "Resume workout
  timer", `data-testid="pause-workout"` / `"resume-workout"`, calling
  `sessionsRepo.pauseSession` / `resumeSession`. The `useActiveSession` live query re-renders.

### `src/pages/WorkoutPage.tsx`

- Render `<WorkoutTimer session={active} />` in the in-progress header.
- Status line: "In progress · started HH:MM" when running, "Paused · started HH:MM" when paused.
- Finish dialog preview needs no change (uses `summarize`).

### Guide

`src/guide/content/02-logging.md` — short paragraph: the timer, pausing, auto-resume on completing
a set, and that recorded duration excludes paused time.

## Testing (TDD)

Unit (Vitest):

- `activeMs`: never paused; closed pauses only; open pause; open pause starting after `end`
  (contributes 0); never negative.
- `formatClock`: `0` → `00:00`, `59:59`, `1:00:00`, `10:05:03`.

Repo (Vitest + fake-indexeddb):

- pause → resume accumulates `pausedMs`; double pause and resume-when-running are no-ops.
- `finishSession` while paused closes the pause and leaves no `pausedAt`.
- `summarize` subtracts closed and open pauses.
- `setDone(true)` on a paused session resumes it at `completedAt`; `setDone(false)` does not.

Backup:

- Round-trip of a session with `pausedMs` / `pausedAt`; a v5 file without them still imports.

E2E (Playwright, `page.clock` for determinism):

- Start workout → timer ticks → Pause freezes it → Resume continues → pause again, tick a set →
  timer auto-resumes → Finish → summary duration equals active time.

## Out of scope

- Rest timer between sets.
- Editing pause history or duration after the fact.
- Notifications / background timers.
