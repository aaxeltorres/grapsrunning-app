import { addDays, dayNumber, startOfWeek, todayISO, type ISODate } from '../utils/dates';
import {
  isDemandingType,
  PLAN_SCHEMA_VERSION,
  totalDistance,
  totalDuration,
  type Pace,
  type Plan,
  type SessionId,
  type StepKind,
  type StepTarget,
  type Workout,
  type WorkoutSegment,
  type WorkoutStep,
  type WorkoutType,
} from './plan';
import { buildSession, isAdvancedLevel, SESSION_SPECS } from './sessions';
import {
  isBeginnerLevel,
  planAnswersSnapshot,
  planLengthOf,
  type DayId,
  type GoalId,
  type LevelId,
  type RunnerProfile,
} from './runnerProfile';

/**
 * Training plan generation. MOCK: a deterministic rule-based plan built
 * from the runner profile, with no network, so the Plan screen can be
 * built end to end before the AI coach exists.
 *
 * Weeks run in blocks of four: three build weeks and a lighter one. Each
 * week's total volume follows `WEEK_CURVE`, whatever sessions it holds:
 * the week is built at the load (`s`) that lands its total closest to the
 * target while keeping build weeks within +10% of the week before and the
 * fourth week 15-25% below the third (see `fitWeek`).
 */

/** Weeks of a monthly plan. */
const MONTHLY_WEEKS = 4;
const CYCLE_WEEKS = 4;
// Weeks 1-3 build up; week 4 (index 3) is the lighter one.
const DELOAD_WEEK = 3;
/** A week's total volume relative to the block's first week. */
const WEEK_CURVE = [1, 1.08, 1.16, 0.92];
/** The long run's length relative to the block's first week. */
const LONG_CURVE = [1, 1.08, 1.16, 0.9];
/** Each new block starts this much above the first one... */
const BLOCK_GROWTH = 0.05;
/** ...for at most this many blocks (no adaptation until the AI coach). */
const MAX_GROWTH_BLOCKS = 4;
/** A build week grows at most this much over the week before. */
const MAX_WEEK_GROWTH = 1.1;
/** The lighter week, relative to the third one. */
const DELOAD_RANGE = { min: 0.75, max: 0.85 };
/** The load a week can be built at, searched in fixed steps. */
const FIT_MIN = 0.6;
const FIT_MAX = 1.6;
const FIT_STEPS = 100;

const DAY_ORDER: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_DAYS: DayId[] = ['tue', 'thu', 'sat'];
// Keep at least one rest day, even when every day is available.
const MAX_TRAINING_DAYS = 6;
const GENTLE_LOAD = 0.7;
const GENTLE_MINUTES = 30;
// Beginners (run/walk) get their first long run in week 3 (index 2).
const BEGINNER_FIRST_LONG_WEEK = 2;
// A beginner's long run: bouts (with their walk) this much longer than the
// week's regular run/walk, so it grows and shrinks with the week.
const BEGINNER_LONG_BOUT_FACTOR = 1.25;
const BEGINNER_RUN_WALK_REPS = 6;
// Walk breaks are fixed, so the lighter week also drops a rep.
const BEGINNER_DELOAD_REPS = 1;
// Running bouts grow by this much each block, up to the cap.
const BOUT_GROWTH_PER_BLOCK = 60;
const MAX_BOUT_SECONDS = 600;
const MIN_BOUT_SECONDS = 30;
export const WALK_BREAK_SECONDS = 120;

/** Easy pace (seconds per km) by level. */
const EASY_PACE: Record<LevelId, number> = {
  not_running: 480,
  run_walk: 450,
  run_30: 420,
  run_5k: 375,
  run_10k_plus: 340,
};

/** Easy run distance (km) by level, for runners past run/walk. */
const EASY_KM: Record<LevelId, number> = {
  not_running: 3,
  run_walk: 3,
  run_30: 4,
  run_5k: 5,
  run_10k_plus: 7,
};

type GoalFocus = '5k' | '10k' | 'distance' | 'general';

const GOAL_FOCUS: Record<GoalId, GoalFocus> = {
  first_5k: '5k',
  run_5k_nonstop: '5k',
  faster_5k: '5k',
  first_10k: '10k',
  faster_10k: '10k',
  first_half: 'distance',
  faster_half: 'distance',
  marathon: 'distance',
  trail: 'distance',
  endurance: 'distance',
  lose_weight: 'general',
  build_habit: 'general',
  return_after_break: 'general',
  stay_active: 'general',
  not_sure: 'general',
};

