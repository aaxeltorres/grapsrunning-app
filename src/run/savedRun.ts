/**
 * Builds the run history entry of a finished run. Pure logic (no React).
 */

import {
  displayName,
  totalDistance,
  totalDuration,
  type RepResult,
  type Workout,
  type WorkoutResult,
} from '../coach/plan';
import type { RouteCoordinate } from '../navigation/types';
import { hasEnoughPaceData } from '../utils/format';
import type { RunGoal } from './goals';
import type { RunModeId } from './runModes';
import type { Split } from './splits';
import { SAVED_RUN_SCHEMA_VERSION, type SavedRun } from './types';

/** The saved route never has more points than this. */
export const MAX_ROUTE_POINTS = 300;

/**
 * At most `max` points, evenly spread, always keeping the first and the
 * last one. A shorter route is returned as it is.
 */
export function downsampleRoute(
  route: RouteCoordinate[],
  max: number = MAX_ROUTE_POINTS,
): RouteCoordinate[] {
  if (route.length <= max) return route;
  if (max < 2) return route.slice(0, Math.max(0, max));
  const last = route.length - 1;
  return Array.from({ length: max }, (_, i) => route[Math.round((i * last) / (max - 1))]);
}

export type FinishedRun = {
  distanceKm: number;
  durationSeconds: number;
  startedAt: number;
  calories?: number;
  route: RouteCoordinate[];
  splits: Split[];
  mode: RunModeId;
  goal?: RunGoal;
  /** Plan workout runs: the workout, whether it was cut short, its stored result. */
  planned?: { workout: Workout; partial: boolean; result?: WorkoutResult };
  reps?: RepResult[];
};

export function buildSavedRun(run: FinishedRun): SavedRun {
  const { planned } = run;
  return {
    schemaVersion: SAVED_RUN_SCHEMA_VERSION,
    id: `run-${run.startedAt}`,
    startedAt: new Date(run.startedAt).toISOString(),
    movingDurationSec: Math.round(run.durationSeconds),
    distanceMeters: Math.round(run.distanceKm * 1000),
    avgPaceSecPerKm: hasEnoughPaceData(run.durationSeconds, run.distanceKm)
      ? run.durationSeconds / run.distanceKm
      : null,
    ...(run.calories !== undefined && { calories: run.calories }),
    route: downsampleRoute(run.route),
    splits: run.splits,
    mode: run.mode,
    ...(run.goal && { goal: run.goal }),
    ...(planned && {
      planned: {
        workoutId: planned.workout.id,
        title: displayName(planned.workout),
        plannedDistanceMeters: totalDistance(planned.workout),
        plannedDurationSeconds: totalDuration(planned.workout),
        partial: planned.partial,
        ...(planned.result && { result: planned.result }),
      },
    }),
    ...(run.reps && run.reps.length > 0 && { reps: run.reps }),
  };
}
