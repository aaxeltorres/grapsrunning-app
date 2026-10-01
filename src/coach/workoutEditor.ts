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
  intervalMeters,
  paceRange,
  planWeekIndex,
  round5,
  rulesFor,
  runWalkBoutSeconds,
  sessionSegments,
  stepFactory,
  WALK_BREAK_SECONDS,
  type Rules,
} from './generatePlan';
import {
  flattenSteps,
  isDemandingType,
  isRepeatGroup,
  keyPace,
  totalDistance,
  topZone,
  totalDuration,
  type Pace,
  type Plan,
  type SessionId,
  type Workout,
  type WorkoutSegment,
  type WorkoutType,
  type Zone,
} from './plan';
import type { LevelId, RunnerProfile } from './runnerProfile';
import { buildSession, isSessionId, SESSION_SPECS } from './sessions';

/** The run types the editor had before sessions; edited as before. */
type BasicKind = 'easy' | 'runWalk' | 'long' | 'intervals';

/**
 * The run types of the editor's carousel: the basic ones and every
 * session. A session is edited by its total time; its reps, sets and
 * zones stay as the session defines them.
 */
export type EditorKind = BasicKind | SessionId;

export const EDITOR_KINDS: readonly EditorKind[] = [
  'easy',
  'regenerative',
  'runWalk',
  'long',
  'extensiveAerobic',
  'progressive',
  'tempoRun',
  'intervals',
  'strides',
  'fartlek',
  'mixedIntervals',
  'longIntervals',
  'hiit',
  'hiitMacro',
  'sprints',
];

const sessionOf = (kind: EditorKind): SessionId | null =>
  isSessionId(kind) ? kind : null;

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

/** Total time limits in minutes, by type (sessions: see `SESSION_SPECS`). */
const MINUTES_RANGE: Record<BasicKind, { min: number; max: number }> = {
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
  /**
   * Week of the plan the workout is in (0 = the first). Weekly plans keep
   * counting; the generator's rules repeat every four weeks.
   */
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
    week: Math.max(0, weeks),
  };
}

export function workoutType(kind: EditorKind): WorkoutType {
  const session = sessionOf(kind);
  if (session) return SESSION_SPECS[session].category;
  return kind === 'long' ? 'long' : kind === 'intervals' ? 'intervals' : 'easy';
}

export function workoutKind(
  workout: Pick<Workout, 'type' | 'segments' | 'session'>,
): EditorKind {
  if (workout.session) return workout.session;
  if (workout.type === 'intervals') return 'intervals';
  if (workout.type === 'long') return 'long';
  return workout.segments.some(isRepeatGroup) ? 'runWalk' : 'easy';
}

/**
 * The types offered in the carousel, by the same rules as the generator:
 * intervals and speed sessions only for runners who opted in, advanced
 * sessions from the 5K level up, and no structured session for beginners
 * or while an injury hurts. The workout's own type is never taken away.
 */
export function availableKinds(
  profile: RunnerProfile,
  current: EditorKind,
): EditorKind[] {
  const rules = rulesFor(profile);
  return EDITOR_KINDS.filter((kind) => {
    if (kind === current) return true;
    if (kind === 'intervals') return profile.includeIntervals === true;
    const session = sessionOf(kind);
    if (!session) return true;
    const spec = SESSION_SPECS[session];
    if (!rules.structured) return false;
    if (spec.speedWork && !rules.intervals) return false;
    return !spec.advanced || rules.advanced;
  });
}

/** Whether the run is edited by repetitions rather than by minutes. */
export function isRepKind(kind: EditorKind, ctx: EditorContext) {
  if (sessionOf(kind)) return false;
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
    const meters = intervalMeters(rules.focus, week);
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
  const session = sessionOf(kind);
  if (session) {
    // Sessions: the amount is the total time in minutes.
    const spec = SESSION_SPECS[session];
    return { min: spec.minMinutes, max: spec.maxMinutes, step: 1 };
  }
  const { min, max } = MINUTES_RANGE[kind as BasicKind];
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

/** A session's own warm-up / main / cool-down, from its built steps. */
function sessionLayout(session: SessionId, amount: number, ctx: EditorContext): Layout {
  const steps = flattenSteps(sessionDraftSegments('layout', session, amount, ctx));
  const seconds = steps.map((step) => totalDuration({ segments: [step] }));
  const total = seconds.reduce((sum, s) => sum + s, 0);
  let warm = 0;
  for (let i = 0; i < steps.length && steps[i].kind === 'warmup'; i += 1) warm += seconds[i];
  let cool = 0;
  for (let i = steps.length - 1; i >= 0 && steps[i].kind === 'cooldown'; i -= 1) cool += seconds[i];
  return {
    warmSeconds: warm,
    mainSeconds: total - warm - cool,
    coolSeconds: cool,
    totalSeconds: total,
  };
}

function sessionDraftSegments(
  workoutId: string,
  session: SessionId,
  amount: number,
  ctx: EditorContext,
): WorkoutSegment[] {
  // The week's variant, as the generator built it.
  return buildSession(workoutId, session, ctx.rules.easyPace, {
    totalSeconds: amount * 60,
    variant: ctx.week,
  });
}

export function layoutFor(
  kind: EditorKind,
  amount: number,
  ctx: EditorContext,
): Layout {
  const session = sessionOf(kind);
  if (session) return sessionLayout(session, amount, ctx);
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
  const session = sessionOf(kind);
  let amount: number;
  if (session) {
    // What the generator would build for this week.
    const segments = sessionSegments('default', session, rules, week);
    amount = Math.round(totalDuration({ segments }) / 60);
  } else if (kind === 'intervals') {
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
  workout: Pick<Workout, 'type' | 'segments' | 'session'>,
  ctx: EditorContext,
): Draft {
  const kind = workoutKind(workout);
  if (sessionOf(kind)) {
    return {
      kind,
      amount: clampAmount(kind, Math.round(totalDuration(workout) / 60), ctx),
    };
  }
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
  const session = sessionOf(kind);
  if (session) return sessionDraftSegments(workoutId, session, amount, ctx);
  const { rules } = ctx;
  const { step, repeat } = stepFactory(workoutId);
  const easy = paceRange(rules.easyPace, 10, 20);
  const warmPace = paceRange(rules.easyPace + 30, 10, 15);
  const layout = layoutFor(kind, amount, ctx);

  if (kind === 'intervals') {
    const meters = intervalMeters(rules.focus, ctx.week);
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
  // A basic type has no session: drop the one the workout may have had.
  const { session: _previous, ...rest } = workout;
  const session = sessionOf(draft.kind);
  return {
    ...rest,
    type: workoutType(draft.kind),
    ...(session ? { session } : {}),
    edited: true,
    segments: segmentsFor(workout.id, draft, ctx),
  };
}

export type RunStats = {
  seconds: number;
  meters: number;
  /** Fastest target pace, or `null` when nothing is paced. */
  pace: Pace | null;
  /**
   * The hardest zone of a session's efforts, or `null` without zones.
   * Shown instead of a pace when its hardest efforts are too short to be
   * paced (HIIT, strides, sprints).
   */
  topZone: Zone | null;
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
    topZone: topZone(workout),
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

const isDemanding = isDemandingType;

/**
 * True when a demanding session (long run, intervals, speed, tempo) on
 * `date` would sit right next to another one. Only a soft warning: saving
 * stays allowed.
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
  const week = planWeekIndex(plan.startDate, date);
  const fresh = await generatePlan(profile, plan.startDate, {
    weeks: Math.max(plan.weeks, week + 1),
  });
  return fresh.workouts.find((workout) => workout.date === date);
}
