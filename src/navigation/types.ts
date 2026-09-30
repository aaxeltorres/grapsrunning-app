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
  // Placeholder destinations for the other Home feature cards.
  // Not part of the current screen scope — wired up as empty stubs
  // so navigation from Home doesn't dead-end.
  CoachMike: undefined;
  Routes: undefined;
  ActiveRun: undefined;
  RunResults: {
    distanceKm: number;
    durationSeconds: number;
    route: RouteCoordinate[];
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
