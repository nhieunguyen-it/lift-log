import { z } from 'zod';
import { MUSCLE_IDS, type Equipment, type MuscleId } from '@/data';
import { EQUIPMENT } from '@/data/schema';
import { DEFAULT_TARGETS, type VolumeTarget } from '@/config/training';
import type { WeekStartDay } from '@/analyzer/types';
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

export async function getWeekStartsOn(): Promise<WeekStartDay> {
  const row = await db.settings.get('weekStartsOn');
  const v = row?.value;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6 ? (v as WeekStartDay) : 1;
}

export async function setWeekStartsOn(day: WeekStartDay): Promise<void> {
  await db.settings.put({ key: 'weekStartsOn', value: day });
}

export const TargetOverridesSchema = z.partialRecord(
  z.enum(MUSCLE_IDS),
  z
    .object({
      mev: z.number().min(0),
      mavLow: z.number().min(0),
      mavHigh: z.number().min(0),
      mrv: z.number().min(0),
    })
    .refine((t) => t.mev <= t.mavLow && t.mavLow <= t.mavHigh && t.mavHigh <= t.mrv, {
      message: 'targets must satisfy mev <= mavLow <= mavHigh <= mrv',
    }),
);
export type TargetOverrides = Partial<Record<MuscleId, VolumeTarget>>;

export async function getTargetOverrides(): Promise<TargetOverrides> {
  const row = await db.settings.get('targetOverrides');
  const res = TargetOverridesSchema.safeParse(row?.value ?? {});
  return res.success ? res.data : {};
}

export async function setTargetOverrides(overrides: TargetOverrides): Promise<void> {
  await db.settings.put({ key: 'targetOverrides', value: TargetOverridesSchema.parse(overrides) });
}

/** Defaults merged with the user's per-muscle overrides. */
export function resolveTargets(overrides: TargetOverrides): Record<MuscleId, VolumeTarget> {
  return { ...DEFAULT_TARGETS, ...overrides };
}

export const EquipmentListSchema = z.array(z.enum(EQUIPMENT));

/** Equipment the user has; defaults to everything. 'bodyweight' is always included. */
export async function getEquipment(): Promise<Equipment[]> {
  const row = await db.settings.get('equipment');
  const res = EquipmentListSchema.safeParse(row?.value);
  const list = res.success ? res.data : [...EQUIPMENT];
  return list.includes('bodyweight') ? list : [...list, 'bodyweight'];
}

export async function setEquipment(list: Equipment[]): Promise<void> {
  await db.settings.put({ key: 'equipment', value: EquipmentListSchema.parse(list) });
}
