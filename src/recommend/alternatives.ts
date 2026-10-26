import type { Equipment, Exercise, ExerciseMuscle } from '@/data';
import { MUSCLE_IDS } from '@/data';
import { TRAINING } from '@/config/training';
import type { TrainingConfig } from '@/config/training';
import type { AlternativeScore, AlternativesInput } from './types';
import { isAvailable } from './volume';

export function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of Object.keys(a)) {
    const x = a[k] ?? 0;
    na += x * x;
    dot += x * (b[k] ?? 0);
  }
  for (const k of Object.keys(b)) nb += (b[k] ?? 0) ** 2;
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function alternatives(
  args: AlternativesInput & {
    exercises: Exercise[];
    exerciseMuscles: ExerciseMuscle[];
    config?: TrainingConfig;
  },
): AlternativeScore[] {
  const { exerciseId, exercises, exerciseMuscles, exercisesDoneThisWeek } = args;
  const available: readonly Equipment[] = args.availableEquipment;
  const config = args.config ?? TRAINING;
  const w = config.alternatives;

  const vectors = new Map<string, Record<string, number>>();
  for (const em of exerciseMuscles) {
    let v = vectors.get(em.exerciseId);
    if (!v) {
      v = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0]));
      vectors.set(em.exerciseId, v);
    }
    v[em.muscleId] = em.weight;
  }
  const source = exercises.find((e) => e.id === exerciseId);
  const sourceVec = vectors.get(exerciseId);
  if (!source || !sourceVec) return [];
  const done = new Set(exercisesDoneThisWeek);

  return exercises
    .filter(
      (e) =>
        e.id !== exerciseId &&
        (e as { deletedAt?: number }).deletedAt === undefined &&
        isAvailable(e, available),
    )
    .map((e): AlternativeScore => {
      const similarity = cosineSimilarity(sourceVec, vectors.get(e.id) ?? {});
      const sameForce = e.force === source.force;
      const sameMechanic = e.mechanic === source.mechanic;
      const doneThisWeek = done.has(e.id);
      const score =
        w.weightSimilarity * similarity +
        w.weightForce * (sameForce ? 1 : 0) +
        w.weightMechanic * (sameMechanic ? 1 : 0) +
        w.weightEquipment -
        (doneThisWeek ? w.penaltyDoneThisWeek : 0);
      return { exerciseId: e.id, score, similarity, sameForce, sameMechanic, doneThisWeek };
    })
    .sort((a, b) => b.score - a.score || a.exerciseId.localeCompare(b.exerciseId))
    .slice(0, w.limit);
}
