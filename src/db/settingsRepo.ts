import type { WeightUnit } from '@/lib/units';
import { db } from './db';

export async function getUnit(): Promise<WeightUnit> {
  const row = await db.settings.get('unit');
  return row?.value === 'lbs' ? 'lbs' : 'kg';
}

export async function setUnit(unit: WeightUnit): Promise<void> {
  await db.settings.put({ key: 'unit', value: unit });
}

export async function getSeedVersion(): Promise<number> {
  const row = await db.settings.get('seedVersion');
  return typeof row?.value === 'number' ? row.value : 0;
}
