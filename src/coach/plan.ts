/**
 * Training plan model, plus pure helpers (no React).
 *
 * Plain serializable JSON with stable ids, so an AI coach or the backend
 * can produce it, and Active Run can later execute a workout segment by
 * segment. Distances are meters, durations seconds, paces seconds per km.
 */

import type { ISODate } from '../utils/dates';

// Every field added after version 1 is optional, so old saved plans still
// load as they are: no migration, same version.
export const PLAN_SCHEMA_VERSION = 1;

/**
 * The workout's category: calendar color, legend and the "two demanding
 * sessions in a row" rule. The specific session (Fartlek, HIIT...) is
 * `Workout.session`.
 */
export type WorkoutType =
  | 'easy'
  | 'aerobic'
  | 'tempo'
  | 'long'
  | 'intervals'
  | 'speed'
  | 'rest';

/**
 * The specific session. Missing on workouts from before sessions existed,
 * and on easy runs, run/walks, long runs and classic intervals, which are
 * named from their type and steps.
 */
export type SessionId =
  | 'regenerative'
  | 'extensiveAerobic'
  | 'progressive'
  | 'tempoRun'
  | 'strides'
  | 'fartlek'
  | 'longIntervals'
  | 'mixedIntervals'
  | 'hiit'
  | 'hiitMacro'
  | 'sprints';

/** `partial`: the run was started but cut short (finished early or skipped parts). */
export type WorkoutStatus = 'planned' | 'completed' | 'partial' | 'skipped';

/**
 * - `warmup` / `cooldown`: before and after the main part.
 * - `steady`: continuous running (an easy run, a tempo block).
 * - `work`: an effort inside a repeat group.
 * - `recovery`: the micro rest between reps (jog, walk or standing).
 * - `macroRest`: the longer rest between sets of reps.
 */
export type StepKind =
  | 'warmup'
  | 'steady'
  | 'work'
  | 'recovery'
  | 'macroRest'
  | 'cooldown';

/**
 * Training zone 1 to 5, by pace for now (see `zones.ts`). There is no
 * heart rate in the app yet.
 */
export type Zone = 1 | 2 | 3 | 4 | 5;

/**
 * How a step ends: after a distance, after a duration, or when the runner
 * taps (`manual`): "Done" on an effort, "Ready" on a rest. Manual steps
 * cover what GPS can't measure (a 20 m sprint) and full recoveries.
 */
export type StepTarget =
  | { type: 'distance'; meters: number }
  | { type: 'duration'; seconds: number }
  | {
      type: 'manual';
      /** For totals and the workout bar only. */
      estimatedSeconds: number;
      /** A label such as "20 m"; never measured. */
      meters?: number;
    };

/** Target pace in seconds per km: one value or a range. */
export type Pace = number | { min: number; max: number };

export type WorkoutStep = {
  id: string;
  kind: StepKind;
  target: StepTarget;
  /** `null`: no pace target (walking, a free jog, or a too-short effort). */
  pace: Pace | null;
  /** Intensity zone, when the session is described in zones. */
  zone?: Zone;
};

/**
 * Steps repeated `repeat` times, e.g. 6 × (400 m fast + 90 s jog). Blocks
 * in sequence are simply several groups one after the other.
 *
 * With `sets`, the whole block runs `sets` times, e.g. 2 × 8 × (20 s +
 * 1 min); `macroRest` then replaces the micro rest after the last rep of
 * every set but the last one.
 */
