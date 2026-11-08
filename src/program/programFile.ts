/** Pure parse/validate/convert for the importable program file. No React or Dexie. */
import { z } from 'zod';
import { PROGRAM_FILE } from '@/config/programFile';
import { MAX_TARGET_SETS, MIN_TARGET_SETS, NOTE_MAX } from './edit';
import type { Program } from './types';

const L = PROGRAM_FILE;

const repsMsg = `reps must be whole numbers between 1 and ${L.repsMax}`;
const RepNumber = z
  .number({ error: repsMsg })
  .int(repsMsg)
  .min(1, repsMsg)
  .max(L.repsMax, repsMsg);

const setsMsg = `sets must be between ${MIN_TARGET_SETS} and ${MAX_TARGET_SETS}`;
const noteMsg = `note must be at most ${NOTE_MAX} characters`;

const ExerciseSchema = z.strictObject({
  exerciseId: z
    .string({ error: 'exerciseId must be a non-empty string' })
    .min(1, 'exerciseId must be a non-empty string'),
  sets: z
    .number({ error: setsMsg })
    .int(setsMsg)
    .min(MIN_TARGET_SETS, setsMsg)
    .max(MAX_TARGET_SETS, setsMsg),
  reps: z
    .strictObject({ min: RepNumber, max: RepNumber })
    .refine((r) => r.min <= r.max, { error: 'reps min must not be greater than max' })
    .optional(),
  note: z.string({ error: noteMsg }).trim().max(NOTE_MAX, noteMsg).optional(),
});

const dayNameMsg = `name must be 1 to ${L.dayNameMax} characters`;
const exercisesMsg = `exercises must have 1 to ${L.exercisesPerDayMax} entries`;
const DaySchema = z.strictObject({
  name: z.string({ error: dayNameMsg }).trim().min(1, dayNameMsg).max(L.dayNameMax, dayNameMsg),
  exercises: z
    .array(ExerciseSchema, { error: exercisesMsg })
    .min(1, exercisesMsg)
    .max(L.exercisesPerDayMax, exercisesMsg),
});

const nameMsg = `name must be 1 to ${L.nameMax} characters`;
const daysMsg = `days must have 1 to ${L.daysMax} entries`;

const ProgramFileSchema = z.strictObject({
  app: z.literal('lift-log', { error: 'app must be "lift-log"' }),
  kind: z.literal('program', { error: 'kind must be "program"' }),
  version: z.literal(1, { error: 'version must be 1' }),
  program: z.strictObject(
    {
      name: z.string({ error: nameMsg }).trim().min(1, nameMsg).max(L.nameMax, nameMsg),
      days: z.array(DaySchema, { error: daysMsg }).min(1, daysMsg).max(L.daysMax, daysMsg),
    },
    { error: 'program must be an object with a name and days' },
  ),
});

export type ProgramFile = z.infer<typeof ProgramFileSchema>;
export type ParseProgramFileResult =
  | { ok: true; file: ProgramFile }
  | { ok: false; errors: string[] };

const NOT_JSON = "This file isn't a Lift-Log program file (not valid JSON).";
const BACKUP = 'This is a Lift-Log backup. Import it from Settings → Backup.';
const TOO_LARGE = `This file is too large (max ${L.maxBytes / 1024} KB).`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function issueMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys') {
    return `unknown field ${issue.keys.map((k) => `"${k}"`).join(', ')}`;
  }
  return issue.message;
}

function mapIssue(issue: z.core.$ZodIssue, raw: unknown): string {
  const msg = issueMessage(issue);
  const path = issue.path;
  if (path[0] !== 'program' || path[1] !== 'days' || typeof path[2] !== 'number') {
    return path[0] === 'program' && path.length > 1 ? `program ${msg}` : msg;
  }
  const dayIdx = path[2];
  const days = isRecord(raw) && isRecord(raw.program) ? raw.program.days : undefined;
  const day = Array.isArray(days) ? (days[dayIdx] as unknown) : undefined;
  const dayName = isRecord(day) && typeof day.name === 'string' ? day.name.trim() : '';
  const prefix = `Day ${dayIdx + 1} "${dayName}"`;
  if (path[3] === 'exercises' && typeof path[4] === 'number') {
    return `${prefix}, exercise ${path[4] + 1}: ${msg}`;
  }
  return `${prefix}: ${msg}`;
}

export function parseProgramFile(text: string): ParseProgramFileResult {
  // Limit is on UTF-16 length (bounds parse cost), not exact bytes.
  if (text.length > L.maxBytes) return { ok: false, errors: [TOO_LARGE] };
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return { ok: false, errors: [NOT_JSON] };
  }
  if (
    isRecord(raw) &&
    raw.app === 'lift-log' &&
    !('kind' in raw) &&
    ('sessions' in raw || raw.format === 'lift-log-encrypted')
  ) {
    return { ok: false, errors: [BACKUP] };
  }
  const res = ProgramFileSchema.safeParse(raw);
  if (!res.success) {
    return { ok: false, errors: res.error.issues.map((i) => mapIssue(i, raw)) };
  }
  // A whitespace-only note means "no note": drop the key.
  for (const day of res.data.program.days) {
    for (const ex of day.exercises) {
      if (ex.note === '') delete ex.note;
    }
  }
  return { ok: true, file: res.data };
}

export function findUnknownExercises(file: ProgramFile, known: ReadonlySet<string>): string[] {
  const out: string[] = [];
  file.program.days.forEach((day, d) => {
    day.exercises.forEach((ex, e) => {
      if (!known.has(ex.exerciseId)) {
        out.push(`Day ${d + 1} "${day.name}", exercise ${e + 1}: unknown exercise "${ex.exerciseId}"`);
      }
    });
  });
  return out;
}

/** `name`, or `name (2)`, `name (3)`... the first not in `existing` (case-insensitive). */
export function uniqueProgramName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(name.trim().toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${name.slice(0, Math.max(1, L.nameMax - suffix.length)).trimEnd()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function toProgram(
  file: ProgramFile,
  ids: { programId: string; dayIds: string[] },
  name: string,
  now: number,
): Program {
  return {
    id: ids.programId,
    name,
    builtIn: false,
    createdAt: now,
    updatedAt: now,
    days: file.program.days.map((day, i) => ({
      id: ids.dayIds[i],
      name: day.name,
      exercises: day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        targetSets: ex.sets,
        ...(ex.reps ? { repRange: { min: ex.reps.min, max: ex.reps.max } } : {}),
        ...(ex.note ? { note: ex.note } : {}),
      })),
    })),
  };
}
