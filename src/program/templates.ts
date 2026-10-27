/** Built-in program templates. Read-only; duplicate before editing. */
import type { Program, ProgramDay, ProgramExercise } from './types';

const BUILT_IN_TS = 0;

type Spec = [exerciseId: string, targetSets: number];

function day(id: string, name: string, specs: Spec[]): ProgramDay {
  const exercises: ProgramExercise[] = specs.map(([exerciseId, targetSets]) => ({
    exerciseId,
    targetSets,
  }));
  return { id, name, exercises };
}

function template(id: string, name: string, days: ProgramDay[]): Program {
  return {
    id: `builtin-${id}`,
    name,
    builtIn: true,
    days,
    createdAt: BUILT_IN_TS,
    updatedAt: BUILT_IN_TS,
  };
}

export const FULL_BODY: Program = template('full-body', 'Full Body 3x/week', [
  day('fb-a', 'Full Body A', [
    ['barbell-back-squat', 4],
    ['incline-dumbbell-press', 4],
    ['pull-up', 4],
    ['close-grip-bench-press', 3],
    ['leg-press', 4],
    ['push-up', 4],
    ['face-pull', 4],
    ['dumbbell-bicep-curl', 3],
    ['russian-twist', 4],
  ]),
  day('fb-b', 'Full Body B', [
    ['romanian-deadlift', 4],
    ['dumbbell-shoulder-press', 4],
    ['chin-up', 4],
    ['close-grip-bench-press', 3],
    ['single-leg-romanian-deadlift', 4],
    ['dumbbell-lateral-raise', 4],
    ['face-pull', 4],
    ['cable-curl', 2],
    ['standing-calf-raise', 4],
  ]),
  day('fb-c', 'Full Body C', [
    ['barbell-back-squat', 4],
    ['seated-dumbbell-press', 4],
    ['barbell-row', 3],
    ['chin-up', 4],
    ['pull-up', 3],
    ['seated-calf-raise', 4],
    ['side-plank', 4],
    ['triceps-pushdown', 2],
    ['russian-twist', 4],
  ]),
]);

export const UPPER_LOWER: Program = template('upper-lower', 'Upper/Lower 4x/week', [
  day('ul-u1', 'Upper 1', [
    ['seated-dumbbell-press', 4],
    ['chin-up', 4],
    ['pull-up', 4],
    ['one-arm-dumbbell-row', 4],
    ['machine-chest-press', 3],
    ['push-up', 3],
    ['cable-curl', 3],
    ['triceps-pushdown', 3],
    ['face-pull', 4],
  ]),
  day('ul-l1', 'Lower 1', [
    ['barbell-back-squat', 4],
    ['romanian-deadlift', 4],
    ['sumo-squat', 4],
    ['standing-calf-raise', 4],
    ['seated-calf-raise', 3],
    ['hanging-leg-raise', 4],
    ['side-plank', 3],
  ]),
  day('ul-u2', 'Upper 2', [
    ['close-grip-bench-press', 4],
    ['seated-dumbbell-press', 4],
    ['chin-up', 4],
    ['push-up', 4],
    ['inverted-row', 3],
    ['dumbbell-lateral-raise', 4],
    ['dumbbell-bicep-curl', 2],
    ['dumbbell-reverse-fly', 4],
  ]),
  day('ul-l2', 'Lower 2', [
    ['romanian-deadlift', 4],
    ['sumo-squat', 3],
    ['leg-press', 2],
    ['seated-calf-raise', 3],
    ['hanging-leg-raise', 3],
    ['russian-twist', 3],
    ['side-plank', 3],
  ]),
]);

export const PUSH_PULL_LEGS: Program = template('ppl', 'Push/Pull/Legs 6x/week', [
  day('ppl-push1', 'Push 1', [
    ['close-grip-bench-press', 3],
    ['seated-dumbbell-press', 3],
    ['dumbbell-bench-press', 2],
    ['machine-chest-press', 2],
    ['triceps-pushdown', 3],
    ['dumbbell-lateral-raise', 3],
  ]),
  day('ppl-pull1', 'Pull 1', [
    ['chin-up', 4],
    ['t-bar-row', 3],
    ['pull-up', 2],
    ['dumbbell-reverse-fly', 3],
    ['dumbbell-bicep-curl', 3],
    ['face-pull', 2],
  ]),
  day('ppl-legs1', 'Legs 1', [
    ['barbell-back-squat', 4],
    ['romanian-deadlift', 4],
    ['dumbbell-lunge', 4],
    ['leg-press', 2],
    ['standing-calf-raise', 4],
    ['hanging-leg-raise', 4],
    ['side-plank', 4],
  ]),
  day('ppl-push2', 'Push 2', [
    ['dumbbell-shoulder-press', 3],
    ['incline-barbell-bench-press', 2],
    ['machine-chest-press', 3],
    ['seated-dumbbell-press', 3],
    ['push-up', 2],
  ]),
  day('ppl-pull2', 'Pull 2', [
    ['chin-up', 4],
    ['one-arm-dumbbell-row', 2],
    ['inverted-row', 2],
    ['pull-up', 2],
    ['cable-curl', 2],
    ['dumbbell-reverse-fly', 3],
  ]),
  day('ppl-legs2', 'Legs 2', [
    ['sumo-squat', 4],
    ['single-leg-romanian-deadlift', 3],
    ['seated-calf-raise', 4],
    ['standing-calf-raise', 3],
    ['hanging-leg-raise', 4],
    ['side-plank', 4],
    ['crunch', 2],
  ]),
]);

export const BUILT_IN_PROGRAMS: readonly Program[] = [FULL_BODY, UPPER_LOWER, PUSH_PULL_LEGS];

export const isBuiltInId = (id: string): boolean => id.startsWith('builtin-');

export function getBuiltInProgram(id: string): Program | undefined {
  return BUILT_IN_PROGRAMS.find((p) => p.id === id);
}