export type RepeatGroup = {
  id: string;
  repeat: number;
  steps: WorkoutStep[];
  sets?: number;
  macroRest?: WorkoutStep;
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
  /** The specific session; see `SessionId`. */
  session?: SessionId;
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

export type Counter = { number: number; of: number };

/** A step in execution order, with where it sits in its block. */
export type UnrolledStep = {
  step: WorkoutStep;
  /** Inside a repeat group: rep 3 of 8. */
  rep: Counter | null;
  /** Inside a group with `sets`: set 1 of 2. */
  set: Counter | null;
};

export function isRest(step: Pick<WorkoutStep, 'kind'>) {
  return step.kind === 'recovery' || step.kind === 'macroRest';
}

/**
 * Every step in execution order: repeat groups unrolled, sets repeated,
 * and the macro rest in place of the last micro rest of each set but the
 * last. A group without `sets` unrolls exactly as before sets existed.
 */
export function unrollSegments(segments: WorkoutSegment[]): UnrolledStep[] {
  const out: UnrolledStep[] = [];
  for (const segment of segments) {
    if (!isRepeatGroup(segment)) {
      out.push({ step: segment, rep: null, set: null });
      continue;
    }
    const sets = segment.sets ?? 1;
    for (let s = 1; s <= sets; s += 1) {
      const set = segment.sets !== undefined ? { number: s, of: sets } : null;
      for (let n = 1; n <= segment.repeat; n += 1) {
        const rep = { number: n, of: segment.repeat };
        const macro =
          segment.macroRest && s < sets && n === segment.repeat
            ? segment.macroRest
            : undefined;
        let steps = segment.steps;
        if (macro && steps.length > 0 && isRest(steps[steps.length - 1])) {
          steps = steps.slice(0, -1);
        }
        for (const step of steps) out.push({ step, rep, set });
        if (macro) out.push({ step: macro, rep, set });
      }
    }
  }
  return out;
}

/** Every step in execution order, with repeat groups unrolled. */
export function flattenSteps(segments: WorkoutSegment[]): WorkoutStep[] {
  return unrollSegments(segments).map((unrolled) => unrolled.step);
}

function stepPace(step: WorkoutStep) {
  return step.pace === null
    ? UNPACED_ESTIMATE_SEC_PER_KM
    : paceMidpoint(step.pace);
}

/** Estimated step distance in meters. */
export function stepDistance(step: WorkoutStep): number {
  const { target } = step;
  if (target.type === 'distance') return target.meters;
  if (target.type === 'manual') {
    return target.meters ?? (target.estimatedSeconds / stepPace(step)) * 1000;
  }
  return (target.seconds / stepPace(step)) * 1000;
}

/** Estimated step duration in seconds. */
export function stepDuration(step: WorkoutStep): number {
  const { target } = step;
  if (target.type === 'duration') return target.seconds;
  if (target.type === 'manual') return target.estimatedSeconds;
  return (target.meters / 1000) * stepPace(step);
}

/** What ends a manual step: "Done" on an effort, "Ready" on a rest. */
export function manualEndLabel(step: Pick<WorkoutStep, 'kind'>): 'done' | 'ready' {
  return isRest(step) ? 'ready' : 'done';
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
  if (target.type === 'distance') return formatDistanceShort(target.meters);
  if (target.type === 'duration') return formatDurationShort(target.seconds);
  return target.meters !== undefined ? formatDistanceShort(target.meters) : 'Open';
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

export const SESSION_NAMES: Record<SessionId, string> = {
  regenerative: 'Regenerative',
  extensiveAerobic: 'Extensive aerobic',
  progressive: 'Progressive',
  tempoRun: 'Tempo run',
  strides: 'Strides',
  fartlek: 'Fartlek',
  longIntervals: 'Long intervals',
  mixedIntervals: 'Mixed intervals',
  hiit: 'HIIT',
  hiitMacro: 'HIIT sets',
  sprints: 'Sprints',
};

type Named = Pick<Workout, 'type' | 'segments' | 'session'>;

/** Short name, e.g. "Fartlek", "6 × 400 m", "Easy run", "Run/walk". */
export function displayName(workout: Named) {
  if (workout.session) return SESSION_NAMES[workout.session];
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
    case 'aerobic':
      return 'Aerobic run';
    case 'tempo':
      return 'Tempo run';
    case 'speed':
      return 'Speed';
  }
}

/** Workout type as a label, e.g. "Intervals". */
export function typeLabel(type: WorkoutType) {
  switch (type) {
    case 'easy':
      return 'Easy';
    case 'aerobic':
      return 'Aerobic';
    case 'tempo':
      return 'Tempo';
    case 'intervals':
      return 'Intervals';
    case 'speed':
      return 'Speed';
    case 'long':
      return 'Long run';
    case 'rest':
      return 'Rest';
  }
}

/**
 * Hard sessions: never two on consecutive days. Aerobic runs don't count,
 * but the generator still keeps them off the days next to a hard one.
 */
export function isDemandingType(type: WorkoutType) {
  return (
    type === 'long' || type === 'intervals' || type === 'tempo' || type === 'speed'
  );
}

/** Coach notation: 15'', 1'30'', 15'. */
function formatCoachDuration(seconds: number) {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}''`;
  return s === 0 ? `${m}'` : `${m}'${s.toString().padStart(2, '0')}''`;
}

function structureStep(step: WorkoutStep) {
  const { target } = step;
  const meters = target.type === 'duration' ? undefined : target.meters;
  const amount =
    target.type === 'duration'
      ? formatCoachDuration(target.seconds)
      : meters !== undefined
        ? formatDistanceShort(meters)
        : null;
  if (amount === null) return isRest(step) ? 'full rest' : 'until done';
  return step.zone ? `${amount} Z${step.zone}` : amount;
}

/**
 * The session in coach notation, e.g. "5' Z2 + 8 × (1'30'' Z4 / 2'30''
 * Z2)". Only for sessions (`session` set); `null` for other workouts,
 * whose cards stay as they were.
 */
export function structureLine(workout: Pick<Workout, 'segments' | 'session'>) {
  if (!workout.session) return null;
  return workout.segments
    .map((segment) => {
      if (!isRepeatGroup(segment)) return structureStep(segment);
      const reps = `${segment.repeat} × (${segment.steps.map(structureStep).join(' / ')})`;
      if (!segment.sets || segment.sets < 2) return reps;
      const macro = segment.macroRest
        ? `, ${structureStep(segment.macroRest)} between sets`
        : '';
      return `${segment.sets} sets of ${reps}${macro}`;
    })
    .join(' + ');
}

/** The hardest zone among the efforts (rests left out). */
export function topZone(workout: Pick<Workout, 'segments'>): Zone | null {
  let top: Zone | null = null;
  for (const step of flattenSteps(workout.segments)) {
    if (step.zone === undefined || isRest(step)) continue;
    if (top === null || step.zone > top) top = step.zone;
  }
  return top;
}

/** Whether any step of the workout is described in zones. */
export function hasZones(workout: Pick<Workout, 'segments'>) {
  return flattenSteps(workout.segments).some((step) => step.zone !== undefined);
}

/**
 * The pace worth showing on a card: the fastest target pace (the work
 * steps of an interval session), or `null` when nothing is paced.
 */
export function keyPace(workout: Pick<Workout, 'segments'>): Pace | null {
  let best: Pace | null = null;
  for (const step of flattenSteps(workout.segments)) {
    if (step.pace === null || isRest(step)) continue;
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
export function segmentBarParts(workout: Named): SegmentBarPart[] {
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
  const mainLabel = workout.session
    ? displayName(workout)
    : workout.type === 'intervals' && group
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
