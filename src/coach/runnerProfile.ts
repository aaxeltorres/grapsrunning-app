/**
 * Runner profile collected by Mike's Plan onboarding.
 * Holds stable option ids (never display labels) and metric values, so it
 * can be sent to an AI coach or backend as-is.
 */

export type GoalId =
  | 'first_5k'
  | 'run_5k_nonstop'
  | 'faster_5k'
  | 'first_10k'
  | 'faster_10k'
  | 'first_half'
  | 'faster_half'
  | 'marathon'
  | 'trail'
  | 'lose_weight'
  | 'build_habit'
  | 'return_after_break'
  | 'endurance'
  | 'stay_active'
  | 'not_sure';

export type LevelId =
  | 'not_running'
  | 'run_walk'
  | 'run_30'
  | 'run_5k'
  | 'run_10k_plus'
  | 'run_half'
  | 'run_marathon'
  | 'run_competitive';

const LEVEL_IDS: readonly LevelId[] = [
  'not_running',
  'run_walk',
  'run_30',
  'run_5k',
  'run_10k_plus',
  'run_half',
  'run_marathon',
  'run_competitive',
];

/**
 * The level when `value` is a level id this version knows, otherwise
 * `undefined` (a saved profile from another version): the same as no level.
 */
export function knownLevel(value: unknown): LevelId | undefined {
  return LEVEL_IDS.find((id) => id === value);
}

/** Levels that build up with run/walk; they get no speed work. */
const BEGINNER_LEVELS: readonly LevelId[] = ['not_running', 'run_walk'];

export function isBeginnerLevel(level: LevelId) {
  return BEGINNER_LEVELS.includes(level);
}

export type SpeedWorkId = 'yes' | 'no' | 'not_sure';

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type InjuryId =
  | 'none'
  | 'knee'
  | 'ankle_foot'
  | 'shin_calf'
  | 'achilles'
  | 'hamstring_thigh'
  | 'hip'
  | 'lower_back'
  | 'other';

export type InjuryStatusId = 'recovered' | 'sometimes_bothers' | 'hurts_now';

/**
 * How far ahead the plan goes: one week at a time (the next week is added
 * when it starts) or four weeks at once.
 */
export type PlanLengthId = 'weekly' | 'monthly';

/** Every answer the onboarding collects, keyed by question id. */
export type RunnerAnswers = {
  goal: GoalId;
  level: LevelId;
  /** Only asked past the beginner levels. Drives `includeIntervals`. */
  speedWork: SpeedWorkId;
  availableDays: DayId[];
  /** Missing on profiles saved before the question: read it with `planLengthOf`. */
  planLength: PlanLengthId;
  age: number;
  heightCm: number;
  weightKg: number;
  injuries: InjuryId[];
  /** Only asked when at least one injury was selected. */
  injuryStatus: InjuryStatusId;
};

export type QuestionId = keyof RunnerAnswers;

export const RUNNER_PROFILE_SCHEMA_VERSION = 1;

/**
 * What training zones are measured by. Only pace exists: there is no heart
 * rate in the app yet, so 'heartRate' is never stored for now.
 */
export type IntensityById = 'pace' | 'heartRate';

export type RunnerProfile = Partial<RunnerAnswers> & {
  schemaVersion: typeof RUNNER_PROFILE_SCHEMA_VERSION;
  /**
   * Interval sessions in the plan. Derived from `speedWork` ("Not sure"
   * counts as no); missing means false.
   */
  includeIntervals?: boolean;
  /**
   * A setting, not an onboarding answer: missing means pace, and changing
   * it never asks to update the plan (it isn't in `PLAN_ANSWER_IDS`).
   */
  intensityBy?: IntensityById;
  /** ISO timestamp of the last save. */
  updatedAt?: string;
};

export function createEmptyProfile(): RunnerProfile {
  return { schemaVersion: RUNNER_PROFILE_SCHEMA_VERSION, includeIntervals: false };
}

/** Recomputes the fields derived from answers. Call after any change. */
export function withDerivedFields(profile: RunnerProfile): RunnerProfile {
  return { ...profile, includeIntervals: profile.speedWork === 'yes' };
}

/** The plan length; missing (profiles from before the question) means monthly. */
export function planLengthOf(profile: RunnerProfile): PlanLengthId {
  return profile.planLength ?? 'monthly';
}

/**
 * The plan answers in a normalized form (order of days and injuries does
 * not matter, no injury status without an injury). Stored with a plan to
 * remember what it was built from.
 */
export type PlanAnswersSnapshot = {
  goal?: GoalId;
  level?: LevelId;
  speedWork?: SpeedWorkId;
  availableDays: DayId[];
  planLength: PlanLengthId;
  injuries: InjuryId[];
  injuryStatus?: InjuryStatusId;
};

export function planAnswersSnapshot(profile: RunnerProfile): PlanAnswersSnapshot {
  const injuries = [...(profile.injuries ?? [])].sort();
  const hasInjury = injuries.some((injury) => injury !== 'none');
  return {
    goal: profile.goal,
    level: knownLevel(profile.level),
    speedWork: profile.speedWork,
    availableDays: [...(profile.availableDays ?? [])].sort(),
    planLength: planLengthOf(profile),
    injuries,
    injuryStatus: hasInjury ? profile.injuryStatus : undefined,
  };
}

export function samePlanAnswers(a: PlanAnswersSnapshot, b: PlanAnswersSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when the plan length differs between two snapshots. */
export function planLengthChanged(a: PlanAnswersSnapshot, b: PlanAnswersSnapshot) {
  return a.planLength !== b.planLength;
}
