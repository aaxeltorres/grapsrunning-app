/**
 * Every number of the "Intervals" setup: how many blocks, reps and sets,
 * the values the wheels offer, the limits of a whole workout and the
 * estimates used for steps that end on a tap. Change them here only. What
 * GPS can measure (30 s, 100 m) lives in workoutConfig.ts.
 */

export const MAX_BLOCKS = 4;

export const REPS_MIN = 1;
export const REPS_MAX = 30;
export const SETS_MIN = 1;
export const SETS_MAX = 10;

/** Work by distance: the values the wheel offers, in meters. */
export const WORK_DISTANCES_M: readonly number[] = [
  20, 30, 40, 50, 60, 80, 100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200,
  1500, 2000, 3000, 4000, 5000,
];

/** Work by time, in seconds. */
export const WORK_TIME_MIN_S = 5;
export const WORK_TIME_MAX_S = 20 * 60;
export const WORK_TIME_STEP_S = 5;

/** Rest between reps, in seconds. */
export const REST_MIN_S = 5;
export const REST_MAX_S = 10 * 60;
export const REST_STEP_S = 5;

/** Rest between sets, in seconds. */
export const SET_REST_MIN_S = 30;
export const SET_REST_MAX_S = 15 * 60;
export const SET_REST_STEP_S = 15;

/** Warm-up and cool-down, in minutes. */
export const WARMUP_MIN_MINUTES = 3;
export const WARMUP_MAX_MINUTES = 30;
export const DEFAULT_WARMUP_MINUTES = 10;
export const DEFAULT_COOLDOWN_MINUTES = 5;

/** Longest workout (estimated) and most efforts in one workout. */
export const MAX_TOTAL_S = 3 * 60 * 60;
export const MAX_TOTAL_REPS = 100;

/** Estimated length of a rest ended with "Ready", for totals and the bar only. */
export const MANUAL_REST_ESTIMATE_S = 90;
export const MANUAL_SET_REST_ESTIMATE_S = 240;
/** Shortest estimate of a manual effort (a very short sprint). */
export const MANUAL_EFFORT_MIN_ESTIMATE_S = 3;
