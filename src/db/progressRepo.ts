import { getDeloadDismissals, setDeloadDismissals } from './settingsRepo';
import { TRAINING } from '@/config/training';

/** Hide this suggestion for `deload.dismissMs`. Also prunes expired dismissals. */
export async function dismissDeload(key: string, now = Date.now()): Promise<void> {
  const current = await getDeloadDismissals();
  const kept: Record<string, number> = {};
  for (const [k, at] of Object.entries(current)) {
    if (now - at < TRAINING.deload.dismissMs) kept[k] = at;
  }
  kept[key] = now;
  await setDeloadDismissals(kept);
}
