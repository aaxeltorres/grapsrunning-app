/**
 * Goal run model and pure helpers: deriving the missing goal, validating
 * the setup, progress while running and the final result. No React.
 * Distances are meters, times seconds, paces seconds per km.
 */

import {
  GOAL_DISTANCE_MAX_M,
  GOAL_DISTANCE_MIN_M,
  GOAL_DISTANCE_STEP_M,
  GOAL_PACE_MAX_S_PER_KM,
  GOAL_PACE_MIN_S_PER_KM,
  GOAL_PACE_STEP_S,
  GOAL_TIME_MAX_S,
  GOAL_TIME_MIN_S,
  GOAL_TIME_STEP_S,
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

/**
 * The setup screen's state: at most two goals the user controls. `order`
 * lists them from least to most recently set; with two set, the third is
 * derived from them.
 */
export type GoalSetup = { goal: RunGoal; order: GoalMetric[] };

export const EMPTY_GOAL_SETUP: GoalSetup = { goal: {}, order: [] };

/**
 * Sets a goal (also a derived one). When that makes three, the one set
 * least recently stops being a goal and becomes the derived value.
 */
export function setGoalMetric(
  setup: GoalSetup,
  metric: GoalMetric,
  value: number,
): GoalSetup {
  const order = [...setup.order.filter((m) => m !== metric), metric];
  let goal = withGoalValue(setup.goal, metric, value);
  while (order.length > 2) {
    goal = withGoalValue(goal, order.shift()!, undefined);
  }
  return { goal, order };
}

/** Empties a goal. Clearing one that isn't set changes nothing. */
export function clearGoalMetric(setup: GoalSetup, metric: GoalMetric): GoalSetup {
  return {
    goal: withGoalValue(setup.goal, metric, undefined),
    order: setup.order.filter((m) => m !== metric),
  };
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

/** Wheel step of each goal, in meters, seconds and seconds per km. */
const STEPS: Record<GoalMetric, number> = {
  distance: GOAL_DISTANCE_STEP_M,
  time: GOAL_TIME_STEP_S,
  pace: GOAL_PACE_STEP_S,
};

export function goalStep(metric: GoalMetric) {
  return STEPS[metric];
}

export type GoalIssue =
  | { kind: 'empty' }
  /** A goal the user set is outside the allowed range. */
  | { kind: 'outOfRange'; metric: GoalMetric; tooHigh: boolean }
  /** The two goals imply a third outside the allowed range (e.g. 18:00 /km). */
  | { kind: 'impossible'; metric: GoalMetric; value: number; tooHigh: boolean };

/** Compared as shown (whole seconds / meters), so 15:00.0000001 is fine. */
function rangeCheck(metric: GoalMetric, value: number) {
  const { min, max } = LIMITS[metric];
  const shown = Math.round(value);
  if (shown < min) return { tooHigh: false };
  if (shown > max) return { tooHigh: true };
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
  return issues;
}

/** A one-tap fix: this goal takes this value and the setup becomes valid. */
export type GoalFix = { metric: GoalMetric; value: number };

/**
 * When the derived value is out of range: the changes to one of the two
 * set goals that put it back inside, as close to the current goal as
 * possible. A fix is only offered if it is itself inside its range, on the
 * wheel's step, and leaves the whole setup valid.
 */
export function goalFixes(goal: RunGoal): GoalFix[] {
  const derived = deriveGoal(goal);
  if (!derived) return [];
  const off = rangeCheck(derived.metric, derived.value);
  if (!off) return [];

  const limits = LIMITS[derived.metric];
  const edge = off.tooHigh ? limits.max : limits.min;
  const set = setGoalMetrics(goal);
  const fixes: GoalFix[] = [];

  for (const metric of set) {
    const keep = set.find((m) => m !== metric)!;
    const atEdge = withGoalValue(
      withGoalValue({}, derived.metric, edge),
      keep,
      goalValue(goal, keep),
    );
    const exact = computeMetric(atEdge, metric);
    if (exact === undefined) continue;

    // Round both ways; the epsilon keeps an exact step from slipping a step.
    const step = STEPS[metric];
    const down = Math.floor(exact / step + 1e-9) * step;
    const candidates = [down, down + step]
      .filter((value) => validateGoal(withGoalValue(goal, metric, value)).length === 0)
      .sort((a, b) => Math.abs(a - exact) - Math.abs(b - exact));
    if (candidates.length > 0) fixes.push({ metric, value: candidates[0] });
  }
  return fixes;
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

/**
 * Like `formatGoalValue`, but a pace is never replaced by the "--:--"
 * placeholder, so the setup can say "18:00 /km" or "1:00 /km" for a
 * value the app rejects.
 */
export function formatSetupValue(metric: GoalMetric, value: number): string {
  if (metric !== 'pace') return formatGoalValue(metric, value);
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`;
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
