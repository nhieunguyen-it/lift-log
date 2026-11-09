export type PittSoundKind = 'tick' | 'go' | 'hold' | 'done';

export interface PittSound {
  /** Schedules tones at `atMs` from now (relative to `AudioContext.currentTime`). */
  schedule(events: { atMs: number; kind: PittSoundKind }[]): void;
  /** Stops every scheduled oscillator, played or not. */
  cancel(): void;
}

/** Tone table: [frequency Hz, offset s, duration s] per kind. */
const TONES: Record<PittSoundKind, [number, number, number][]> = {
  tick: [[660, 0, 0.06]],
  go: [[880, 0, 0.15]],
  hold: [[440, 0, 0.15]],
  done: [
    [880, 0, 0.12],
    [1320, 0.12, 0.12],
  ],
};

const PEAK = 0.3;
const ATTACK = 0.005;

type AudioCtor = typeof AudioContext;

// One context per page: browsers cap the number of live AudioContexts.
let shared: AudioContext | null = null;

function audioCtor(): AudioCtor | undefined {
  const w = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Two-tone pacing sounds for the PITT-Force timer. Call inside a click handler so iOS
 * unlocks audio. Returns null when Web Audio is unavailable.
 */
export function createPittSound(): PittSound | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  try {
    shared ??= new Ctor();
  } catch {
    return null;
  }
  const ctx = shared;
  void ctx.resume?.().catch(() => {});
  let scheduled: OscillatorNode[] = [];

  function tone(freq: number, at: number, dur: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(PEAK, at + ATTACK);
    gain.gain.setValueAtTime(PEAK, at + dur - ATTACK);
    gain.gain.linearRampToValueAtTime(0, at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur);
    scheduled.push(osc);
  }

  return {
    schedule(events) {
      const base = ctx.currentTime;
      for (const e of events) {
        for (const [freq, offset, dur] of TONES[e.kind]) {
          tone(freq, base + e.atMs / 1000 + offset, dur);
        }
      }
    },
    cancel() {
      for (const osc of scheduled) {
        try {
          osc.stop();
        } catch {
          // Already stopped.
        }
      }
      scheduled = [];
    },
  };
}
