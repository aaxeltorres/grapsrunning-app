/**
 * Tunable numbers of plan workout runs. Every alert number (tolerance,
 * timing, per-step grace, short steps) lives in goalConfig.ts.
 */

/** The haptic countdown before a timed work step starts: 3, 2, 1. */
export const WORK_COUNTDOWN_S = 3;

// What GPS can measure: a phone needs several seconds and tens of meters
// to settle on a pace or a distance.

/** Shorter efforts are countdowns with no pace target (no pace alert). */
export const MIN_PACED_EFFORT_S = 30;
/** Shorter sprints aren't measured: they are manual steps ended with "Done". */
export const MIN_MEASURED_DISTANCE_M = 100;
