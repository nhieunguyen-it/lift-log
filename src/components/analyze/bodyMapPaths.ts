import type { MuscleId } from '@/data';

/** Single source of truth: which SVG regions belong to which muscle, per view. */
export type BodyView = 'front' | 'back';

export interface BodyRegion {
  muscleId: MuscleId;
  view: BodyView;
  d: string;
}

/** Ellipse as an SVG path. */
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
/** The same ellipse mirrored around the body's centre line (x = 50). */
const pair = (cx: number, cy: number, rx: number, ry: number) =>
  ell(cx, cy, rx, ry) + ell(100 - cx, cy, rx, ry);
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

export const BODY_REGIONS: BodyRegion[] = [
  // Front
  { muscleId: 'chest', view: 'front', d: pair(41, 52, 10, 8) },
  { muscleId: 'front_delts', view: 'front', d: pair(29, 46, 5, 7) },
  { muscleId: 'side_delts', view: 'front', d: pair(22, 52, 3.5, 6) },
  { muscleId: 'biceps', view: 'front', d: pair(20, 69, 4.5, 9) },
  { muscleId: 'forearms', view: 'front', d: pair(16, 92, 4, 11) },
  { muscleId: 'abs', view: 'front', d: rrect(43, 62, 14, 34, 4) },
  { muscleId: 'obliques', view: 'front', d: pair(37, 82, 4, 12) },
  { muscleId: 'quads', view: 'front', d: pair(40, 128, 8, 23) },
  { muscleId: 'adductors', view: 'front', d: pair(47.5, 120, 2.5, 15) },
  // Back
  { muscleId: 'rear_delts', view: 'back', d: pair(26, 47, 6, 7) },
  { muscleId: 'upper_back', view: 'back', d: ell(50, 52, 13, 9) },
  { muscleId: 'lats', view: 'back', d: pair(38, 74, 8, 12) },
  { muscleId: 'lower_back', view: 'back', d: ell(50, 94, 8, 8) },
  { muscleId: 'triceps', view: 'back', d: pair(20, 69, 4.5, 9) },
  { muscleId: 'glutes', view: 'back', d: pair(43, 108, 8, 8) },
  { muscleId: 'hamstrings', view: 'back', d: pair(40, 135, 7.5, 18) },
  { muscleId: 'calves', view: 'back', d: pair(40, 171, 6, 15) },
];

/** Non-interactive silhouette drawn behind the regions. */
export const SILHOUETTE: string[] = [
  ell(50, 15, 9, 10),
  rrect(28, 34, 44, 66, 10),
  pair(18, 70, 6, 24),
  pair(15, 100, 5, 14),
  pair(40, 135, 11, 50),
  rrect(36, 20, 28, 20, 6),
];

export const VIEW_BOX = '0 0 100 190';
