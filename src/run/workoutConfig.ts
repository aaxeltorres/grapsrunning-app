/**
 * Tunable numbers of plan workout runs. Pace tolerance and alert timing
 * shared with goal runs live in goalConfig.ts.
 */

/**
 * Off-track alerts restart at each segment and stay quiet for this long
 * and this far into it. Shorter than a goal run's start grace, so a 400 m
 * rep can still alert.
 */
export const SEGMENT_ALERT_GRACE_S = 20;
export const SEGMENT_ALERT_GRACE_KM = 0.05;

// What GPS can measure: a phone needs several seconds and tens of meters
// to settle on a pace or a distance.

/** Shorter efforts are countdowns with no pace target (no pace alert). */
export const MIN_PACED_EFFORT_S = 30;
/** Shorter sprints aren't measured: they are manual steps ended with "Done". */
export const MIN_MEASURED_DISTANCE_M = 100;
