import type { Session } from '@/db/types';

export type PauseFields = Pick<Session, 'startedAt' | 'pausedMs' | 'pausedAt'>;

/**
 * Active (non-paused) workout time at `end`. Subtracts closed pauses and any
 * open pause that began before `end`. Never negative.
 */
export function activeMs(session: PauseFields, end: number): number {
  const openPauseMs = session.pausedAt === undefined ? 0 : Math.max(0, end - session.pausedAt);
  const elapsed = end - session.startedAt - (session.pausedMs ?? 0) - openPauseMs;
  return Math.max(0, elapsed);
}

export function isPaused(session: Pick<Session, 'pausedAt'>): boolean {
  return session.pausedAt !== undefined;
}

/** Stopwatch text: `mm:ss`, or `h:mm:ss` from one hour up. Floors to whole seconds. */
export function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
