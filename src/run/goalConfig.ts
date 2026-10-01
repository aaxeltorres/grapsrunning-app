/**
 * Every tunable number of goal runs: setup limits, presets and the
 * off-track alert timing. Change them here only.
 */

/** Distance goal limits, in meters. */
export const GOAL_DISTANCE_MIN_M = 500;
export const GOAL_DISTANCE_MAX_M = 100_000;

/** Time goal limits, in seconds. */
export const GOAL_TIME_MIN_S = 5 * 60;
export const GOAL_TIME_MAX_S = 10 * 60 * 60;

/** Pace goal limits, in seconds per km (fastest and slowest). */
export const GOAL_PACE_MIN_S_PER_KM = 2 * 60 + 30;
export const GOAL_PACE_MAX_S_PER_KM = 15 * 60;

/**
 * Steps of the setup wheels. Suggested fixes are rounded to them, so a
 * suggestion is always a value the wheel can show.
 */
export const GOAL_DISTANCE_STEP_M = 100;
export const GOAL_TIME_STEP_S = 60;
export const GOAL_PACE_STEP_S = 5;

export type DistancePreset = { id: string; label: string; meters: number };

export const GOAL_DISTANCE_PRESETS: DistancePreset[] = [
  { id: '1k', label: '1K', meters: 1000 },
  { id: '5k', label: '5K', meters: 5000 },
  { id: '10k', label: '10K', meters: 10_000 },
  { id: 'half', label: 'Half marathon', meters: 21_097.5 },
];

/** A pace goal is on track within this many seconds per km either way. */
export const PACE_TOLERANCE_S_PER_KM = 10;

/** Current pace is measured over this much moving time. */
export const PACE_SMOOTHING_WINDOW_S = 20;

/** An off-track condition must hold this long before the alert shows... */
export const ALERT_HOLD_S = 10;
/** ...and an on-track one this long before the alert clears. */
export const ALERT_CLEAR_S = 5;

/** No alerts until the run has lasted this long and covered this far. */
export const ALERT_GRACE_S = 60;
export const ALERT_GRACE_KM = 0.2;
