/**
 * Connects a finished plan run back to the Plan: builds the stored result,
 * marks the workout completed / partial and compares planned with actual.
 * Pure logic, no React.
 */

import {
  totalDistance,
  totalDuration,
  type Plan,
  type RepResult,
  type Workout,
  type WorkoutResult,
} from '../coach/plan';
import { formatClock, formatPaceSeconds, hasEnoughPaceData } from '../utils/format';

/** Pace differences under this are shown as "Even". */
const PACE_EVEN_S_PER_KM = 3;
const TIME_EVEN_S = 5;
const DISTANCE_EVEN_M = 20;

type RunTotals = {
  distanceKm: number;
  durationSeconds: number;
  /** When the run started (ms since epoch). */
  startedAt?: number;
  /** The work steps as they were run; left out when there were none. */
  reps?: RepResult[];
};

/** The numbers worth storing for a finished run. */
export function buildWorkoutResult(
  { distanceKm, durationSeconds, startedAt, reps }: RunTotals,
  completedAt: Date = new Date(),
): WorkoutResult {
  return {
    distanceMeters: Math.round(distanceKm * 1000),
    durationSeconds: Math.round(durationSeconds),
    avgPaceSecPerKm: hasEnoughPaceData(durationSeconds, distanceKm)
      ? durationSeconds / distanceKm
      : null,
    completedAt: completedAt.toISOString(),
    ...(startedAt !== undefined && { startedAt }),
    ...(reps && reps.length > 0 && { reps }),
  };
}

/**
 * The plan with that workout marked `completed` (or `partial` when the run
 * was cut short) and its result saved. Returns the same plan, untouched,
 * when the workout is gone (e.g. the plan was regenerated meanwhile) or was
 * already finished: a first result is never overwritten.
 */
export function recordWorkoutRun(
  plan: Plan,
  workoutId: string,
  run: { result: WorkoutResult; partial: boolean },
): Plan {
  const target = plan.workouts.find((w) => w.id === workoutId);
  if (!target || target.type === 'rest' || target.status !== 'planned') {
    return plan;
  }
  return {
    ...plan,
    workouts: plan.workouts.map((w) =>
      w.id === workoutId
        ? { ...w, status: run.partial ? 'partial' : 'completed', result: run.result }
        : w,
    ),
  };
}

/** What a finished workout shows: the real numbers, or the plan's for old records. */
export function workoutActuals(workout: Workout) {
  if (workout.result) {
    return {
      distanceMeters: workout.result.distanceMeters,
      durationSeconds: workout.result.durationSeconds,
      avgPaceSecPerKm: workout.result.avgPaceSecPerKm,
      fromRun: true,
    };
  }
  const distanceMeters = totalDistance(workout);
  const durationSeconds = totalDuration(workout);
  return {
    distanceMeters,
    durationSeconds,
    avgPaceSecPerKm: distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000) : null,
    fromRun: false,
  };
}

export type ComparisonRow = {
  key: 'distance' | 'time' | 'pace';
  label: string;
  planned: string;
  actual: string;
  /** "+0.30 km", "−1:20", "12 s/km faster", "Even"; `null` when not comparable. */
  delta: string | null;
};

function formatKm2(meters: number) {
  return `${(meters / 1000).toFixed(2)} km`;
}

function signed(value: number, text: string) {
  return `${value < 0 ? '−' : '+'}${text}`;
}

/** Planned vs actual distance, time and average pace of a plan run. */
export function plannedVsActual(
  workout: Workout,
  actual: { distanceMeters: number; durationSeconds: number },
): ComparisonRow[] {
  const plannedMeters = totalDistance(workout);
  const plannedSeconds = totalDuration(workout);

  const distanceDiff = actual.distanceMeters - plannedMeters;
  const timeDiff = actual.durationSeconds - plannedSeconds;

  const plannedPace =
    plannedMeters > 0 ? plannedSeconds / (plannedMeters / 1000) : null;
  const actualPace = hasEnoughPaceData(
    actual.durationSeconds,
    actual.distanceMeters / 1000,
  )
    ? actual.durationSeconds / (actual.distanceMeters / 1000)
    : null;
  const paceDiff =
    plannedPace !== null && actualPace !== null ? actualPace - plannedPace : null;

  return [
    {
      key: 'distance',
      label: 'Distance',
      planned: formatKm2(plannedMeters),
      actual: formatKm2(actual.distanceMeters),
      delta:
        Math.abs(distanceDiff) < DISTANCE_EVEN_M
          ? 'Even'
          : signed(distanceDiff, formatKm2(Math.abs(distanceDiff))),
    },
    {
      key: 'time',
      label: 'Time',
      planned: formatClock(Math.round(plannedSeconds)),
      actual: formatClock(Math.round(actual.durationSeconds)),
      delta:
        Math.abs(timeDiff) < TIME_EVEN_S
          ? 'Even'
          : signed(timeDiff, formatClock(Math.round(Math.abs(timeDiff)))),
    },
    {
      key: 'pace',
      label: 'Avg pace /km',
      planned: formatPaceSeconds(plannedPace),
      actual: formatPaceSeconds(actualPace),
      delta:
        paceDiff === null
          ? null
          : Math.abs(paceDiff) < PACE_EVEN_S_PER_KM
            ? 'Even'
            : `${Math.round(Math.abs(paceDiff))} s/km ${paceDiff < 0 ? 'faster' : 'slower'}`,
    },
  ];
}
