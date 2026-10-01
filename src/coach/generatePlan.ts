import { addDays, startOfWeek, todayISO, type ISODate } from '../utils/dates';
import {
  PLAN_SCHEMA_VERSION,
  type Pace,
  type Plan,
  type StepKind,
  type StepTarget,
  type Workout,
  type WorkoutSegment,
  type WorkoutStep,
  type WorkoutType,
} from './plan';
import {
  isBeginnerLevel,
  type DayId,
  type GoalId,
  type LevelId,
  type RunnerProfile,
} from './runnerProfile';

/**
 * Training plan generation. MOCK: a deterministic rule-based plan built
 * from the runner profile, with no network, so the Plan screen can be
 * built end to end before the AI coach exists.
 */

const PLAN_WEEKS = 4;
const DAY_ORDER: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_DAYS: DayId[] = ['tue', 'thu', 'sat'];
// Keep at least one rest day, even when every day is available.
const MAX_TRAINING_DAYS = 6;
// Weeks 1-3 build up; week 4 is lighter to absorb the work.
const WEEK_LOAD = [1, 1.1, 1.2, 0.85];
const GENTLE_LOAD = 0.7;
// Beginners (run/walk) get their first long run in week 3 (index 2)...
const BEGINNER_FIRST_LONG_WEEK = 2;
// ...and it grows about 10% a week from their regular run/walk session.
const BEGINNER_LONG_GROWTH = 1.1;
const BEGINNER_RUN_WALK_REPS = 6;
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

export type Rules = {
  level: LevelId;
  focus: GoalFocus;
  beginner: boolean;
  /** An injury hurts now: easy sessions only, shorter. */
  gentle: boolean;
  /** Interval sessions may appear (opted in, past the beginner levels). */
  intervals: boolean;
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
    easyPace: EASY_PACE[level],
  };
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

/**
 * Session type per training day for one week. Demanding sessions (long
 * run, intervals) never fall on consecutive days; everything else is easy.
 */