/** Long run length relative to an easy run. */
const LONG_RUN_FACTOR: Record<GoalFocus, number> = {
  '5k': 1.3,
  '10k': 1.5,
  distance: 1.8,
  general: 1.2,
};

/** Interval rep distance (m) and how much faster than easy pace. */
export const INTERVALS: Record<GoalFocus, { meters: number; fasterBy: number }> = {
  '5k': { meters: 400, fasterBy: 75 },
  '10k': { meters: 800, fasterBy: 60 },
  distance: { meters: 1000, fasterBy: 45 },
  general: { meters: 400, fasterBy: 60 },
};

/** Every other week, classic intervals use reps this much longer... */
const LONG_REP_FACTOR = 1.5;
/** ...and this share of the reps. */
const LONG_REP_SHARE = 2 / 3;
/** Extra interval reps by week of the block: more while building, fewer in week 4. */
const INTERVAL_REPS_BY_WEEK = [0, 1, 2, -1];

export type Rules = {
  level: LevelId;
  focus: GoalFocus;
  beginner: boolean;
  /** An injury hurts now: easy sessions only, shorter. */
  gentle: boolean;
  /** Interval sessions may appear (opted in, past the beginner levels). */
  intervals: boolean;
  /** Aerobic and regenerative sessions may appear (past beginner, no pain). */
  structured: boolean;
  /** The advanced sessions may appear (from the 5K level up). */
  advanced: boolean;
  easyPace: number;
};

export function rulesFor(profile: RunnerProfile): Rules {
  const level = profile.level ?? 'not_running';
  const beginner = isBeginnerLevel(level);
  const gentle = profile.injuryStatus === 'hurts_now';
  return {
    level,
    focus: GOAL_FOCUS[profile.goal ?? 'not_sure'],
    beginner,
    gentle,
    intervals: profile.includeIntervals === true && !beginner && !gentle,
    structured: !beginner && !gentle,
    advanced: !beginner && isAdvancedLevel(level),
    easyPace: EASY_PACE[level],
  };
}

/** Week of its block (0-3); week 3 is the lighter one. */
const cycleWeek = (week: number) => week % CYCLE_WEEKS;
const blockOf = (week: number) => Math.floor(week / CYCLE_WEEKS);
const blockGrowth = (week: number) =>
  1 + BLOCK_GROWTH * Math.min(blockOf(week), MAX_GROWTH_BLOCKS);

/**
 * A week's target volume relative to the plan's first week. Also the
 * nominal load the workout editor builds a session of that week at.
 */
export function weekLoad(week: number) {
  return WEEK_CURVE[cycleWeek(week)] * blockGrowth(week);
}

function trainingDays(profile: RunnerProfile): DayId[] {
  const chosen = DAY_ORDER.filter((day) =>
    profile.availableDays?.includes(day),
  );
  return (chosen.length > 0 ? chosen : DEFAULT_DAYS).slice(
    0,
    MAX_TRAINING_DAYS,
  );
}

function intervalsThisWeek(rules: Rules, week: number) {
  if (!rules.intervals) return false;
  // General-fitness goals get intervals every other week.
  return rules.focus === 'general' ? week % 2 === 1 : true;
}

function longRunThisWeek(rules: Rules, week: number) {
  if (rules.gentle) return false;
  return !rules.beginner || week >= BEGINNER_FIRST_LONG_WEEK;
}

