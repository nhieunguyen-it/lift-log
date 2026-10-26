/** Small helpers shared by the inline-SVG charts. */

export const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** "Nice" upper/lower bounds with a little headroom. */
export function paddedRange(values: number[], include: number[] = []): [number, number] {
  const all = [...values, ...include];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

export const scale = (v: number, lo: number, hi: number, a: number, b: number) =>
  a + ((v - lo) / (hi - lo)) * (b - a);

export const round1 = (n: number) => Math.round(n * 10) / 10;
