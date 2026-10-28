import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { exercises } from '@/data';
import { PROFILES } from '@/config/profiles';
import { bindDb, db } from './db';
import { createProfile, listProfiles, registry, resolveDbName } from './profiles';
import { ensureSeed } from './seed';
import { getAnalysis } from './analysisRepo';

const BUDGET_MS = 300;
const DAY = 86_400_000;

async function wipe(): Promise<void> {
  bindDb(PROFILES.legacyDbName);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const n of await Dexie.getDatabaseNames()) {
    if (n !== PROFILES.registryDbName && n !== PROFILES.legacyDbName) await Dexie.delete(n);
  }
  await registry.profiles.clear();
  await registry.meta.clear();
}

afterEach(wipe);

describe('profile startup performance with a year of data', () => {
  it(`registry read + bind/open + seed-skip + analysis < ${BUDGET_MS} ms`, async () => {
    const ids = exercises.slice(0, 40).map((e) => e.id);
    const profile = await createProfile('Perf');
    const name = resolveDbName(profile.id);

    // Build ~150 sessions over one year (untimed).
    const now = Date.now();
    const sessions = [];
    const sessionExercises = [];
    const sets = [];
    let n = 0;
    for (let i = 0; i < 150; i++) {
      const startedAt = now - Math.floor((i * 365 * DAY) / 150) - 3_600_000;
      const sid = `s${i}`;
      sessions.push({ id: sid, startedAt, finishedAt: startedAt + 3_000_000 });
      for (let e = 0; e < 4; e++) {
        const seid = `se${i}-${e}`;
        sessionExercises.push({
          id: seid,
          sessionId: sid,
          exerciseId: ids[(i * 3 + e) % ids.length],
          order: e,
        });
        for (let k = 0; k < 4; k++) {
          sets.push({
            id: `set${n++}`,
            sessionExerciseId: seid,
            order: k,
            weightKg: 40 + ((i + e) % 30),
            reps: 6 + (k % 5),
            rir: 2,
            isWarmup: false,
            completedAt: startedAt + 60_000 * (e * 4 + k + 1),
          });
        }
      }
    }
    bindDb(name, 'Perf');
    await ensureSeed();
    await db.sessions.bulkAdd(sessions);
    await db.sessionExercises.bulkAdd(sessionExercises);
    await db.sets.bulkAdd(sets);
    bindDb(PROFILES.legacyDbName); // close, so the timed part includes a real open

    const t0 = performance.now();
    const list = await listProfiles();
    bindDb(name, 'Perf');
    await db.open();
    const reseeded = await ensureSeed();
    const view = await getAnalysis(now);
    const elapsed = performance.now() - t0;

    expect(list.length).toBe(2);
    expect(reseeded).toBe(false);
    expect(view.empty).toBe(false);
    expect(await db.sets.count()).toBe(sets.length);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  }, 30_000);
});
