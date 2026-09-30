import type { DayId, LevelId, RunnerProfile } from './runnerProfile';

/**
 * Training plan generation. STUB: returns mock data built from the runner
 * profile so the onboarding flow can be wired end to end.
 */

export type PlannedSessionKind = 'run_walk' | 'easy' | 'intervals' | 'long';

export type PlannedSession = {
  day: DayId;
  kind: PlannedSessionKind;
  durationMin: number;
  description: string;
};

export type TrainingPlan = {
  /** 'mock' until the AI coach generates real plans. */
  source: 'mock';
  createdAt: string;
  weeks: number;
  /** The same week repeats for now. */
  weeklySessions: PlannedSession[];
};

const MOCK_WEEKS = 8;
// Keep at least one rest day, even when every day is available.
const MAX_SESSIONS_PER_WEEK = 6;

const BASE_MINUTES: Record<LevelId, number> = {
  not_running: 20,
  run_walk: 25,
  run_30: 30,
  run_5k: 35,
  run_10k_plus: 45,
};

const DESCRIPTIONS: Record<PlannedSessionKind, string> = {
  run_walk: 'Alternate 1 min easy running with 2 min walking.',
  easy: 'Easy run at a pace where you can still chat.',
  intervals: 'Warm up, then 6 × 1 min faster with 2 min easy in between.',
  long: 'Longest run of the week, nice and relaxed.',
};

function sessionKind(
  level: LevelId,
  index: number,
  count: number,
): PlannedSessionKind {
  if (level === 'not_running' || level === 'run_walk') return 'run_walk';
  if (count >= 3 && index === count - 1) return 'long';
  if (count >= 2 && index === 1) return 'intervals';
  return 'easy';
}

/**
 * Builds a training plan for the runner.
 *
 * TODO(ai-coach): replace the mock with a call to the backend AI coach
 * (grapsrunning-backend), sending the profile as-is. Consider injuries and
 * `injuryStatus` there: 'hurts_now' must keep the plan gentle.
 */
export async function generatePlan(
  profile: RunnerProfile,
): Promise<TrainingPlan> {
  const level = profile.level ?? 'not_running';
  const days = (profile.availableDays ?? []).slice(0, MAX_SESSIONS_PER_WEEK);
  const gentle = profile.injuryStatus === 'hurts_now';
  const baseMinutes = BASE_MINUTES[level] - (gentle ? 10 : 0);

  const weeklySessions = days.map((day, index): PlannedSession => {
    const kind = gentle
      ? 'run_walk'
      : sessionKind(level, index, days.length);
    const durationMin = kind === 'long' ? baseMinutes + 15 : baseMinutes;
    return { day, kind, durationMin, description: DESCRIPTIONS[kind] };
  });

  return {
    source: 'mock',
    createdAt: new Date().toISOString(),
    weeks: MOCK_WEEKS,
    weeklySessions,
  };
}
