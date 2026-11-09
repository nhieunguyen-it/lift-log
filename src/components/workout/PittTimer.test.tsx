import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SetRow } from '@/db';

const db = vi.hoisted(() => ({
  settings: { repSec: 2, pauseSec: 4, sound: true } as {
    repSec: number;
    pauseSec: number;
    sound: boolean;
  },
  updateSet: vi.fn(async () => {}),
  setPittSettings: vi.fn(async () => {}),
}));

vi.mock('@/db', () => ({
  usePittSettings: () => db.settings,
  setsRepo: { updateSet: db.updateSet },
  settingsRepo: { setPittSettings: db.setPittSettings },
}));

import PittTimer from './PittTimer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeOsc {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}
let oscillators: FakeOsc[] = [];

const param = () => ({
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
});

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = 'running';
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createOscillator() {
    const osc = { frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    oscillators.push(osc);
    return osc;
  }
  createGain() {
    return { gain: param(), connect: vi.fn() };
  }
}

let release: ReturnType<typeof vi.fn>;
let container: HTMLDivElement;
let root: Root;

const session: Session = { id: 's1', startedAt: 0 };
const set = (id: string, reps: number, done = false): SetRow => ({
  id,
  sessionExerciseId: 'se1',
  order: 0,
  reps,
  isWarmup: false,
  completedAt: done ? 1 : undefined,
});

function render(props: { session?: Session; sets: SetRow[]; plannedReps?: number }) {
  act(() => {
    root.render(
      <PittTimer
        session={props.session ?? session}
        sets={props.sets}
        plannedReps={props.plannedReps ?? 20}
      />,
    );
  });
}

const byId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const click = (id: string) =>
  act(() => {
    byId(id)!.click();
  });
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const flush = () => act(async () => {});

beforeEach(() => {
  // 'performance' is faked so performance.now() follows advanceTimersByTime.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
  });
  oscillators = [];
  db.settings = { repSec: 2, pauseSec: 4, sound: true };
  db.updateSet.mockClear();
  db.setPittSettings.mockClear();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  release = vi.fn(async () => {});
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn(async () => ({ release })) },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('PittTimer', () => {
  it('Start is disabled when every set is done', () => {
    render({ sets: [set('a', 20, true)] });
    expect(byId('pitt-start')).toHaveProperty('disabled', true);
  });

  it('counts reps and fills N reps on done', async () => {
    render({ sets: [set('a', 20)] });
    click('pitt-start');
    await flush();
    expect(byId('pitt-phase')!.textContent).toBe('3');
    advance(3000);
    expect(byId('pitt-phase')!.textContent).toBe('GO');
    expect(byId('pitt-rep')!.textContent).toBe('Rep 1 / 20');
    advance(2000);
    expect(byId('pitt-phase')!.textContent).toBe('HOLD');
    advance(19 * 6000);
    expect(db.updateSet).toHaveBeenCalledTimes(1);
    expect(db.updateSet).toHaveBeenCalledWith('a', { reps: 20 });
    expect(byId('pitt-stop')).toBeNull();
    await flush();
    expect(release).toHaveBeenCalled();
  });

  it('Stop offers Log n reps', () => {
    render({ sets: [set('done', 20, true), set('b', 0)], plannedReps: 12 });
    click('pitt-start');
    advance(3000 + 2000 + 4000 + 2000);
    expect(byId('pitt-rep')!.textContent).toBe('Rep 2 / 12');
    click('pitt-stop');
    expect(byId('pitt-log')!.textContent).toBe('Log 2 reps');
    click('pitt-log');
    expect(db.updateSet).toHaveBeenCalledWith('b', { reps: 2 });
    expect(byId('pitt-log')).toBeNull();
  });

  it('unmount cancels tones and releases the wake lock', async () => {
    render({ sets: [set('a', 20)] });
    click('pitt-start');
    await flush();
    advance(1000);
    expect(oscillators.length).toBeGreaterThan(0);
    act(() => root.unmount());
    await flush();
    for (const o of oscillators) {
      expect(o.start).toHaveBeenCalled();
      expect(o.stop).toHaveBeenCalledTimes(2); // scheduled end + cancel
    }
    expect(release).toHaveBeenCalled();
    // Re-create so afterEach can unmount safely.
    root = createRoot(container);
  });

  it('muted schedules no tones', () => {
    db.settings = { repSec: 2, pauseSec: 4, sound: false };
    render({ sets: [set('a', 20)] });
    click('pitt-start');
    advance(10_000);
    expect(byId('pitt-mute')!.getAttribute('aria-pressed')).toBe('true');
    expect(oscillators).toHaveLength(0);
  });

  it('Start is disabled while the workout is paused', () => {
    render({ session: { ...session, pausedAt: 123 }, sets: [set('a', 20)] });
    expect(byId('pitt-start')).toHaveProperty('disabled', true);
    click('pitt-start');
    expect(byId('pitt-stop')).toBeNull();
    expect(oscillators).toHaveLength(0);
  });

  it('does not overwrite a set ticked done during the run', () => {
    render({ sets: [set('a', 20)] });
    click('pitt-start');
    advance(6000);
    render({ sets: [{ ...set('a', 20, true), reps: 15 }] });
    advance(3000 + 20 * 6000);
    expect(db.updateSet).not.toHaveBeenCalled();
    expect(byId('pitt-stop')).toBeNull();
    expect(byId('pitt-log')).toBeNull();
    expect(byId('pitt-start')).not.toBeNull();
  });

  it('pausing the workout stops the timer', () => {
    render({ sets: [set('a', 20)] });
    click('pitt-start');
    advance(6000);
    render({ session: { ...session, pausedAt: 123 }, sets: [set('a', 20)] });
    expect(byId('pitt-stop')).toBeNull();
    expect(byId('pitt-log')!.textContent).toBe('Log 1 reps');
    expect(oscillators.length).toBeGreaterThan(0);
    for (const o of oscillators) expect(o.stop).toHaveBeenCalledTimes(2);
  });
});
