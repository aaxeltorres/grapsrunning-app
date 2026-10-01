import type { RunModeId } from '../run/runModes';
import type { RunGoal } from '../run/goals';

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RootStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  Home: undefined;
  Stats: undefined;
  Plan: undefined;
  Profile: undefined;
  // Placeholder destinations for the other Home feature cards.
  // Not part of the current screen scope — wired up as empty stubs
  // so navigation from Home doesn't dead-end.
  CoachMike: undefined;
  Routes: undefined;
  RunMode: undefined;
  GoalSetup: undefined;
  /** No params (or no mode) starts a quick run. `goal` is for goal runs. */
  ActiveRun: { mode?: RunModeId; goal?: RunGoal } | undefined;
  RunResults: {
    distanceKm: number;
    durationSeconds: number;
    route: RouteCoordinate[];
    /** Set when the run was a goal run. */
    goal?: RunGoal;
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
