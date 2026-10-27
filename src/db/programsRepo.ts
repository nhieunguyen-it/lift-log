import type { ExerciseMuscle } from '@/data';
import { TRAINING } from '@/config/training';
import type { MergedExercise } from '@/data/merged';
import { alternatives } from '@/recommend';
import type { AlternativeScore } from '@/recommend';
import { planCheck } from '@/program/planCheck';
import {
  applyBlockWeek,
  blockWeekAt,
  defaultRampExerciseIds,
  newBlock,
  projectBlock,
} from '@/program/block';
import { BUILT_IN_PROGRAMS, getBuiltInProgram } from '@/program/templates';
import * as edit from '@/program/edit';
import type {
  BlockProjection,
  PlanCheck,
  Program,
  ProgramBlock,
  ProgramDay,
} from '@/program/types';
import { db, newId } from './db';
import { loadMergedExercises } from './customExercisesRepo';
import { addExercise, getActiveSession, startSession } from './sessionsRepo';
import {
  getActiveProgramId,
  getEquipment,
  getProgramBlocks,
  getTargetOverrides,
  getWeekStartsOn,
  setProgramBlocks,
  resolveTargets,
  setActiveProgramId,
} from './settingsRepo';
import type { Session, SetRow } from './types';

const DEFAULT_DAY_NAME = 'Day';

/** Built-in templates (first) followed by user programs, newest edit first. */
export async function listPrograms(): Promise<Program[]> {
  const user = await db.programs.orderBy('updatedAt').reverse().toArray();
  return [...BUILT_IN_PROGRAMS, ...user];
}

export async function listUserPrograms(): Promise<Program[]> {
  return db.programs.orderBy('updatedAt').reverse().toArray();
}

export async function getProgram(id: string): Promise<Program | undefined> {
  return getBuiltInProgram(id) ?? (await db.programs.get(id));
}

/** The active program, or null when none is set or it was deleted. */
export async function getActiveProgram(): Promise<Program | null> {
  const id = await getActiveProgramId();
  return id ? ((await getProgram(id)) ?? null) : null;
}

function makeDay(name: string): ProgramDay {
  return { id: newId(), name, exercises: [] };
}

export async function createProgram(name = 'New program', now = Date.now()): Promise<Program> {
  const p: Program = {
    id: newId(),
    name: name.trim() || 'New program',
    builtIn: false,
    days: [makeDay(`${DEFAULT_DAY_NAME} 1`)],
    createdAt: now,
    updatedAt: now,
  };
  await db.programs.add(p);
  return p;
}

/** Copies any program (built-in or user) into a new editable user program. */
export async function duplicateProgram(id: string, now = Date.now()): Promise<Program> {
  const src = await getProgram(id);
  if (!src) throw new Error(`Program not found: ${id}`);
  const copy: Program = {
    id: newId(),
    name: src.builtIn ? `${src.name} (copy)` : `${src.name} copy`,
    builtIn: false,
    days: src.days.map((d) => ({
      id: newId(),
      name: d.name,
      exercises: d.exercises.map((e) => ({ ...e, repRange: e.repRange && { ...e.repRange } })),
    })),
    createdAt: now,
    updatedAt: now,
  };
  await db.programs.add(copy);
  return copy;
}

/**
 * Applies an edit (use the pure helpers in `@/program/edit`) to a user program.
 * Built-ins are read-only: duplicate first.
 */
export async function updateProgram(
  id: string,
  fn: (p: Program) => Program,
  now = Date.now(),
): Promise<Program> {
  if (getBuiltInProgram(id)) throw new Error('Built-in programs are read-only; duplicate first.');
  return db.transaction('rw', db.programs, async () => {
    const cur = await db.programs.get(id);
    if (!cur) throw new Error(`Program not found: ${id}`);
    const next: Program = { ...fn(cur), id: cur.id, builtIn: false, updatedAt: now };
    await db.programs.put(next);
    return next;
  });
}

export async function addDayToProgram(id: string, name?: string): Promise<void> {
  await updateProgram(id, (p) =>
    edit.addDay(p, makeDay(name ?? `${DEFAULT_DAY_NAME} ${p.days.length + 1}`)),
  );
}

export async function deleteProgram(id: string): Promise<void> {
  if (getBuiltInProgram(id)) throw new Error('Built-in programs cannot be deleted.');
  await db.transaction('rw', [db.programs, db.settings], async () => {
    await db.programs.delete(id);
    if ((await getActiveProgramId()) === id) await setActiveProgramId(null);
  });
}

/** Activates a program (built-in or user); pass null to deactivate. */
export async function activateProgram(id: string | null): Promise<void> {
  if (id !== null && !(await getProgram(id))) throw new Error(`Program not found: ${id}`);
  await setActiveProgramId(id);
}

/**
 * Starts a session from a program day: exercises in order, `targetSets` blank set rows each
 * (no weight/reps/rir prefilled). If a session is already active it is returned untouched.
 * Exercises that no longer exist (deleted customs) are skipped.
 */
