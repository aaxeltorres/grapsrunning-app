/**
 * Goal run model and pure helpers: deriving the missing goal, validating
 * the setup, progress while running and the final result. No React.
 * Distances are meters, times seconds, paces seconds per km.
 */

import {
  GOAL_DISTANCE_MAX_M,
  GOAL_DISTANCE_MIN_M,
  GOAL_MISMATCH_TOLERANCE_RATIO,
  GOAL_MISMATCH_TOLERANCE_S,
  GOAL_PACE_MAX_S_PER_KM,
  GOAL_PACE_MIN_S_PER_KM,
  GOAL_TIME_MAX_S,
  GOAL_TIME_MIN_S,
  PACE_TOLERANCE_S_PER_KM,
} from './goalConfig';
import { formatClock, formatPaceSeconds } from '../utils/format';

/** Any combination of goals; a missing key means no goal for it. */
export type RunGoal = {
  distanceMeters?: number;
  durationSeconds?: number;
  paceSecPerKm?: number;
};

export type GoalMetric = 'distance' | 'time' | 'pace';

export const GOAL_METRICS: GoalMetric[] = ['distance', 'time', 'pace'];

const GOAL_KEYS = {
  distance: 'distanceMeters',
  time: 'durationSeconds',
  pace: 'paceSecPerKm',
} as const satisfies Record<GoalMetric, keyof RunGoal>;

export function goalValue(goal: RunGoal, metric: GoalMetric): number | undefined {
  return goal[GOAL_KEYS[metric]];
}

/** A copy with one goal set, or removed when `value` is undefined. */
export function withGoalValue(
  goal: RunGoal,
  metric: GoalMetric,
  value: number | undefined,
): RunGoal {
  const next = { ...goal };
  if (value === undefined) delete next[GOAL_KEYS[metric]];
  else next[GOAL_KEYS[metric]] = value;
  return next;
}

export function setGoalMetrics(goal: RunGoal): GoalMetric[] {
  return GOAL_METRICS.filter((m) => goalValue(goal, m) !== undefined);
}

/** The value of a metric computed from the two others. */
function computeMetric(goal: RunGoal, metric: GoalMetric): number | undefined {
  const { distanceMeters: d, durationSeconds: t, paceSecPerKm: p } = goal;
  switch (metric) {
    case 'pace':
      return d !== undefined && t !== undefined && d > 0
        ? t / (d / 1000)
        : undefined;
    case 'time':
      return d !== undefined && p !== undefined ? (d / 1000) * p : undefined;
    case 'distance':
      return t !== undefined && p !== undefined && p > 0
        ? (t / p) * 1000
        : undefined;
  }
}

export type DerivedGoal = { metric: GoalMetric; value: number };

/** With exactly two goals set: the third one they imply. */
export function deriveGoal(goal: RunGoal): DerivedGoal | null {
  const set = setGoalMetrics(goal);
  if (set.length !== 2) return null;
  const metric = GOAL_METRICS.find((m) => !set.includes(m));
  if (!metric) return null;
  const value = computeMetric(goal, metric);
  return value === undefined ? null : { metric, value };
}

const LIMITS: Record<GoalMetric, { min: number; max: number }> = {
  distance: { min: GOAL_DISTANCE_MIN_M, max: GOAL_DISTANCE_MAX_M },
  time: { min: GOAL_TIME_MIN_S, max: GOAL_TIME_MAX_S },
  pace: { min: GOAL_PACE_MIN_S_PER_KM, max: GOAL_PACE_MAX_S_PER_KM },
};

export function goalLimits(metric: GoalMetric) {
  return LIMITS[metric];
}

export type GoalIssue =
  | { kind: 'empty' }
  /** A goal the user set is outside the allowed range. */
  | { kind: 'outOfRange'; metric: GoalMetric; tooHigh: boolean }
  /** Two goals imply an impossible third (e.g. a 1:30 /km pace). */
  | { kind: 'impossible'; metric: GoalMetric; value: number; tooHigh: boolean }
  /**
   * All three are set and don't agree. `expectedTime` is distance × pace;
   * `fixPace` is the pace that makes them agree.
   */
  | { kind: 'mismatch'; expectedTime: number; fixPace: number };

function rangeCheck(metric: GoalMetric, value: number) {
  const { min, max } = LIMITS[metric];
  if (value < min) return { tooHigh: false };
  if (value > max) return { tooHigh: true };
  return null;
}

