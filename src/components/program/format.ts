/** 0.25 steps without trailing zeros: 12, 12.5, 12.25. */
export function formatSets(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
