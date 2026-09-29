/**
 * Shared formatting helpers for run metrics.
 * Both ActiveRunScreen and RunResultsScreen use these so the same value is
 * always rendered the same way.
 */

/** Shown when there isn't enough data (or the value would be unreal). */
export const PACE_PLACEHOLDER = '--:--';

/** Below this distance a pace is just noise. */
const MIN_PACE_DISTANCE_KM = 0.03;
/** Anything slower than 20:00 /km is not a real pace. */
const MAX_PACE_SECONDS_PER_KM = 20 * 60;
const MIN_PACE_SECONDS_PER_KM = 2 * 60;

/**
 * Formats pace as `m:ss` (e.g. `4:32`), without unit — callers render the
 * unit themselves (`/km` on the active run, `min/km` on the results card).
 *
 * Returns {@link PACE_PLACEHOLDER} when:
 * - distance is below 0.03 km, or
 * - pace is outside the plausible 2:00-20:00 /km range.
 */
export function formatPace(
  durationSeconds: number,
  distanceKm: number,
): string {
  if (distanceKm < MIN_PACE_DISTANCE_KM) {
    return PACE_PLACEHOLDER;
  }

  const paceSeconds = durationSeconds / distanceKm;
  return formatPaceSeconds(paceSeconds);
}

export function formatPaceSeconds(paceSeconds: number | null): string {
  if (
    paceSeconds === null ||
    !Number.isFinite(paceSeconds) ||
    paceSeconds < MIN_PACE_SECONDS_PER_KM ||
    paceSeconds > MAX_PACE_SECONDS_PER_KM
  ) {
    return PACE_PLACEHOLDER;
  }

  const totalSeconds = Math.round(paceSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
