import type { RunModeId } from '../run/runModes';
import type { RunGoal } from '../run/goals';
import type { Split } from '../run/splits';
import type { RepResult, Workout } from '../coach/plan';

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RootStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  Home: undefined;
  Stats: undefined;
  /** `planCreated`: set by Your profile after "Create a new plan", so Mike says so. */
  Plan: { planCreated?: boolean } | undefined;
  Profile: undefined;
  // Placeholder destinations for the other Home feature cards.
  // Not part of the current screen scope — wired up as empty stubs
  // so navigation from Home doesn't dead-end.
  CoachMike: undefined;
  Routes: undefined;
  RunMode: undefined;
  GoalSetup: undefined;
  IntervalSetup: undefined;
  /**
   * No params (or no mode) starts a quick run. `goal` is for goal runs,
   * `workout` for plan workout runs and for the interval workout the
   * runner built (a free run: it is not part of the Plan).
   */
  ActiveRun: { mode?: RunModeId; goal?: RunGoal; workout?: Workout } | undefined;
  RunResults: {
    distanceKm: number;
    durationSeconds: number;
    route: RouteCoordinate[];
    /** Set when the run was a goal run. */
    goal?: RunGoal;
    /** When the run started (ms since epoch). */
    startedAt?: number;
    calories?: number;
    /** Per-kilometer splits, empty when there is no complete kilometer. */
    splits?: Split[];
    /** Set when the run was a plan workout: what was planned, to compare. */
    planned?: { workout: Workout; partial: boolean };
    /** Workouts with reps (plan or intervals): every work step as it was run. */
    reps?: RepResult[];
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
