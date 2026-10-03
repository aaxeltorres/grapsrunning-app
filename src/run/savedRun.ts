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
import { formatMonthLabel, toISODate } from '../utils/dates';
import { hasEnoughPaceData } from '../utils/format';
import type { RunGoal } from './goals';
import { RUN_MODES, type RunModeId } from './runModes';
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

/** A route spread over less than this (about 11 m) is a run that stood still. */
const MIN_ROUTE_SPAN_DEG = 0.0001;

/**
 * Whether the route is worth drawing on a map: at least two valid points
 * that are not all in the same spot.
 */
export function hasUsableRoute(route: RouteCoordinate[]): boolean {
  if (route.length < 2) return false;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const { latitude, longitude } of route) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  }
  return maxLat - minLat >= MIN_ROUTE_SPAN_DEG || maxLng - minLng >= MIN_ROUTE_SPAN_DEG;
}

/** The small tag of a run in the history: its planned workout or its mode. A quick run has none. */
export function runTagLabel(run: SavedRun): string | undefined {
  if (run.planned) return run.planned.title;
  if (run.mode === 'goal') return 'Goal run';
  if (run.mode === 'intervals') return RUN_MODES.intervals.name;
  return undefined;
}

/**
 * The freshly loaded runs, reusing the objects of `current` that have the
 * same id (a saved run never changes), and `current` itself when nothing
 * changed. Keeps memoized rows from re-rendering on every reload.
 */
export function reuseRuns(current: SavedRun[] | null, loaded: SavedRun[]): SavedRun[] {
  if (!current) return loaded;
  const known = new Map(current.map((run) => [run.id, run]));
  const merged = loaded.map((run) => known.get(run.id) ?? run);
  const unchanged =
    merged.length === current.length && merged.every((run, i) => run === current[i]);
  return unchanged ? current : merged;
}

export type RunMonthSection = {
  /** "2026-10" */
  key: string;
  /** "October 2026" */
  title: string;
  data: SavedRun[];
  totalMeters: number;
};

/**
 * The runs grouped by calendar month in the device's local time, in the
 * order given (newest first stays newest first).
 */
export function groupRunsByMonth(runs: SavedRun[]): RunMonthSection[] {
  const sections: RunMonthSection[] = [];
  for (const run of runs) {
    const iso = toISODate(new Date(run.startedAt));
    const key = iso.slice(0, 7);
    let section = sections.find((s) => s.key === key);
    if (!section) {
      section = { key, title: formatMonthLabel(iso), data: [], totalMeters: 0 };
      sections.push(section);
    }
    section.data.push(run);
    section.totalMeters += run.distanceMeters;
  }
  return sections;
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
