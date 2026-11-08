/** Limits for the importable program file (see src/program/programFile.ts). */
export const PROGRAM_FILE = {
  maxBytes: 256 * 1024,
  nameMax: 60,
  daysMax: 14,
  dayNameMax: 40,
  exercisesPerDayMax: 30,
  repsMax: 100,
} as const;
