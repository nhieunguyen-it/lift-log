/**
 * Escape list for the "no literal thresholds" test. Text matching any pattern is removed from a
 * guide line before numbers are checked. Keep it tiny: thresholds belong in {{placeholders}}.
 */
export const ALLOWED_LITERAL_PATTERNS: RegExp[] = [
  // Worked bench example: "4 sets -> chest 4, triceps 2, front delts 2" (illustrative arithmetic).
  /4 sets\s*(?:→|->)\s*chest 4,\s*triceps 2,\s*front delts 2/gi,
];
