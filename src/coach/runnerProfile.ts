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

export type RunnerProfile = Partial<RunnerAnswers> & {
  schemaVersion: typeof RUNNER_PROFILE_SCHEMA_VERSION;
  /** ISO timestamp of the last save. */
  updatedAt?: string;
};

export function createEmptyProfile(): RunnerProfile {
  return { schemaVersion: RUNNER_PROFILE_SCHEMA_VERSION };
}
