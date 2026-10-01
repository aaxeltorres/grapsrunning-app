/**
 * Pure logic of the workout editor (no React): the run types a workout can
 * become, how long each can be, how a run is laid out (warm-up / main
 * block / cool-down) and the workout built from the user's choices.
 *
 * Everything derives from the same rules and paces as `generatePlan`, so
 * an edited workout looks like a generated one and the numbers (distance,
 * pace) are always computed from the runner's level, never invented.
 */

import { addDays, dayNumber, type ISODate } from '../utils/dates';
import {
  buildSegments,
  defaultIntervalReps,
  DEFAULT_RUN_WALK_REPS,
  distance,
  duration,
  generatePlan,
  INTERVALS,
  paceRange,
  round5,
  rulesFor,
  runWalkBoutSeconds,
  stepFactory,
  WALK_BREAK_SECONDS,
  type Rules,
} from './generatePlan';
import {
  isRepeatGroup,
  keyPace,
  totalDistance,
  totalDuration,
  type Pace,
  type Plan,
  type Workout,
  type WorkoutSegment,
  type WorkoutType,
} from './plan';
import type { LevelId, RunnerProfile } from './runnerProfile';

/** The run types of the editor's carousel. */
export type EditorKind = 'easy' | 'runWalk' | 'long' | 'intervals';

export const EDITOR_KINDS: readonly EditorKind[] = [
  'easy',
  'runWalk',
  'long',
  'intervals',
];

/** Plans are built week by week: week 0 is the first (see `generatePlan`). */
const LAST_WEEK = 3;
/** Warm-up and cool-down of a continuous run: this share of the total... */
const WARM_COOL_SHARE = 0.1;
/** ...but never less than this many minutes. */
const WARM_COOL_MIN_MINUTES = 3;
const RUN_WALK_WARM_COOL_SECONDS = 300;
const INTERVALS_WARM_SECONDS = 600;
const INTERVALS_COOL_SECONDS = 300;
const INTERVALS_RECOVERY_SECONDS = 90;
const MIN_REPS = 2;
/** Beginners' run/walk bouts follow this level's table, for everyone. */
const RUN_WALK_FALLBACK_LEVEL: LevelId = 'run_walk';

/** Total time limits in minutes, by type. */
const MINUTES_RANGE: Record<EditorKind, { min: number; max: number }> = {
  easy: { min: 15, max: 90 },
  runWalk: { min: 10, max: 60 },
  long: { min: 40, max: 180 },
  intervals: { min: 25, max: 75 },
};

/** What the user edits: minutes of a continuous run, or repetitions. */
export type Draft = {
  kind: EditorKind;
  /**
   * Minutes of the main block for a continuous run (warm-up and cool-down
   * follow from it); repetitions for a rep-based one. Either way the
   * handle position grows with it, step by step.
   */
  amount: number;
};

export type EditorContext = {
  rules: Rules;
  /** Week of the plan the workout is in (0-3). */
  week: number;
};

export type AmountLimits = {
  min: number;
  max: number;
  step: number;
};

/** A run split in blocks, in seconds. */
export type Layout = {
  warmSeconds: number;
  mainSeconds: number;
  coolSeconds: number;
  totalSeconds: number;
  /** Rep-based runs only: the repeated work and recovery blocks. */
  reps?: number;
  workSeconds?: number;
  recoverySeconds?: number;
};

export function editorContext(
  plan: Plan,
  profile: RunnerProfile,
  date: ISODate,
): EditorContext {
  const weeks = Math.floor((dayNumber(date) - dayNumber(plan.startDate)) / 7);
  return {
    rules: rulesFor(profile),
    week: Math.min(LAST_WEEK, Math.max(0, weeks)),
  };
}

export function workoutType(kind: EditorKind): WorkoutType {
  return kind === 'long' ? 'long' : kind === 'intervals' ? 'intervals' : 'easy';
}

