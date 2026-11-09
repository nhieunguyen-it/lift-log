import { z } from 'zod';
import { MUSCLE_IDS, type Equipment } from '@/data';
import { EQUIPMENT } from '@/data/schema';
import { TRAINING } from '@/config/training';
import { resolveTargets, type TargetOverrides, type WeekStartDay } from '@/analysis';
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
export { resolveTargets };
export type { TargetOverrides };

export async function getTargetOverrides(): Promise<TargetOverrides> {
  const row = await db.settings.get('targetOverrides');
  const res = TargetOverridesSchema.safeParse(row?.value ?? {});
  return res.success ? res.data : {};
}

export async function setTargetOverrides(overrides: TargetOverrides): Promise<void> {
  await db.settings.put({ key: 'targetOverrides', value: TargetOverridesSchema.parse(overrides) });
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

// Phase 3 settings.

/** Dismissed deload suggestions: signal key -> dismissed-at epoch ms. */
export const DeloadDismissalsSchema = z.record(z.string(), z.number());
export type DeloadDismissals = z.infer<typeof DeloadDismissalsSchema>;

export async function getDeloadDismissals(): Promise<DeloadDismissals> {
  const res = DeloadDismissalsSchema.safeParse((await db.settings.get('deloadDismissals'))?.value);
  return res.success ? res.data : {};
}

export async function setDeloadDismissals(d: DeloadDismissals): Promise<void> {
  await db.settings.put({ key: 'deloadDismissals', value: DeloadDismissalsSchema.parse(d) });
}

export async function getActiveProgramId(): Promise<string | null> {
  const v = (await db.settings.get('activeProgramId'))?.value;
  return typeof v === 'string' ? v : null;
}

export async function setActiveProgramId(id: string | null): Promise<void> {
  await db.settings.put({ key: 'activeProgramId', value: id });
}

/** Generic boolean flags. */
export type SettingFlag =
  | 'onboardingDone'
  | 'whatsNewPhase3Seen'
  | 'whatsNewPhase4Seen'
  | 'whatsNewPhase5Seen'
  | 'whatsNewCardioSeen';

export async function getFlag(flag: SettingFlag): Promise<boolean> {
  return (await db.settings.get(flag))?.value === true;
}

export async function setFlag(flag: SettingFlag, value: boolean): Promise<void> {
  await db.settings.put({ key: flag, value });
}

// Phase 4 settings.

const BlockRampSchema = z.object({
  setsPerWeek: z.number().int().min(0).max(5),
  maxExtraSets: z.number().int().min(0).max(10),
});
export const ProgramBlockSchema = z.object({
  startDate: z.number(),
  weeks: z.number().int().min(TRAINING.blocks.minWeeks).max(TRAINING.blocks.maxWeeks),
  ramp: BlockRampSchema,
  rampExerciseIds: z.array(z.string().min(1)),
});
/** Running blocks: program id -> block. */
export const ProgramBlocksSchema = z.record(z.string(), ProgramBlockSchema);
export type ProgramBlocks = z.infer<typeof ProgramBlocksSchema>;

export async function getProgramBlocks(): Promise<ProgramBlocks> {
  const res = ProgramBlocksSchema.safeParse((await db.settings.get('programBlocks'))?.value);
  return res.success ? res.data : {};
}

export async function setProgramBlocks(b: ProgramBlocks): Promise<void> {
  await db.settings.put({ key: 'programBlocks', value: ProgramBlocksSchema.parse(b) });
}

export type AnalyzeGrouping = 'muscle' | 'group';

export async function getAnalyzeGrouping(): Promise<AnalyzeGrouping> {
  return (await db.settings.get('analyzeGrouping'))?.value === 'group' ? 'group' : 'muscle';
}

export async function setAnalyzeGrouping(g: AnalyzeGrouping): Promise<void> {
  await db.settings.put({ key: 'analyzeGrouping', value: g });
}

// PITT timer settings.

export interface PittSettings {
  repSec: number;
  pauseSec: number;
  sound: boolean;
}

const PittSecSchema = z.number().int().min(TRAINING.pitt.minSec).max(TRAINING.pitt.maxSec);
const PittPatchSchema = z.object({
  repSec: PittSecSchema.optional(),
  pauseSec: PittSecSchema.optional(),
  sound: z.boolean().optional(),
});

export async function getPittSettings(): Promise<PittSettings> {
  const [rep, pause, sound] = await Promise.all([
    db.settings.get('pittRepSec'),
    db.settings.get('pittPauseSec'),
    db.settings.get('pittSound'),
  ]);
  const r = PittSecSchema.safeParse(rep?.value);
  const p = PittSecSchema.safeParse(pause?.value);
  return {
    repSec: r.success ? r.data : TRAINING.pitt.repSec,
    pauseSec: p.success ? p.data : TRAINING.pitt.pauseSec,
    sound: typeof sound?.value === 'boolean' ? sound.value : true,
  };
}

export async function setPittSettings(patch: Partial<PittSettings>): Promise<void> {
  const v = PittPatchSchema.parse(patch);
  if (v.repSec !== undefined) await db.settings.put({ key: 'pittRepSec', value: v.repSec });
  if (v.pauseSec !== undefined) await db.settings.put({ key: 'pittPauseSec', value: v.pauseSec });
  if (v.sound !== undefined) await db.settings.put({ key: 'pittSound', value: v.sound });
}