/** Problems that block starting the run. An empty list: ready to go. */
export function validateGoal(goal: RunGoal): GoalIssue[] {
  const set = setGoalMetrics(goal);
  if (set.length === 0) return [{ kind: 'empty' }];

  const issues: GoalIssue[] = [];
  for (const metric of set) {
    const off = rangeCheck(metric, goalValue(goal, metric)!);
    if (off) issues.push({ kind: 'outOfRange', metric, ...off });
  }
  if (issues.length > 0) return issues;

  const derived = deriveGoal(goal);
  if (derived) {
    const off = rangeCheck(derived.metric, derived.value);
    if (off) issues.push({ kind: 'impossible', ...derived, ...off });
  }

  if (set.length === 3) {
    const time = goal.durationSeconds!;
    const expectedTime = computeMetric(goal, 'time')!;
    const tolerance = Math.max(
      GOAL_MISMATCH_TOLERANCE_S,
      time * GOAL_MISMATCH_TOLERANCE_RATIO,
    );
    if (Math.abs(expectedTime - time) > tolerance) {
      const fixPace = computeMetric({ ...goal, paceSecPerKm: undefined }, 'pace')!;
      issues.push({ kind: 'mismatch', expectedTime, fixPace });
    }
  }
  return issues;
}

/** The goal the run ends on: distance if set, then time. Pace alone has none. */
export function finishMetric(goal: RunGoal): 'distance' | 'time' | null {
  if (goal.distanceMeters !== undefined) return 'distance';
  if (goal.durationSeconds !== undefined) return 'time';
  return null;
}

/** The metric shown big while running. */
export function primaryMetric(goal: RunGoal): GoalMetric {
  return finishMetric(goal) ?? 'pace';
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Progress toward the distance and time goals, 0 to 1. With a distance
 * goal, time progress is the share of the time budget used.
 */
export function goalProgress(
  goal: RunGoal,
  distanceKm: number,
  seconds: number,
): { distance?: number; time?: number } {
  return {
    distance:
      goal.distanceMeters !== undefined
        ? clamp01((distanceKm * 1000) / goal.distanceMeters)
        : undefined,
    time:
      goal.durationSeconds !== undefined
        ? clamp01(seconds / goal.durationSeconds)
        : undefined,
  };
}

/** The run's finishing goal is done (distance covered, or time run). */
export function goalReached(goal: RunGoal, distanceKm: number, seconds: number) {
  const metric = finishMetric(goal);
  if (metric === 'distance') return distanceKm * 1000 >= goal.distanceMeters!;
  if (metric === 'time') return seconds >= goal.durationSeconds!;
  return false;
}

export type GoalResult = {
  metric: GoalMetric;
  target: number;
  /** Meters, seconds or seconds per km; pace is `null` without distance. */
  actual: number | null;
  met: boolean;
};

/** Met or missed, for each goal that was set. */
export function goalResults(
  goal: RunGoal,
  distanceKm: number,
  seconds: number,
): GoalResult[] {
  const meters = distanceKm * 1000;
  const avgPace = distanceKm > 0 ? seconds / distanceKm : null;

  return setGoalMetrics(goal).map((metric): GoalResult => {
    const target = goalValue(goal, metric)!;
    switch (metric) {
      case 'distance':
        return { metric, target, actual: meters, met: meters >= target };
      case 'time':
        // With a distance goal: cover it within the time. Alone: run that long.
        return {
          metric,
          target,
          actual: seconds,
          met:
            goal.distanceMeters !== undefined
              ? meters >= goal.distanceMeters && seconds <= target
              : seconds >= target,
        };
      case 'pace':
        return {
          metric,
          target,
          actual: avgPace,
          met: avgPace !== null && avgPace <= target + PACE_TOLERANCE_S_PER_KM,
        };
    }
  });
}

export const GOAL_LABELS: Record<GoalMetric, string> = {
  distance: 'Distance',
  time: 'Time',
  pace: 'Pace',
};

/** "5 km", "21.1 km" */
export function formatGoalDistance(meters: number): string {
  return `${Number((meters / 1000).toFixed(1))} km`;
}

/** A goal value with its unit: "5 km", "45:00", "5:30 /km". */
export function formatGoalValue(metric: GoalMetric, value: number): string {
  switch (metric) {
    case 'distance':
      return formatGoalDistance(value);
    case 'time':
      return formatClock(Math.round(value));
    case 'pace':
      return `${formatPaceSeconds(value)} /km`;
  }
}