export function workoutKind(
  workout: Pick<Workout, 'type' | 'segments'>,
): EditorKind {
  if (workout.type === 'intervals') return 'intervals';
  if (workout.type === 'long') return 'long';
  return workout.segments.some(isRepeatGroup) ? 'runWalk' : 'easy';
}

/**
 * The types offered in the carousel. Intervals only for runners who opted
 * in, but never taken away from a workout that already is one.
 */
export function availableKinds(
  profile: RunnerProfile,
  current: EditorKind,
): EditorKind[] {
  return EDITOR_KINDS.filter(
    (kind) =>
      kind !== 'intervals' ||
      profile.includeIntervals === true ||
      current === 'intervals',
  );
}

/** Whether the run is edited by repetitions rather than by minutes. */
export function isRepKind(kind: EditorKind, ctx: EditorContext) {
  return (
    kind === 'runWalk' ||
    kind === 'intervals' ||
    // Beginners' long runs are longer run/walk sessions.
    (kind === 'long' && ctx.rules.beginner)
  );
}

type RepSpec = {
  warmSeconds: number;
  coolSeconds: number;
  workSeconds: number;
  recoverySeconds: number;
};

function repSpec(kind: EditorKind, ctx: EditorContext): RepSpec {
  const { rules, week } = ctx;
  if (kind === 'intervals') {
    const { meters } = INTERVALS[rules.focus];
    return {
      warmSeconds: INTERVALS_WARM_SECONDS,
      coolSeconds: INTERVALS_COOL_SECONDS,
      workSeconds: Math.round((meters / 1000) * fastPace(rules)),
      recoverySeconds: INTERVALS_RECOVERY_SECONDS,
    };
  }
  // Run/walk: the bouts of the runner's own level when they are a
  // beginner, the gentlest table otherwise.
  const level = rules.beginner ? rules.level : RUN_WALK_FALLBACK_LEVEL;
  return {
    warmSeconds: RUN_WALK_WARM_COOL_SECONDS,
    coolSeconds: RUN_WALK_WARM_COOL_SECONDS,
    workSeconds: runWalkBoutSeconds(level, week, kind === 'long' ? 'long' : 'easy'),
    recoverySeconds: WALK_BREAK_SECONDS,
  };
}

function fastPace(rules: Rules) {
  return round5(rules.easyPace - INTERVALS[rules.focus].fasterBy);
}

/** Warm-up and cool-down minutes around a main block of `mainMinutes`. */
function warmCoolMinutes(mainMinutes: number) {
  // Warm-up + main + cool-down = total, and each end is 10% of the total.
  const share = WARM_COOL_SHARE / (1 - 2 * WARM_COOL_SHARE);
  return Math.max(WARM_COOL_MIN_MINUTES, Math.round(mainMinutes * share));
}

function totalMinutesFor(mainMinutes: number) {
  return mainMinutes + 2 * warmCoolMinutes(mainMinutes);
}

/** The main block (minutes) of the run whose total is closest to `total`. */
function mainMinutesForTotal(totalMinutes: number) {
  let best = Math.max(1, Math.round(totalMinutes * (1 - 2 * WARM_COOL_SHARE)));
  for (let main = Math.max(1, best - 3); main <= best + 3; main += 1) {
    if (
      Math.abs(totalMinutesFor(main) - totalMinutes) <
      Math.abs(totalMinutesFor(best) - totalMinutes)
    ) {
      best = main;
    }
  }
  return best;
}