export async function startProgramDay(
  programId: string,
  dayId: string,
  now = Date.now(),
): Promise<Session> {
  return db.transaction(
    'rw',
    [
      db.sessions,
      db.sessionExercises,
      db.sets,
      db.programs,
      db.settings,
      db.exercises,
      db.exerciseMuscles,
      db.customExercises,
      db.customExerciseMuscles,
    ],
    async () => {
      const program = await getProgram(programId);
      const day = program?.days.find((d) => d.id === dayId);
      if (!program || !day) throw new Error('Program day not found');
      const { exercises } = await loadMergedExercises();
      const known = new Set(exercises.map((e) => e.id));

      const active = await getActiveSession();
      if (active) return active;
      if (!day.exercises.some((pe) => known.has(pe.exerciseId))) {
        throw new Error('None of this day’s exercises exist any more.');
      }

      const block = (await getProgramBlocks())[programId];
      const blockWeek = block ? blockWeekAt(block, now, await getWeekStartsOn()) : null;
      const planned = block && blockWeek ? applyBlockWeek(program, block, blockWeek) : program;
      const plannedDay = planned.days.find((d) => d.id === dayId) ?? day;

      const session = await startSession(now);
      const tags: Partial<Session> = { programId, programDayId: dayId };
      if (blockWeek) tags.blockWeek = blockWeek;
      await db.sessions.update(session.id, tags);
      Object.assign(session, tags);
      for (const pe of plannedDay.exercises) {
        if (!known.has(pe.exerciseId)) continue;
        const se = await addExercise(session.id, pe.exerciseId);
        const rows: SetRow[] = Array.from({ length: pe.targetSets }, (_, order) => ({
          id: newId(),
          sessionExerciseId: se.id,
          order,
          reps: 0,
          isWarmup: false,
        }));
        await db.sets.bulkAdd(rows);
      }
      return session;
    },
  );
}

export interface PlanData {
  exercises: MergedExercise[];
  exerciseMuscles: ExerciseMuscle[];
  targets: ReturnType<typeof resolveTargets>;
}

export async function loadPlanData(): Promise<PlanData> {
  const [merged, overrides] = await Promise.all([loadMergedExercises(), getTargetOverrides()]);
  return { ...merged, targets: resolveTargets(overrides) };
}

/** Projected weekly volume for a program, using custom exercises and the user's targets. */
export async function getPlanCheck(programId: string): Promise<PlanCheck | null> {
  const [program, data] = await Promise.all([getProgram(programId), loadPlanData()]);
  return program ? planCheck(program, data.exercises, data.exerciseMuscles, data.targets) : null;
}

/** Swap suggestions (user's equipment only) for an exercise in a program. */
export async function getProgramAlternatives(exerciseId: string): Promise<AlternativeScore[]> {
  const [{ exercises, exerciseMuscles }, equipment] = await Promise.all([
    loadMergedExercises(),
    getEquipment(),
  ]);
  return alternatives({
    exerciseId,
    availableEquipment: equipment,
    exercisesDoneThisWeek: [],
    exercises,
    exerciseMuscles,
    config: TRAINING,
  });
}

/** Replaces one exercise in a user program, keeping its sets and position. */
export async function swapProgramExercise(
  programId: string,
  dayId: string,
  index: number,
  newExerciseId: string,
): Promise<void> {
  await updateProgram(programId, (p) => edit.swapExercise(p, dayId, index, newExerciseId));
}

export interface StartBlockOpts {
  /** Defaults to every day's first exercise. */
  rampExerciseIds?: string[];
  weeks?: number;
  /** Defaults to now; week 1 is the calendar week containing it. */
  now?: number;
}

/** Starts (or replaces) a block for a program; week 1 is the current week. */
export async function startBlock(
  programId: string,
  opts: StartBlockOpts = {},
): Promise<ProgramBlock> {
  const program = await getProgram(programId);
  if (!program) throw new Error(`Program not found: ${programId}`);
  const block = newBlock(
    opts.now ?? Date.now(),
    await getWeekStartsOn(),
    opts.rampExerciseIds ?? defaultRampExerciseIds(program),
    opts.weeks,
  );
  await db.transaction('rw', db.settings, async () => {
    await setProgramBlocks({ ...(await getProgramBlocks()), [programId]: block });
  });
  return block;
}

/** Restarts the running block: same settings, week 1 = this week. */
export async function restartBlock(programId: string, now = Date.now()): Promise<ProgramBlock> {
  const cur = (await getProgramBlocks())[programId];
  if (!cur) throw new Error('No block to restart');
  const next: ProgramBlock = {
    ...cur,
    startDate: newBlock(now, await getWeekStartsOn(), []).startDate,
  };
  await db.transaction('rw', db.settings, async () => {
    await setProgramBlocks({ ...(await getProgramBlocks()), [programId]: next });
  });
  return next;
}

export async function endBlock(programId: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const { [programId]: _gone, ...rest } = await getProgramBlocks();
    void _gone;
    await setProgramBlocks(rest);
  });
}

export interface BlockView {
  block: ProgramBlock;
  /** 1-based current week; null when before the start or after the last week. */
  currentWeek: number | null;
  projection: BlockProjection;
}

/** `null` when the program has no block (or is gone). */
export async function getBlockView(programId: string, now = Date.now()): Promise<BlockView | null> {
  const [program, block, data, wso] = await Promise.all([
    getProgram(programId),
    getProgramBlocks().then((b) => b[programId]),
    loadPlanData(),
    getWeekStartsOn(),
  ]);
  if (!program || !block) return null;
  return {
    block,
    currentWeek: blockWeekAt(block, now, wso),
    projection: projectBlock(program, block, data),
  };
}