/** Calendar days between two weekdays, wrapping across weeks (0-3). */
function dayDistance(a: DayId, b: DayId) {
  const diff = Math.abs(DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  return Math.min(diff, 7 - diff);
}

function previousDay(day: DayId): DayId {
  return DAY_ORDER[(DAY_ORDER.indexOf(day) + 6) % 7];
}

/**
 * The long run day: the last training day that follows a rest day, so it
 * starts fresh. There is always one, as every week keeps a rest day.
 */
function longRunDay(days: DayId[]): DayId {
  const afterRest = days.filter((day) => !days.includes(previousDay(day)));
  return afterRest[afterRest.length - 1] ?? days[days.length - 1];
}

/**
 * The interval day: as far as possible from the long run, and never next
 * to it (the plan repeats weekly, so Sunday and Monday are neighbors).
 * `undefined` when every other day touches the long run.
 */
function intervalDay(days: DayId[], longDay: DayId | undefined) {
  let best: DayId | undefined;
  let bestDistance = 1;
  for (const day of days) {
    const distance = longDay === undefined ? 7 : dayDistance(day, longDay);
    if (distance > bestDistance) {
      best = day;
      bestDistance = distance;
    }
  }
  return best;
}

function nextDay(day: DayId): DayId {
  return DAY_ORDER[(DAY_ORDER.indexOf(day) + 1) % 7];
}

/**
 * The speed-work session of each week of a block, by goal. The longest one
 * sits in week 3, the biggest week; index 3 is the lighter pick of the
 * easier fourth week. `intervals` is the classic
 * session (e.g. 6 × 400 m).
 */
const QUALITY_ROTATION: Record<GoalFocus, (SessionId | 'intervals')[]> = {
  '5k': ['intervals', 'hiit', 'sprints', 'strides'],
  '10k': ['fartlek', 'tempoRun', 'longIntervals', 'mixedIntervals'],
  distance: ['tempoRun', 'hiitMacro', 'longIntervals', 'fartlek'],
  general: ['fartlek', 'hiit', 'mixedIntervals', 'strides'],
};

/** What a runner below the 5K level gets instead of an advanced session. */
const NON_ADVANCED: Partial<Record<SessionId, SessionId>> = {
  hiit: 'fartlek',
  sprints: 'strides',
  longIntervals: 'fartlek',
  tempoRun: 'mixedIntervals',
  hiitMacro: 'mixedIntervals',
};

/** Aerobic sessions alternate week by week. */
const AEROBIC_ROTATION: SessionId[] = ['extensiveAerobic', 'progressive'];

type Assignment = { type: WorkoutType; session?: SessionId };

function qualitySession(rules: Rules, week: number): Assignment {
  let pick = QUALITY_ROTATION[rules.focus][cycleWeek(week)];
  if (pick !== 'intervals' && SESSION_SPECS[pick].advanced && !rules.advanced) {
    pick = NON_ADVANCED[pick] ?? 'intervals';
  }
  return pick === 'intervals'
    ? { type: 'intervals' }
    : { type: SESSION_SPECS[pick].category, session: pick };
}

function aerobicSession(week: number): Assignment {
  const session = AEROBIC_ROTATION[week % AEROBIC_ROTATION.length];
  return { type: SESSION_SPECS[session].category, session };
}

function aerobicThisWeek(rules: Rules, week: number) {
  // General-fitness goals get it every other week, like intervals.
  return rules.focus === 'general' ? week % 2 === 1 : true;
}

/**
 * Session per training day for one week. Demanding sessions (long run,
 * intervals, speed, tempo) never fall on consecutive days. Around them:
 * - the quality day (as far as possible from the long run) holds the
 *   speed-work session, or an aerobic one for runners without speed work;
 * - runners with speed work and a 10K or longer goal get a second, aerobic
 *   session on a day that touches no demanding one (not in week 4);
 * - an easy day right after a demanding one becomes a regenerative run.
 * Beginners and runners with pain keep easy runs (and their long run).
 */
function weekTypes(
  days: DayId[],
  rules: Rules,
  week: number,
): Map<DayId, Assignment> {
  const types = new Map<DayId, Assignment>(days.map((day) => [day, { type: 'easy' }]));
  const longDay =
    days.length >= 2 && longRunThisWeek(rules, week)
      ? longRunDay(days)
      : undefined;
  if (longDay) types.set(longDay, { type: 'long' });

  const qualityDay = days.length >= 2 ? intervalDay(days, longDay) : undefined;
  if (qualityDay && intervalsThisWeek(rules, week)) {
    types.set(qualityDay, qualitySession(rules, week));
  } else if (qualityDay && rules.structured && aerobicThisWeek(rules, week)) {
    // Every other week for general goals: still alternate between them.
    types.set(qualityDay, aerobicSession(rules.focus === 'general' ? Math.floor(week / 2) : week));
  }

  if (!rules.structured) return types;

  const demanding = (day: DayId) => {
    const assigned = types.get(day);
    return assigned !== undefined && isDemandingType(assigned.type);
  };
  const isEasy = (day: DayId) => {
    const assigned = types.get(day);
    return assigned?.type === 'easy' && assigned.session === undefined;
  };

  if (
    rules.intervals &&
    (rules.focus === '10k' || rules.focus === 'distance') &&
    cycleWeek(week) !== DELOAD_WEEK
  ) {
    const extra = days.find(
      (day) => isEasy(day) && !demanding(previousDay(day)) && !demanding(nextDay(day)),
    );
    if (extra) types.set(extra, aerobicSession(week + 1));
  }

  for (const day of days) {
    if (isEasy(day) && demanding(previousDay(day))) {
      types.set(day, { type: 'easy', session: 'regenerative' });
    }
  }
  return types;
}

/** A session's length relative to the reference, by level. */
const SESSION_LEVEL_SCALE: Record<LevelId, number> = {
  not_running: 0.7,
  run_walk: 0.7,
  run_30: 0.85,
  run_5k: 1,
  run_10k_plus: 1.15,
};

/** A regenerative run is a bit shorter than the week's easy run. */
const REGENERATIVE_SHARE = 0.85;

/**
 * A generated session at load `s` (1 = the plan's first week; by default
 * the week's nominal load). Rep blocks stay as the session defines them;
 * the variant follows the week, so the same session differs from one week
 * to the next. A regenerative run follows the runner's own easy run
 * instead, so it is never longer than their other easy days.
 */
export function sessionSegments(
  workoutId: string,
  session: SessionId,
  rules: Rules,
  week: number,
  s: number = weekLoad(week),
): WorkoutSegment[] {
  if (session === 'regenerative') {
    const easy = totalDuration({ segments: buildSegments(workoutId, 'easy', rules, week, s) });
    return buildSession(workoutId, session, rules.easyPace, {
      totalSeconds: Math.max(minutes(SESSION_SPECS.regenerative.minMinutes), easy * REGENERATIVE_SHARE),
    });
  }
  return buildSession(workoutId, session, rules.easyPace, {
    scale: SESSION_LEVEL_SCALE[rules.level] * s,
    variant: week,
  });
}

export const round5 = (n: number) => Math.round(n / 5) * 5;
const roundHalfKm = (km: number) => Math.max(1, Math.round(km * 2) / 2);
export const minutes = (n: number) => Math.round(n) * 60;

export function paceRange(center: number, below: number, above: number): Pace {
  return { min: round5(center - below), max: round5(center + above) };
}

/** Builds steps with ids derived from the workout id. */
export function stepFactory(workoutId: string) {
  let n = 0;
  const nextId = () => `${workoutId}-${++n}`;
  return {
    step: (
      kind: StepKind,
      target: StepTarget,
      pace: Pace | null,
    ): WorkoutStep => ({ id: nextId(), kind, target, pace }),
    repeat: (repeat: number, steps: WorkoutStep[]): WorkoutSegment => ({
      id: nextId(),
      repeat,
      steps,
    }),
  };
}

export const distance = (km: number): StepTarget => ({
  type: 'distance',
  meters: km * 1000,
});
export const duration = (seconds: number): StepTarget => ({
  type: 'duration',
  seconds,
});

/**
 * Classic interval rep distance in a week: the goal's rep, and every
 * other week a longer one (e.g. 400 m, then 600 m), so the session never
 * repeats week after week.
 */
export function intervalMeters(focus: GoalFocus, week: number) {
  const { meters } = INTERVALS[focus];
  return week % 2 === 0 ? meters : meters * LONG_REP_FACTOR;
}

/**
 * Interval repetitions in a generated session: more for stronger runners,
 * more while the block builds, fewer in its lighter week, and fewer when
 * the reps are the longer ones.
 */
export function defaultIntervalReps(level: LevelId, week: number) {
  const base = level === 'run_10k_plus' ? 7 : level === 'run_5k' ? 6 : 5;
  const reps = base + INTERVAL_REPS_BY_WEEK[cycleWeek(week)];
  return week % 2 === 0 ? reps : Math.max(3, Math.round(reps * LONG_REP_SHARE));
}

/** Default run/walk repetitions in a generated session. */
export const DEFAULT_RUN_WALK_REPS = BEGINNER_RUN_WALK_REPS;

/**
 * Length of one running bout in a run/walk session, in seconds. Bouts
 * follow the week of the block (longer while building, shorter in week 4)
 * and grow a minute each block. `s` is the week's fitted load. A long
 * run's bouts (with their walk) are 25% longer than the week's regular
 * ones, so it grows and shrinks with the week.
 */
export function runWalkBoutSeconds(
  level: LevelId,
  week: number,
  type: WorkoutType,
  s = 1,
): number {
  const runSecondsByWeek =
    level === 'not_running' ? [60, 90, 120, 90] : [120, 150, 180, 150];
  const bout = Math.min(
    MAX_BOUT_SECONDS,
    runSecondsByWeek[cycleWeek(week)] + BOUT_GROWTH_PER_BLOCK * blockOf(week),
  );
  const regular = Math.max(MIN_BOUT_SECONDS, round5(bout * s));
  if (type !== 'long') return regular;
  return round5((regular + WALK_BREAK_SECONDS) * BEGINNER_LONG_BOUT_FACTOR - WALK_BREAK_SECONDS);
}

/**
 * A workout of a basic type (easy, long, run/walk, classic intervals) at
 * load `s` (by default the week's nominal load). The long run follows its
 * own curve; classic intervals keep their reps fixed.
 */
export function buildSegments(
  workoutId: string,
  type: WorkoutType,
  rules: Rules,
  week: number,
  s: number = weekLoad(week),
): WorkoutSegment[] {
  const { step, repeat } = stepFactory(workoutId);
  const easy = paceRange(rules.easyPace, 10, 20);
  const warm = paceRange(rules.easyPace + 30, 10, 15);

  if (type === 'rest') return [];

  if (type === 'intervals') {
    const { fasterBy } = INTERVALS[rules.focus];
    const fastPace = round5(rules.easyPace - fasterBy);
    const reps = defaultIntervalReps(rules.level, week);
    return [
      step('warmup', duration(minutes(10)), warm),
      repeat(reps, [
        step('work', distance(intervalMeters(rules.focus, week) / 1000), fastPace),
        step('recovery', duration(90), null),
      ]),
      step('cooldown', duration(minutes(5)), warm),
    ];
  }

  if (rules.beginner) {
    // Run/walk: running bouts grow week by week.
    const runSeconds = runWalkBoutSeconds(rules.level, week, type, s);
    const reps =
      BEGINNER_RUN_WALK_REPS -
      (rules.gentle ? 2 : 0) -
      (cycleWeek(week) === DELOAD_WEEK ? BEGINNER_DELOAD_REPS : 0);
    return [
      step('warmup', duration(minutes(5)), null),
      repeat(reps, [
        step('steady', duration(runSeconds), easy),
        step('recovery', duration(WALK_BREAK_SECONDS), null),
      ]),
      step('cooldown', duration(minutes(5)), null),
    ];
  }

  if (rules.gentle) {
    // Time-based, so there is no pressure to cover a distance.
    return [step('steady', duration(minutes(GENTLE_MINUTES * GENTLE_LOAD * s)), easy)];
  }

  if (type === 'long') {
    const longLoad = LONG_CURVE[cycleWeek(week)] * blockGrowth(week);
    const km = roundHalfKm(EASY_KM[rules.level] * LONG_RUN_FACTOR[rules.focus] * longLoad);
    return [step('steady', distance(km), paceRange(rules.easyPace, 0, 30))];
  }

  return [step('steady', distance(roundHalfKm(EASY_KM[rules.level] * s)), easy)];
}

type GeneratorContext = {
  rules: Rules;
  days: DayId[];
  /** Monday of the plan's first week. */
  startDate: ISODate;
};

/** One week's workouts (rest days included) and its totals. */
type BuiltWeek = { workouts: Workout[]; seconds: number; meters: number };

function buildWeekAt(ctx: GeneratorContext, week: number, s: number): BuiltWeek {
  const { rules, days, startDate } = ctx;
  const types = weekTypes(days, rules, week);
  const workouts = DAY_ORDER.map((day, dayIndex): Workout => {
    const date = addDays(startDate, week * 7 + dayIndex);
    const { type, session }: Assignment = types.get(day) ?? { type: 'rest' };
    const id = `w-${date}`;
    return {
      id,
      date,
      type,
      ...(session ? { session } : {}),
      status: 'planned',
      segments: session
        ? sessionSegments(id, session, rules, week, s)
        : buildSegments(id, type, rules, week, s),
    };
  });
  return {
    workouts,
    seconds: workouts.reduce((sum, w) => sum + totalDuration(w), 0),
    meters: workouts.reduce((sum, w) => sum + totalDistance(w), 0),
  };
}

/** Allowed totals relative to the week before, by week of the block. */
function weekBounds(week: number) {
  const cycle = cycleWeek(week);
  if (cycle === 0) return null;
  if (cycle === DELOAD_WEEK) return DELOAD_RANGE;
  return { min: 1, max: MAX_WEEK_GROWTH };
}

/** How far a week falls outside its bounds, on time and distance (0 = inside). */
function boundsMiss(built: BuiltWeek, previous: BuiltWeek | undefined, week: number) {
  const bounds = weekBounds(week);
  if (!bounds || !previous) return 0;
  let miss = 0;
  for (const [value, before] of [
    [built.seconds, previous.seconds],
    [built.meters, previous.meters],
  ]) {
    if (before <= 0) continue;
    const ratio = value / before;
    miss += Math.max(0, bounds.min - ratio) + Math.max(0, ratio - bounds.max);
  }
  return miss;
}

/**
 * Builds a week at the load whose total time is closest to its target
 * (the first week's volume × `weekLoad`), among the loads that keep it
 * within its bounds; when none does, the one that misses them least. Ties
 * go to the load closest to 1. Deterministic: a fixed grid of loads.
 */
function fitWeek(
  ctx: GeneratorContext,
  week: number,
  first: BuiltWeek,
  previous: BuiltWeek | undefined,
): BuiltWeek {
  const target = first.seconds * weekLoad(week);
  let best: BuiltWeek | undefined;
  let bestScore = Infinity;
  for (let i = 0; i <= FIT_STEPS; i += 1) {
    const s = FIT_MIN + ((FIT_MAX - FIT_MIN) * i) / FIT_STEPS;
    const built = buildWeekAt(ctx, week, s);
    const score =
      boundsMiss(built, previous, week) * 1e9 +
      Math.abs(built.seconds - target) +
      Math.abs(s - 1) * 1e-3;
    if (score < bestScore) {
      best = built;
      bestScore = score;
    }
  }
  return best!;
}

/**
 * The given weeks, fitted. A week's bounds depend on the week before in
 * its block, so each block is built from its first week: any week comes
 * out the same whether it is built alone (a weekly plan's next week) or
 * with the whole plan.
 */
function fittedWeeks(ctx: GeneratorContext, weeks: number[]): Map<number, BuiltWeek> {
  // The plan's first week at its natural load sets the volume.
  const first = buildWeekAt(ctx, 0, 1);
  const cache = new Map<number, BuiltWeek>();
  const fitted = (week: number): BuiltWeek => {
    const cached = cache.get(week);
    if (cached) return cached;
    const previous = cycleWeek(week) === 0 ? undefined : fitted(week - 1);
    const built = fitWeek(ctx, week, first, previous);
    cache.set(week, built);
    return built;
  };
  return new Map(weeks.map((week) => [week, fitted(week)]));
}

function contextFor(profile: RunnerProfile, startDate: ISODate): GeneratorContext {
  return { rules: rulesFor(profile), days: trainingDays(profile), startDate };
}

/** Workouts of the given weeks (counted from `startDate`), from `from` on. */
function weekWorkouts(
  profile: RunnerProfile,
  startDate: ISODate,
  weeks: number[],
  from: ISODate,
): Workout[] {
  const built = fittedWeeks(contextFor(profile, startDate), weeks);
  return weeks
    .flatMap((week) => built.get(week)?.workouts ?? [])
    .filter((workout) => workout.date >= from);
}

const range = (count: number) => Array.from({ length: count }, (_, i) => i);

/**
 * Deterministic mock plan: the same profile and date always give the
 * same plan. From the Monday of `today`'s week: four weeks for a monthly
 * plan, one for a weekly plan (or `weeks`, when given). Days before
 * `today` are left out, and days without training are rest days.
 */
export function buildMockPlan(
  profile: RunnerProfile,
  today: ISODate = todayISO(),
  options: { weeks?: number } = {},
): Plan {
  const length = planLengthOf(profile);
  const startDate = startOfWeek(today);
  const weeks = options.weeks ?? (length === 'weekly' ? 1 : MONTHLY_WEEKS);

  return {
    id: `plan-${startDate}`,
    schemaVersion: PLAN_SCHEMA_VERSION,
    source: 'mock',
    createdAt: new Date().toISOString(),
    startDate,
    weeks,
    length,
    basedOn: planAnswersSnapshot(profile),
    workouts: weekWorkouts(profile, startDate, range(weeks), today),
  };
}

/**
 * Builds a training plan for the runner.
 *
 * TODO(ai-coach): replace the mock with a call to the backend AI coach
 * (grapsrunning-backend), sending the profile as-is and validating the
 * returned JSON against the `Plan` type. Injuries and `injuryStatus`
 * must be respected there: 'hurts_now' keeps the plan gentle. The same
 * rules as the mock apply: no demanding sessions (long, intervals, speed,
 * tempo) on consecutive days, no interval or speed sessions unless
 * `includeIntervals` (and never for beginners), the advanced sessions
 * only from the 5K level up, and beginners' first long run in week 3.
 * Weekly volume builds for three weeks (at most +10% a week) and drops
 * 15-25% in the fourth; a session never repeats with the same structure
 * on the same weekday in consecutive weeks. A weekly plan (`planLength`)
 * gets one week now and the next ones through `extendPlan`.
 * Sessions come back with `session` set, built as in `sessions.ts`.
 */
export async function generatePlan(
  profile: RunnerProfile,
  today: ISODate = todayISO(),
  options: { weeks?: number } = {},
): Promise<Plan> {
  return buildMockPlan(profile, today, options);
}

/**
 * The workouts of week `week` of a plan starting on `startDate`, from
 * `from` on. The week continues the plan's block pattern (three build
 * weeks, one lighter) by its index.
 *
 * TODO(ai-coach): the AI coach builds the next week here, and may adapt
 * it to the weeks already run.
 */
export async function generateWeek(
  profile: RunnerProfile,
  startDate: ISODate,
  week: number,
  from: ISODate,
): Promise<Workout[]> {
  return weekWorkouts(profile, startDate, [week], from);
}

/** Index of `date`'s week in a plan starting on `startDate` (0 = first). */
export function planWeekIndex(startDate: ISODate, date: ISODate) {
  return Math.floor((dayNumber(date) - dayNumber(startDate)) / 7);
}

/**
 * A weekly plan gets the week it is in once that week starts: when
 * `today` falls past the generated weeks, the current week is generated
 * by its calendar index (so build, build, build, lighter carries on) and
 * appended from `today` on. Weeks the app was not opened in are not filled
 * in: they are over. Existing workouts are never touched. Returns the same
 * plan when there is nothing to add, including for monthly plans.
 */
export async function extendPlan(
  plan: Plan,
  profile: RunnerProfile,
  today: ISODate = todayISO(),
): Promise<Plan> {
  if (plan.length !== 'weekly') return plan;
  const week = planWeekIndex(plan.startDate, today);
  if (week < plan.weeks) return plan;

  const taken = new Set(plan.workouts.map((w) => w.date));
  const added = (await generateWeek(profile, plan.startDate, week, today)).filter(
    (w) => !taken.has(w.date),
  );
  return {
    ...plan,
    weeks: week + 1,
    basedOn: planAnswersSnapshot(profile),
    keptAnswers: undefined,
    workouts: [...plan.workouts, ...added].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * A workout "Create a new plan" replaces: planned and from today on, edited
 * or not. Completed, partial and skipped workouts (and past days) stay.
 */
function isReplaceable(workout: Workout, today: ISODate) {
  return workout.date >= today && workout.status === 'planned';
}

/**
 * Builds a new plan from the runner's current answers, keeping what already
 * happened. Every planned workout from `today` on is replaced, including
 * edited ones; completed, partial and skipped workouts keep their results,
 * and a new workout never lands on a date a kept workout already uses. The
 * new plan starts this week (its progression restarts at week 1) with the
 * runner's plan length. With no stored plan it is simply the generated one.
 */
export async function createNewPlan(
  plan: Plan | null,
  profile: RunnerProfile,
  today: ISODate = todayISO(),
): Promise<Plan> {
  const fresh = await generatePlan(profile, today);
  if (!plan) return fresh;

  const kept = plan.workouts.filter((w) => !isReplaceable(w, today));
  const taken = new Set(kept.map((w) => w.date));
  const added = fresh.workouts.filter(
    (w) => w.date >= today && !taken.has(w.date),
  );

  return {
    ...fresh,
    workouts: [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