export function amountLimits(kind: EditorKind, ctx: EditorContext): AmountLimits {
  const { min, max } = MINUTES_RANGE[kind];
  if (!isRepKind(kind, ctx)) {
    // Smallest and largest main block that keep the total within range.
    // Long runs are long: 5-minute steps keep the handle easy to place.
    const step = kind === 'long' ? 5 : 1;
    let minMain = 1;
    while (totalMinutesFor(minMain) < min) minMain += 1;
    let maxMain = minMain;
    while (totalMinutesFor(maxMain + 1) <= max) maxMain += 1;
    return {
      min: Math.ceil(minMain / step) * step,
      max: Math.floor(maxMain / step) * step,
      step,
    };
  }
  const spec = repSpec(kind, ctx);
  const cycle = spec.workSeconds + spec.recoverySeconds;
  const fixed = spec.warmSeconds + spec.coolSeconds;
  const minReps = Math.max(MIN_REPS, Math.ceil((min * 60 - fixed) / cycle));
  const maxReps = Math.max(minReps + 1, Math.floor((max * 60 - fixed) / cycle));
  return { min: minReps, max: maxReps, step: 1 };
}

export function layoutFor(
  kind: EditorKind,
  amount: number,
  ctx: EditorContext,
): Layout {
  if (!isRepKind(kind, ctx)) {
    const warm = warmCoolMinutes(amount) * 60;
    const main = amount * 60;
    return {
      warmSeconds: warm,
      mainSeconds: main,
      coolSeconds: warm,
      totalSeconds: main + warm * 2,
    };
  }
  const spec = repSpec(kind, ctx);
  const main = amount * (spec.workSeconds + spec.recoverySeconds);
  return {
    warmSeconds: spec.warmSeconds,
    mainSeconds: main,
    coolSeconds: spec.coolSeconds,
    totalSeconds: spec.warmSeconds + main + spec.coolSeconds,
    reps: amount,
    workSeconds: spec.workSeconds,
    recoverySeconds: spec.recoverySeconds,
  };
}

/** Longest total run of a type: the bar's scale. */
export function domainSeconds(kind: EditorKind, ctx: EditorContext) {
  return layoutFor(kind, amountLimits(kind, ctx).max, ctx).totalSeconds;
}

