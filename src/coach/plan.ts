/**
 * Training plan model, plus pure helpers (no React).
 *
 * Plain serializable JSON with stable ids, so an AI coach or the backend
 * can produce it, and Active Run can later execute a workout segment by
 * segment. Distances are meters, durations seconds, paces seconds per km.
 */

import type { ISODate } from '../utils/dates';

export const PLAN_SCHEMA_VERSION = 1;

export type WorkoutType = 'easy' | 'intervals' | 'long' | 'rest';
/** `partial`: the run was started but cut short (finished early or skipped parts). */
export type WorkoutStatus = 'planned' | 'completed' | 'partial' | 'skipped';
export type StepKind = 'warmup' | 'steady' | 'work' | 'recovery' | 'cooldown';

/** How long a step lasts: a distance or a duration. */
export type StepTarget =
  | { type: 'distance'; meters: number }
  | { type: 'duration'; seconds: number };

/** Target pace in seconds per km: one value or a range. */
export type Pace = number | { min: number; max: number };

export type WorkoutStep = {
  id: string;
  kind: StepKind;
  target: StepTarget;
  /** `null`: no pace target (e.g. walking or a free jog). */
  pace: Pace | null;
};

/** Steps repeated `repeat` times, e.g. 6 × (400 m fast + 90 s jog). */
export type RepeatGroup = {
  id: string;
  repeat: number;
  steps: WorkoutStep[];
};

export type WorkoutSegment = WorkoutStep | RepeatGroup;

/** What the runner actually did when a plan workout was run. */
export type WorkoutResult = {
  distanceMeters: number;
  durationSeconds: number;
  /** Seconds per km, `null` when the run was too short to have a pace. */
  avgPaceSecPerKm: number | null;
  /** When the run was finished (ISO timestamp). */
  completedAt: string;
  /** When the run started (ms since epoch). */
  startedAt?: number;
};

export type Workout = {
  id: string;
  date: ISODate;
  type: WorkoutType;
  status: WorkoutStatus;
  /**
   * The actual run, set when the workout is `completed` or `partial`.
   * Missing on planned workouts and on workouts finished before results
   * were stored: readers fall back to the planned values.
   */
  result?: WorkoutResult;
  /**
   * The user changed this workout by hand (the workout editor sets it).
   * Regenerating the plan never replaces an edited workout. Missing means
   * false.
   */
  edited?: boolean;
  /** In order. Empty on rest days. */
  segments: WorkoutSegment[];
};

export type Plan = {
  id: string;
  schemaVersion: typeof PLAN_SCHEMA_VERSION;
  /** Who made it. 'mock' until the AI coach generates plans. */
  source: 'mock' | 'ai';
  createdAt: string;
  /** Monday of the first week. */
  startDate: ISODate;
  weeks: number;
  /** Sorted by date, at most one per day. */
  workouts: Workout[];
};

/**
 * Pace used to estimate distance for steps without a pace target (walks,
 * free jogs). Only for totals; never shown as a target.
 */
const UNPACED_ESTIMATE_SEC_PER_KM = 600;

/** The workout was run: completed, or cut short (partial). */
export function isFinished(workout: Pick<Workout, 'status'>) {
  return workout.status === 'completed' || workout.status === 'partial';
}

export function isRepeatGroup(segment: WorkoutSegment): segment is RepeatGroup {
  return 'repeat' in segment;
}

/** Middle of a pace range, or the pace itself. */
export function paceMidpoint(pace: Pace): number {
  return typeof pace === 'number' ? pace : (pace.min + pace.max) / 2;
}

/** Every step in execution order, with repeat groups unrolled. */
export function flattenSteps(segments: WorkoutSegment[]): WorkoutStep[] {
  return segments.flatMap((segment) =>
    isRepeatGroup(segment)
      ? Array.from({ length: segment.repeat }, () => segment.steps).flat()
      : [segment],
  );
}

function stepPace(step: WorkoutStep) {
  return step.pace === null
    ? UNPACED_ESTIMATE_SEC_PER_KM
    : paceMidpoint(step.pace);
}

/** Estimated step distance in meters. */
export function stepDistance(step: WorkoutStep): number {
  return step.target.type === 'distance'
    ? step.target.meters
    : (step.target.seconds / stepPace(step)) * 1000;
}

/** Estimated step duration in seconds. */
export function stepDuration(step: WorkoutStep): number {
  return step.target.type === 'duration'
    ? step.target.seconds
    : (step.target.meters / 1000) * stepPace(step);
}

