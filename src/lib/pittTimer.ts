export interface PittConfig {
  countdownSec: number;
  repSec: number;
  pauseSec: number;
  reps: number;
}

export type PittPhase =
  | { phase: 'countdown'; msLeft: number }
  | { phase: 'rep' | 'pause'; rep: number; msLeft: number }
  | { phase: 'done'; rep: number };

const SEC = 1000;

/** The PITT timer is offered for PITT-Force exercises while the session is still running. */
export function showsPittTimer(session: { finishedAt?: number }, system: string): boolean {
  return system === 'pitt_force' && session.finishedAt === undefined;
}

/** Total time from the end of the countdown to the end of the last rep (no trailing pause). */
function workMs(c: PittConfig): number {
  return c.reps * c.repSec * SEC + Math.max(0, c.reps - 1) * c.pauseSec * SEC;
}

/** Length of one rep + pause cycle, in ms. */
function cycleMs(c: PittConfig): number {
  return (c.repSec + c.pauseSec) * SEC;
}

export function pittPhaseAt(elapsedMs: number, c: PittConfig): PittPhase {
  const elapsed = Math.max(0, elapsedMs);
  const countdownMs = c.countdownSec * SEC;
  if (elapsed < countdownMs) {
    return { phase: 'countdown', msLeft: countdownMs - elapsed };
  }

  const t = elapsed - countdownMs;
  if (t >= workMs(c)) {
    return { phase: 'done', rep: c.reps };
  }

  const cycle = cycleMs(c);
  const index = Math.floor(t / cycle); // 0-based rep index
  const within = t - index * cycle;
  const rep = index + 1;
  const repMs = c.repSec * SEC;
  if (within < repMs) {
    return { phase: 'rep', rep, msLeft: repMs - within };
  }
  return { phase: 'pause', rep, msLeft: cycle - within };
}

export function completedReps(elapsedMs: number, c: PittConfig): number {
  const elapsed = Math.max(0, elapsedMs);
  const countdownMs = c.countdownSec * SEC;
  if (elapsed < countdownMs) return 0;

  const t = elapsed - countdownMs;
  const repMs = c.repSec * SEC;
  if (t < repMs) return 0;

  const count = Math.floor((t - repMs) / cycleMs(c)) + 1;
  return Math.min(c.reps, count);
}

export function pittEvents(
  c: PittConfig,
): { atMs: number; kind: 'tick' | 'go' | 'hold' | 'done' }[] {
  const events: { atMs: number; kind: 'tick' | 'go' | 'hold' | 'done' }[] = [];
  for (let i = 0; i < c.countdownSec; i++) {
    events.push({ atMs: i * SEC, kind: 'tick' });
  }

  const countdownMs = c.countdownSec * SEC;
  const cycle = cycleMs(c);
  for (let k = 0; k < c.reps; k++) {
    const repStart = countdownMs + k * cycle;
    events.push({ atMs: repStart, kind: 'go' });
    const repEnd = repStart + c.repSec * SEC;
    if (k < c.reps - 1) {
      events.push({ atMs: repEnd, kind: 'hold' });
    } else {
      events.push({ atMs: repEnd, kind: 'done' });
    }
  }
  return events;
}
