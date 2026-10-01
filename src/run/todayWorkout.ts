/**
 * What the plan says about today, for the run mode selector. Pure logic,
 * no React.
 */

import {
  upcomingWorkouts,
  type Plan,
  type Workout,
} from '../coach/plan';
import type { ISODate } from '../utils/dates';

export type TodayRunState =
  /** A workout is waiting for today. */
  | { kind: 'planned'; workout: Workout }
  /** Today's workout is already done. */
  | { kind: 'completed'; workout: Workout }
  /** Rest day, with the next planned workout when there is one. */
  | { kind: 'rest'; next?: Workout }
  /** No plan, today is outside it, or the workout was skipped. */
  | { kind: 'none'; next?: Workout };

export function todayRunState(plan: Plan | null, today: ISODate): TodayRunState {
  if (!plan) return { kind: 'none' };

  const next = upcomingWorkouts(plan, today, 1)[0];
  const workout = plan.workouts.find((w) => w.date === today);

  if (!workout) return { kind: 'none', next };
  if (workout.type === 'rest') return { kind: 'rest', next };
  if (workout.status === 'completed') return { kind: 'completed', workout };
  if (workout.status === 'skipped') return { kind: 'none', next };
  return { kind: 'planned', workout };
}