/** Total distance in meters (estimated for time-based steps). */
export function totalDistance(workout: Pick<Workout, 'segments'>): number {
  return flattenSteps(workout.segments).reduce(
    (sum, step) => sum + stepDistance(step),
    0,
  );
}

/** Total duration in seconds (estimated for distance-based steps). */
export function totalDuration(workout: Pick<Workout, 'segments'>): number {
  return flattenSteps(workout.segments).reduce(
    (sum, step) => sum + stepDuration(step),
    0,
  );
}

/** "400 m", "1 km", "1.5 km" */
export function formatDistanceShort(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = Math.round(meters / 100) / 10;
  return `${km} km`;
}

/** "90 s", "2 min", "1.5 min" */
export function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  return `${minutes} min`;
}

function formatTarget(target: StepTarget) {
  return target.type === 'distance'
    ? formatDistanceShort(target.meters)
    : formatDurationShort(target.seconds);
}

/** The main repeat group of a workout, if any. */
export function mainRepeatGroup(
  workout: Pick<Workout, 'segments'>,
): RepeatGroup | undefined {
  return workout.segments.find(isRepeatGroup);
}

/** Run/walk: an easy session built from repeats. */
export function isRunWalk(workout: Pick<Workout, 'type' | 'segments'>) {
  return workout.type === 'easy' && mainRepeatGroup(workout) !== undefined;
}

/** Short name, e.g. "6 × 400 m", "Easy run", "Run/walk". */
export function displayName(workout: Pick<Workout, 'type' | 'segments'>) {
  switch (workout.type) {
    case 'rest':
      return 'Rest day';
    case 'long':
      return 'Long run';
    case 'easy':
      return isRunWalk(workout) ? 'Run/walk' : 'Easy run';
    case 'intervals': {
      const group = mainRepeatGroup(workout);
      const work = group?.steps.find((step) => step.kind === 'work');
      return group && work
        ? `${group.repeat} × ${formatTarget(work.target)}`
        : 'Intervals';
    }
  }
}

/** Workout type as a label, e.g. "Intervals". */
export function typeLabel(type: WorkoutType) {
  switch (type) {
    case 'easy':
      return 'Easy';
    case 'intervals':
      return 'Intervals';
    case 'long':
      return 'Long run';
    case 'rest':
      return 'Rest';
  }
}

/**
 * The pace worth showing on a card: the fastest target pace (the work
 * steps of an interval session), or `null` when nothing is paced.
 */
export function keyPace(workout: Pick<Workout, 'segments'>): Pace | null {
  let best: Pace | null = null;
  for (const step of flattenSteps(workout.segments)) {
    if (step.pace === null || step.kind === 'recovery') continue;
    if (best === null || paceMidpoint(step.pace) < paceMidpoint(best)) {
      best = step.pace;
    }
  }
  return best;
}

export type SegmentBarPart = {
  kind: 'warmup' | 'main' | 'cooldown';
  label: string;
  /** Share of the total duration, 0 to 1. */
  fraction: number;
};

/**
 * Warm-up / main / cool-down split of a workout by duration, for the
 * proportional segment bar.
 */
export function segmentBarParts(
  workout: Pick<Workout, 'type' | 'segments'>,
): SegmentBarPart[] {
  const total = totalDuration(workout);
  if (total <= 0) return [];

  const durations = { warmup: 0, main: 0, cooldown: 0 };
  for (const segment of workout.segments) {
    const seconds = totalDuration({ segments: [segment] });
    const kind =
      !isRepeatGroup(segment) && segment.kind === 'warmup'
        ? 'warmup'
        : !isRepeatGroup(segment) && segment.kind === 'cooldown'
          ? 'cooldown'
          : 'main';
    durations[kind] += seconds;
  }

  const group = mainRepeatGroup(workout);
  const mainLabel =
    workout.type === 'intervals' && group
      ? `${group.repeat} fast reps`
      : isRunWalk(workout) && group
        ? `${group.repeat} × run/walk`
        : displayName(workout);

  const parts: SegmentBarPart[] = [
    { kind: 'warmup', label: 'Warm-up', fraction: durations.warmup / total },
    { kind: 'main', label: mainLabel, fraction: durations.main / total },
    {
      kind: 'cooldown',
      label: 'Cool-down',
      fraction: durations.cooldown / total,
    },
  ];
  return parts.filter((part) => part.fraction > 0);
}

/** The next training sessions after a date (rest days skipped). */
export function upcomingWorkouts(
  plan: Plan,
  after: ISODate,
  count: number,
): Workout[] {
  return plan.workouts
    .filter(
      (w) => w.date > after && w.type !== 'rest' && w.status === 'planned',
    )
    .slice(0, count);
}
