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
  | 'run_10k_plus';

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

/** Every answer the onboarding collects, keyed by question id. */
export type RunnerAnswers = {
  goal: GoalId;
  level: LevelId;
  /** Only asked past the beginner levels. Drives `includeIntervals`. */
  speedWork: SpeedWorkId;
  availableDays: DayId[];
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

/** Answers the training plan is built from; the rest only describe the runner. */
const PLAN_ANSWER_IDS = [
  'goal',
  'level',
  'speedWork',
  'availableDays',
  'injuries',
  'injuryStatus',
] as const satisfies readonly QuestionId[];

/** True when a change between two profiles makes the saved plan out of date. */
export function planAnswersChanged(a: RunnerProfile, b: RunnerProfile) {
  return PLAN_ANSWER_IDS.some(
    (id) => JSON.stringify(a[id]) !== JSON.stringify(b[id]),
  );
}