function weekTypes(
  days: DayId[],
  rules: Rules,
  week: number,
): Map<DayId, WorkoutType> {
  const types = new Map<DayId, WorkoutType>(days.map((day) => [day, 'easy']));
  const longDay =
    days.length >= 2 && longRunThisWeek(rules, week)
      ? longRunDay(days)
      : undefined;
  if (longDay) types.set(longDay, 'long');

  if (days.length >= 2 && intervalsThisWeek(rules, week)) {
    const day = intervalDay(days, longDay);
    if (day) types.set(day, 'intervals');
  }
  return types;
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

/** Interval repetitions in a generated session (more for stronger runners). */
export function defaultIntervalReps(level: LevelId, week: number) {
  const base = level === 'run_10k_plus' ? 7 : level === 'run_5k' ? 6 : 5;
  return base + (week === 1 || week === 2 ? 1 : 0);
}

/** Default run/walk repetitions in a generated session. */
export const DEFAULT_RUN_WALK_REPS = BEGINNER_RUN_WALK_REPS;

/**
 * Length of one running bout in a run/walk session, in seconds. Bouts
 * grow week by week; a long run's bouts are about 10% longer than the
 * first long-run week's regular session, and grow about 10% a week.
 */
export function runWalkBoutSeconds(
  level: LevelId,
  week: number,
  type: WorkoutType,
): number {
  const runSecondsByWeek =
    level === 'not_running' ? [60, 90, 120, 90] : [120, 150, 180, 150];
  if (type !== 'long') return runSecondsByWeek[week] ?? runSecondsByWeek[3];

  const baseRun = runSecondsByWeek[BEGINNER_FIRST_LONG_WEEK];
  const growth = BEGINNER_LONG_GROWTH ** (week - BEGINNER_FIRST_LONG_WEEK + 1);
  const repSeconds = (baseRun + WALK_BREAK_SECONDS) * growth;
  return round5(repSeconds - WALK_BREAK_SECONDS);
}

export function buildSegments(
  workoutId: string,
  type: WorkoutType,
  rules: Rules,
  week: number,
): WorkoutSegment[] {
  const { step, repeat } = stepFactory(workoutId);
  const load = WEEK_LOAD[week] * (rules.gentle ? GENTLE_LOAD : 1);
  const easy = paceRange(rules.easyPace, 10, 20);
  const warm = paceRange(rules.easyPace + 30, 10, 15);

  if (type === 'rest') return [];

  if (type === 'intervals') {
    const { meters, fasterBy } = INTERVALS[rules.focus];
    const fastPace = round5(rules.easyPace - fasterBy);
    const reps = defaultIntervalReps(rules.level, week);
    return [
      step('warmup', duration(minutes(10)), warm),
      repeat(reps, [
        step('work', distance(meters / 1000), fastPace),
        step('recovery', duration(90), null),
      ]),
      step('cooldown', duration(minutes(5)), warm),
    ];
  }

  if (rules.beginner) {
    // Run/walk: running bouts grow week by week.
    const runSeconds = runWalkBoutSeconds(rules.level, week, type);
    const reps = BEGINNER_RUN_WALK_REPS - (rules.gentle ? 2 : 0);
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
    return [step('steady', duration(minutes(30 * load)), easy)];
  }

  const factor = type === 'long' ? LONG_RUN_FACTOR[rules.focus] : 1;
  const km = roundHalfKm(EASY_KM[rules.level] * factor * load);
  const pace = type === 'long' ? paceRange(rules.easyPace, 0, 30) : easy;
  return [step('steady', distance(km), pace)];
}

/**
 * Deterministic mock plan: the same profile and date always give the
 * same plan. Four weeks from the Monday of `today`'s week; days before
 * `today` are left out, and days without training are rest days.
 */
export function buildMockPlan(
  profile: RunnerProfile,
  today: ISODate = todayISO(),
): Plan {
  const rules = rulesFor(profile);
  const days = trainingDays(profile);
  const startDate = startOfWeek(today);
  const workouts: Workout[] = [];

  for (let week = 0; week < PLAN_WEEKS; week += 1) {
    const types = weekTypes(days, rules, week);
    DAY_ORDER.forEach((day, dayIndex) => {
      const date = addDays(startDate, week * 7 + dayIndex);
      if (date < today) return;

      const type = types.get(day) ?? 'rest';
      const id = `w-${date}`;
      workouts.push({
        id,
        date,
        type,
        status: 'planned',
        segments: buildSegments(id, type, rules, week),
      });
    });
  }

  return {
    id: `plan-${startDate}`,
    schemaVersion: PLAN_SCHEMA_VERSION,
    source: 'mock',
    createdAt: new Date().toISOString(),
    startDate,
    weeks: PLAN_WEEKS,
    workouts,
  };
}

/**
 * Builds a training plan for the runner.
 *
 * TODO(ai-coach): replace the mock with a call to the backend AI coach
 * (grapsrunning-backend), sending the profile as-is and validating the
 * returned JSON against the `Plan` type. Injuries and `injuryStatus`
 * must be respected there: 'hurts_now' keeps the plan gentle. The same
 * rules as the mock apply: no demanding sessions on consecutive days,
 * no intervals unless `includeIntervals` (and never for beginners), and
 * beginners' first long run in week 3.
 */
export async function generatePlan(
  profile: RunnerProfile,
  today: ISODate = todayISO(),
): Promise<Plan> {
  return buildMockPlan(profile, today);
}

/** A workout the user can still change: ahead of us, planned, never edited. */
function isRegeneratable(workout: Workout, today: ISODate) {
  return (
    workout.date >= today && workout.status === 'planned' && !workout.edited
  );
}

/**
 * Rebuilds the plan after the runner's answers changed. Only the workouts
 * that are still ahead, planned and not edited are replaced: past days,
 * completed, skipped and edited workouts stay exactly as they are. The
 * plan keeps its id, start date and length, and the new workouts follow
 * the same week-by-week progression as the original.
 */
export async function regeneratePlan(
  plan: Plan,
  profile: RunnerProfile,
  today: ISODate = todayISO(),
): Promise<Plan> {
  // Generated from the plan's own start, so week 1 stays week 1.
  const fresh = await generatePlan(profile, plan.startDate);
  const kept = plan.workouts.filter((w) => !isRegeneratable(w, today));
  const taken = new Set(kept.map((w) => w.date));
  const added = fresh.workouts.filter(
    (w) => w.date >= today && !taken.has(w.date),
  );

  return {
    ...plan,
    workouts: [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
