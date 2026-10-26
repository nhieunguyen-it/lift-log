/** Pure, immutable editing helpers for programs. Callers persist the result. */
import type { RepRange } from '@/config/training';
import type { Program, ProgramDay, ProgramExercise } from './types';

export const MIN_TARGET_SETS = 1;
export const MAX_TARGET_SETS = 20;

const clampSets = (n: number): number =>
  Math.min(MAX_TARGET_SETS, Math.max(MIN_TARGET_SETS, Math.round(n)));

function mapDay(p: Program, dayId: string, fn: (d: ProgramDay) => ProgramDay): Program {
  return { ...p, days: p.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

function mapExercise(
  p: Program,
  dayId: string,
  index: number,
  fn: (e: ProgramExercise) => ProgramExercise,
): Program {
  return mapDay(p, dayId, (d) => ({
    ...d,
    exercises: d.exercises.map((e, i) => (i === index ? fn(e) : e)),
  }));
}

function moveItem<T>(list: T[], index: number, dir: 'up' | 'down'): T[] {
  const j = dir === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return copy;
}

export const renameProgram = (p: Program, name: string): Program => ({ ...p, name });

export const addDay = (p: Program, day: ProgramDay): Program => ({
  ...p,
  days: [...p.days, day],
});

export const removeDay = (p: Program, dayId: string): Program => ({
  ...p,
  days: p.days.filter((d) => d.id !== dayId),
});

export function moveDay(p: Program, dayId: string, dir: 'up' | 'down'): Program {
  return {
    ...p,
    days: moveItem(
      p.days,
      p.days.findIndex((d) => d.id === dayId),
      dir,
    ),
  };
}

export const renameDay = (p: Program, dayId: string, name: string): Program =>
  mapDay(p, dayId, (d) => ({ ...d, name }));

export const addExercise = (
  p: Program,
  dayId: string,
  exerciseId: string,
  targetSets: number,
): Program =>
  mapDay(p, dayId, (d) => ({
    ...d,
    exercises: [...d.exercises, { exerciseId, targetSets: clampSets(targetSets) }],
  }));

export const removeExercise = (p: Program, dayId: string, index: number): Program =>
  mapDay(p, dayId, (d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== index) }));

export const moveExercise = (
  p: Program,
  dayId: string,
  index: number,
  dir: 'up' | 'down',
): Program => mapDay(p, dayId, (d) => ({ ...d, exercises: moveItem(d.exercises, index, dir) }));

export const setTargetSets = (p: Program, dayId: string, index: number, sets: number): Program =>
  mapExercise(p, dayId, index, (e) => ({ ...e, targetSets: clampSets(sets) }));

/** Pass `undefined` to fall back to the exercise's default rep range. Invalid ranges are ignored. */
export function setRepRange(
  p: Program,
  dayId: string,
  index: number,
  range: RepRange | undefined,
): Program {
  if (range && !(Number.isInteger(range.min) && Number.isInteger(range.max))) return p;
  if (range && (range.min < 1 || range.max < range.min)) return p;
  return mapExercise(p, dayId, index, (e) => {
    const { repRange: _drop, ...rest } = e;
    void _drop;
    return range ? { ...rest, repRange: range } : rest;
  });
}

/** Replaces the exercise, keeping its sets and position. A rep range override is dropped. */
export const swapExercise = (
  p: Program,
  dayId: string,
  index: number,
  newExerciseId: string,
): Program =>
  mapExercise(p, dayId, index, (e) => ({ exerciseId: newExerciseId, targetSets: e.targetSets }));
