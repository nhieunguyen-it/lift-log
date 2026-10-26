/**
 * Ordered difficulty chains for bodyweight exercises (easier -> harder). When an exercise
 * hits the top of its rep range, progression suggests the next id in its chain.
 * Only exercises present in the seed are chained; each id appears in at most one chain.
 */
export const VARIANT_CHAINS: readonly (readonly string[])[] = [
  ['inverted-row', 'chin-up', 'pull-up'],
  ['push-up', 'dip'],
  ['crunch', 'hanging-leg-raise'],
  ['bodyweight-squat', 'bodyweight-lunge'],
];

/** The next-harder exercise in the chain, or undefined for the last (or an unchained) id. */
export function nextVariantId(
  exerciseId: string,
  chains: readonly (readonly string[])[] = VARIANT_CHAINS,
): string | undefined {
  for (const chain of chains) {
    const i = chain.indexOf(exerciseId);
    if (i >= 0) return chain[i + 1];
  }
  return undefined;
}
