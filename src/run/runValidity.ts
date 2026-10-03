/**
 * Which finished runs are worth keeping. Pure logic (no React): the run
 * history stores a run only when it passes, and Run results shows the
 * "too short" notice when it doesn't. A run the user started and finished
 * right away, or one with GPS points but no real distance, never counts.
 */

/** A run shorter than this is not saved. */
export const MIN_DISTANCE_METERS = 500;
/** Moving time (paused time excluded) under this is not saved. */
export const MIN_DURATION_SEC = 180;

export function isRunSaveable(distanceMeters: number, movingDurationSec: number): boolean {
  return (
    Number.isFinite(distanceMeters) &&
    Number.isFinite(movingDurationSec) &&
    distanceMeters >= MIN_DISTANCE_METERS &&
    movingDurationSec >= MIN_DURATION_SEC
  );
}
