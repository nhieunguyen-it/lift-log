import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TRAINING } from '@/config/training';
import { setsRepo, settingsRepo, usePittSettings, type Session, type SetRow } from '@/db';
import { completedReps, pittEvents, pittPhaseAt, type PittConfig } from '@/lib/pittTimer';
import { createPittSound, type PittSound } from '@/lib/pittSound';
import { isPaused } from '@/lib/workoutTimer';

interface Props {
  session: Session;
  sets: SetRow[];
  plannedReps: number;
}

interface Run {
  /** performance.now() when Start was pressed (countdown begins). */
  start: number;
  config: PittConfig;
  setId: string;
}

const TICK_MS = 100;

/** Holds the screen awake while the timer runs; every failure is ignored. */
function requestWakeLock(): Promise<WakeLockSentinel | undefined> | null {
  if (!('wakeLock' in navigator) || !navigator.wakeLock) return null;
  try {
    return navigator.wakeLock.request('screen').catch(() => undefined);
  } catch {
    return null;
  }
}

/** PITT-Force pacing timer: 3-2-1, then GO/HOLD per rep, with tones and a screen wake lock. */
export default function PittTimer({ session, sets, plannedReps }: Props) {
  const settings = usePittSettings();
  const repSec = settings?.repSec ?? TRAINING.pitt.repSec;
  const pauseSec = settings?.pauseSec ?? TRAINING.pitt.pauseSec;
  const sound = settings?.sound ?? true;

  const firstOpen = sets.find((s) => s.completedAt === undefined);
  const target = firstOpen && firstOpen.reps > 0 ? firstOpen.reps : plannedReps;
  const paused = isPaused(session);

  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(0);
  const [stopped, setStopped] = useState<{ setId: string; reps: number } | null>(null);

  const runRef = useRef<Run | null>(null);
  const soundRef = useRef<PittSound | null>(null);
  const wakeRef = useRef<Promise<WakeLockSentinel | undefined> | null>(null);
  // Latest rows, so the done write can see a set ticked Done mid-run.
  const setsRef = useRef(sets);
  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  const releaseAll = useCallback(() => {
    runRef.current = null;
    soundRef.current?.cancel();
    soundRef.current = null;
    const wake = wakeRef.current;
    wakeRef.current = null;
    void wake?.then((s) => s?.release().catch(() => {}));
  }, []);

  /** Ends the run early and offers to log the reps finished so far. */
  const stop = useCallback(() => {
    const r = runRef.current;
    if (!r) return;
    const elapsed = performance.now() - r.start;
    releaseAll();
    setRun(null);
    setStopped({ setId: r.setId, reps: completedReps(elapsed, r.config) });
  }, [releaseAll]);

  function start() {
    if (!firstOpen || paused) return;
    const config: PittConfig = {
      countdownSec: TRAINING.pitt.countdownSec,
      repSec,
      pauseSec,
      reps: target,
    };
    releaseAll();
    if (sound) {
      // Created inside the click so iOS unlocks audio.
      soundRef.current = createPittSound();
      soundRef.current?.schedule(pittEvents(config));
    }
    wakeRef.current = requestWakeLock();
    const r: Run = { start: performance.now(), config, setId: firstOpen.id };
    runRef.current = r;
    setStopped(null);
    setNow(r.start);
    setRun(r);
  }

  function toggleSound() {
    const next = !sound;
    void settingsRepo.setPittSettings({ sound: next });
    const r = runRef.current;
    if (!r) return;
    soundRef.current?.cancel();
    soundRef.current = null;
    if (next) {
      const elapsed = performance.now() - r.start;
      const remaining = pittEvents(r.config)
        .filter((e) => e.atMs > elapsed)
        .map((e) => ({ ...e, atMs: e.atMs - elapsed }));
      soundRef.current = createPittSound();
      soundRef.current?.schedule(remaining);
    }
  }

  // UI tick; time is derived from performance.now(), so it never drifts.
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => {
      if (runRef.current !== run) return;
      const t = performance.now();
      if (pittPhaseAt(t - run.start, run.config).phase === 'done') {
        // Let the done chime play out; just drop the run and the wake lock.
        runRef.current = null;
        soundRef.current = null;
        const wake = wakeRef.current;
        wakeRef.current = null;
        void wake?.then((s) => s?.release().catch(() => {}));
        setRun(null);
        // A set ticked Done during the run keeps what the user logged.
        const latest = setsRef.current.find((s) => s.id === run.setId);
        if (latest?.completedAt === undefined) {
          void setsRepo.updateSet(run.setId, { reps: run.config.reps });
        }
        return;
      }
      setNow(t);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [run]);

  // Pausing the workout behaves like Stop.
  useEffect(() => {
    if (paused) stop();
  }, [paused, stop]);

  // Unmount: silence everything and let the screen sleep.
  useEffect(() => releaseAll, [releaseAll]);

  const phase = run ? pittPhaseAt(now - run.start, run.config) : null;
  const phaseText =
    phase?.phase === 'countdown'
      ? String(Math.ceil(phase.msLeft / 1000))
      : phase?.phase === 'rep'
        ? 'GO'
        : phase?.phase === 'pause'
          ? 'HOLD'
          : '';
  const secLeft = phase && phase.phase !== 'done' ? Math.ceil(phase.msLeft / 1000) : 0;
  const repNow = phase && phase.phase !== 'countdown' ? phase.rep : 0;

  return (
    <div
      className="bg-muted/50 space-y-2 rounded-md p-2"
      data-testid="pitt-timer"
      aria-label="PITT-Force timer"
      role="group"
    >
      {run && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2" aria-live="polite">
            <span
              data-testid="pitt-phase"
              className={
                phase?.phase === 'rep'
                  ? 'text-primary text-4xl font-bold'
                  : 'text-muted-foreground text-4xl font-bold'
              }
            >
              {phaseText}
            </span>
            {phase?.phase !== 'countdown' && (
              <span className="text-muted-foreground text-sm tabular-nums">{secLeft}s</span>
            )}
          </div>
          <span data-testid="pitt-rep" className="text-sm font-medium tabular-nums">
            Rep {repNow} / {run.config.reps}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {run ? (
          <Button variant="destructive" className="flex-1" data-testid="pitt-stop" onClick={stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="flex-1"
            data-testid="pitt-start"
            disabled={!firstOpen || paused}
            onClick={start}
          >
            <Play /> Start PITT timer
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          data-testid="pitt-mute"
          aria-label="Mute timer sound"
          aria-pressed={!sound}
          onClick={toggleSound}
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>
      {stopped && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1"
            data-testid="pitt-log"
            disabled={stopped.reps === 0}
            onClick={() => {
              void setsRepo.updateSet(stopped.setId, { reps: stopped.reps });
              setStopped(null);
            }}
          >
            Log {stopped.reps} reps
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            data-testid="pitt-dismiss"
            onClick={() => setStopped(null)}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}