export function clampAmount(
  kind: EditorKind,
  amount: number,
  ctx: EditorContext,
) {
  const { min, max, step } = amountLimits(kind, ctx);
  const snapped = Math.round(amount / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/**
 * The amount whose main block ends closest to `endSeconds` (measured from
 * the start of the run). Drives the handle: the finger sets where the
 * main block ends, the run snaps to the nearest step.
 */
export function amountForMainEnd(
  kind: EditorKind,
  endSeconds: number,
  ctx: EditorContext,
): number {
  const { min, max, step } = amountLimits(kind, ctx);
  let best = min;
  let bestDistance = Infinity;
  for (let amount = min; amount <= max; amount += step) {
    const layout = layoutFor(kind, amount, ctx);
    const gap = Math.abs(layout.warmSeconds + layout.mainSeconds - endSeconds);
    if (gap < bestDistance) {
      best = amount;
      bestDistance = gap;
    }
  }
  return best;
}

/** A sensible starting amount when the user switches to a type. */
export function defaultDraft(kind: EditorKind, ctx: EditorContext): Draft {
  const { rules, week } = ctx;
  let amount: number;
  if (kind === 'intervals') {
    amount = defaultIntervalReps(rules.level, week);
  } else if (isRepKind(kind, ctx)) {
    amount = DEFAULT_RUN_WALK_REPS - (rules.gentle ? 2 : 0);
  } else {
    // What a generated run of this type lasts at the runner's level.
    const segments = buildSegments('default', workoutType(kind), rules, week);
    amount = mainMinutesForTotal(totalDuration({ segments }) / 60);
  }
  return { kind, amount: clampAmount(kind, amount, ctx) };
}

/** The draft that describes a saved workout. */
export function draftFromWorkout(
  workout: Pick<Workout, 'type' | 'segments'>,
  ctx: EditorContext,
): Draft {
  const kind = workoutKind(workout);
  if (isRepKind(kind, ctx)) {
    const group = workout.segments.find(isRepeatGroup);
    return {
      kind,
      amount: clampAmount(kind, group?.repeat ?? defaultDraft(kind, ctx).amount, ctx),
    };
  }
  return {
    kind,
    amount: clampAmount(
      kind,
      mainMinutesForTotal(totalDuration(workout) / 60),
      ctx,
    ),
  };
}

export function sameDraft(a: Draft, b: Draft) {
  return a.kind === b.kind && a.amount === b.amount;
}

/** The steps of a workout built from a draft. */
export function segmentsFor(
  workoutId: string,
  draft: Draft,
  ctx: EditorContext,
): WorkoutSegment[] {
  const { kind, amount } = draft;
  const { rules } = ctx;
  const { step, repeat } = stepFactory(workoutId);
  const easy = paceRange(rules.easyPace, 10, 20);
  const warmPace = paceRange(rules.easyPace + 30, 10, 15);
  const layout = layoutFor(kind, amount, ctx);

  if (kind === 'intervals') {
    const { meters } = INTERVALS[rules.focus];
    return [
      step('warmup', duration(layout.warmSeconds), warmPace),
      repeat(amount, [
        step('work', distance(meters / 1000), fastPace(rules)),
        step('recovery', duration(layout.recoverySeconds ?? 0), null),
      ]),
      step('cooldown', duration(layout.coolSeconds), warmPace),
    ];
  }

  if (isRepKind(kind, ctx)) {
    return [
      step('warmup', duration(layout.warmSeconds), null),
      repeat(amount, [
        step('steady', duration(layout.workSeconds ?? 0), easy),
        step('recovery', duration(layout.recoverySeconds ?? 0), null),
      ]),
      step('cooldown', duration(layout.coolSeconds), null),
    ];
  }

  const mainPace = kind === 'long' ? paceRange(rules.easyPace, 0, 30) : easy;
  return [
    step('warmup', duration(layout.warmSeconds), warmPace),
    step('steady', duration(layout.mainSeconds), mainPace),
    step('cooldown', duration(layout.coolSeconds), warmPace),
  ];
}

/** The workout with the user's choices applied, marked as edited. */
export function editedWorkout(
  workout: Workout,
  draft: Draft,
  ctx: EditorContext,
): Workout {
  return {
    ...workout,
    type: workoutType(draft.kind),
    edited: true,
    segments: segmentsFor(workout.id, draft, ctx),
  };
}

export type RunStats = {
  seconds: number;
  meters: number;
  /** Fastest target pace, or `null` when nothing is paced. */
  pace: Pace | null;
};

/** Live numbers for the summary, from the draft's own steps and paces. */
export function draftStats(
  workoutId: string,
  draft: Draft,
  ctx: EditorContext,
): RunStats {
  const workout = { segments: segmentsFor(workoutId, draft, ctx) };
  return {
    seconds: totalDuration(workout),
    meters: totalDistance(workout),
    pace: keyPace(workout),
  };
}

/** Where the amount sits in its range, 0 (shortest) to 1 (longest). */
export function amountFraction(
  kind: EditorKind,
  amount: number,
  ctx: EditorContext,
) {
  const { min, max } = amountLimits(kind, ctx);
  return max === min ? 0 : (amount - min) / (max - min);
}

function isDemanding(type: WorkoutType) {
  return type === 'long' || type === 'intervals';
}

/**
 * True when a demanding session (long run, intervals) on `date` would sit
 * right next to another one. Only a soft warning: saving stays allowed.
 */
export function nextToHardSession(
  plan: Plan,
  date: ISODate,
  kind: EditorKind,
): boolean {
  if (!isDemanding(workoutType(kind))) return false;
  const neighbors = [addDays(date, -1), addDays(date, 1)];
  return plan.workouts.some(
    (workout) => neighbors.includes(workout.date) && isDemanding(workout.type),
  );
}

/**
 * The workout as the generator suggests it for the current answers, or
 * `undefined` when the plan has no workout on that day.
 */
export async function suggestedWorkout(
  plan: Plan,
  profile: RunnerProfile,
  date: ISODate,
): Promise<Workout | undefined> {
  const fresh = await generatePlan(profile, plan.startDate);
  return fresh.workouts.find((workout) => workout.date === date);
}
