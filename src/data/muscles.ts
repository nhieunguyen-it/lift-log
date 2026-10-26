export const MUSCLE_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'lower_back',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

export type MuscleGroup = 'push' | 'pull' | 'legs' | 'core';

export interface MuscleDef {
  id: MuscleId;
  name: string;
  group: MuscleGroup;
}

export const MUSCLES: MuscleDef[] = [
  { id: 'chest', name: 'Chest', group: 'push' },
  { id: 'front_delts', name: 'Front Delts', group: 'push' },
  { id: 'side_delts', name: 'Side Delts', group: 'push' },
  { id: 'rear_delts', name: 'Rear Delts', group: 'pull' },
  { id: 'lats', name: 'Lats', group: 'pull' },
  { id: 'upper_back', name: 'Upper Back', group: 'pull' },
  { id: 'lower_back', name: 'Lower Back', group: 'pull' },
  { id: 'biceps', name: 'Biceps', group: 'pull' },
  { id: 'triceps', name: 'Triceps', group: 'push' },
  { id: 'forearms', name: 'Forearms', group: 'pull' },
  { id: 'abs', name: 'Abs', group: 'core' },
  { id: 'obliques', name: 'Obliques', group: 'core' },
  { id: 'glutes', name: 'Glutes', group: 'legs' },
  { id: 'quads', name: 'Quads', group: 'legs' },
  { id: 'hamstrings', name: 'Hamstrings', group: 'legs' },
  { id: 'adductors', name: 'Adductors', group: 'legs' },
  { id: 'calves', name: 'Calves', group: 'legs' },
];
