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
import type { DayId, GoalId, LevelId, RunnerProfile } from './runnerProfile';

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
const INTERVALS: Record<GoalFocus, { meters: number; fasterBy: number }> = {
  '5k': { meters: 400, fasterBy: 75 },
  '10k': { meters: 800, fasterBy: 60 },
  distance: { meters: 1000, fasterBy: 45 },
  general: { meters: 400, fasterBy: 60 },
};

type Rules = {
  level: LevelId;
  focus: GoalFocus;
  beginner: boolean;
  /** An injury hurts now: easy sessions only, shorter. */
  gentle: boolean;
  easyPace: number;
};

function rulesFor(profile: RunnerProfile): Rules {
  const level = profile.level ?? 'not_running';
  return {
    level,
    focus: GOAL_FOCUS[profile.goal ?? 'not_sure'],
    beginner: level === 'not_running' || level === 'run_walk',
    gentle: profile.injuryStatus === 'hurts_now',
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

function intervalsAllowed(rules: Rules, week: number) {
  if (rules.gentle) return false;
  // Beginners build a base first.
  if (rules.beginner) return week >= 2;
  // General-fitness goals get intervals every other week.
  return rules.focus === 'general' ? week % 2 === 1 : true;
}

/** Session types for one week, in day order. */
function weekTypes(count: number, rules: Rules, week: number): WorkoutType[] {
  const types: WorkoutType[] = Array.from({ length: count }, () => 'easy');
  if (rules.gentle) return types;
  if (count >= 2) types[count - 1] = 'long';
  if (count >= 2 && intervalsAllowed(rules, week)) {
    types[count >= 3 ? 1 : 0] = 'intervals';
  }
  return types;
}

const round5 = (n: number) => Math.round(n / 5) * 5;
const roundHalfKm = (km: number) => Math.max(1, Math.round(km * 2) / 2);
const minutes = (n: number) => Math.round(n) * 60;

function paceRange(center: number, below: number, above: number): Pace {
  return { min: round5(center - below), max: round5(center + above) };
}

/** Builds steps with ids derived from the workout id. */
function stepFactory(workoutId: string) {
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

const distance = (km: number): StepTarget => ({
  type: 'distance',
  meters: km * 1000,
});
const duration = (seconds: number): StepTarget => ({
  type: 'duration',
  seconds,
});

function buildSegments(
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
    if (rules.beginner) {
      // Short strides with walking breaks.
      return [
        step('warmup', duration(minutes(8)), null),
        repeat(6, [
          step('work', duration(30), round5(rules.easyPace - 45)),
          step('recovery', duration(90), null),
        ]),
        step('cooldown', duration(minutes(5)), null),
      ];
    }
    const { meters, fasterBy } = INTERVALS[rules.focus];
    const fastPace = round5(rules.easyPace - fasterBy);
    const reps =
      (rules.level === 'run_10k_plus' ? 7 : rules.level === 'run_5k' ? 6 : 5) +
      (week === 1 || week === 2 ? 1 : 0);
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
    const runSecondsByWeek =
      rules.level === 'not_running' ? [60, 90, 120, 90] : [120, 150, 180, 150];
    const runSeconds = runSecondsByWeek[week];
    const baseReps = type === 'long' ? 8 : 6;
    const reps = Math.max(3, baseReps - (rules.gentle ? 2 : 0));
    return [
      step('warmup', duration(minutes(5)), null),
      repeat(reps, [
        step('steady', duration(runSeconds), easy),
        step('recovery', duration(minutes(2)), null),
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
    const types = weekTypes(days.length, rules, week);
    DAY_ORDER.forEach((day, dayIndex) => {
      const date = addDays(startDate, week * 7 + dayIndex);
      if (date < today) return;

      const sessionIndex = days.indexOf(day);
      const type = sessionIndex === -1 ? 'rest' : types[sessionIndex];
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
 * must be respected there: 'hurts_now' keeps the plan gentle.
 */
export async function generatePlan(
  profile: RunnerProfile,
  today: ISODate = todayISO(),
): Promise<Plan> {
  return buildMockPlan(profile, today);
}
