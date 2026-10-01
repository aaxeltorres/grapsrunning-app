/**
 * Mock finished runs, to preview the Run results screen without running.
 * Data only: nothing in the app imports this file. To see a run, pass one
 * of these as `initialParams` of the RunResults screen (see CLAUDE.md).
 *
 * The long run is a ~5.3 km loop with paces between 5:04 and 5:40 /km
 * (fastest on the third km) and one pause. It goes through the real `computeSplits`, like a
 * run finished in the app.
 */

import type { RootStackParamList, RouteCoordinate } from '../navigation/types';
import type { Workout } from '../coach/plan';
import { computeSplits, type SplitPoint } from '../run/splits';

type RunResultsParams = RootStackParamList['RunResults'];

const CENTER = { latitude: 37.7694, longitude: -122.4862 };
const TOTAL_KM = 5.3;
const SAMPLE_EVERY_S = 5;
/** Pace (s/km) at the start of each kilometer: a strong third km, then a fade. */
const KM_PACES = [318, 312, 304, 322, 331, 340];
const PAUSE_AT_KM = 2.6;
const PAUSE_SECONDS = 45;
const METERS_PER_DEG_LAT = 111_320;

/** A closed, slightly irregular loop of the given length, as a dense polyline. */
function buildLoop(totalKm: number): RouteCoordinate[] {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((CENTER.latitude * Math.PI) / 180);
  const at = (radiusM: number, steps = 720) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * 2 * Math.PI;
      const r = radiusM * (1 + 0.18 * Math.sin(3 * a) + 0.1 * Math.cos(2 * a));
      return {
        latitude: CENTER.latitude + (r * Math.sin(a)) / METERS_PER_DEG_LAT,
        longitude: CENTER.longitude + (r * Math.cos(a)) / metersPerDegLng,
      };
    });
  const lengthKm = (line: RouteCoordinate[]) =>
    line.slice(1).reduce((sum, p, i) => {
      const q = line[i];
      const dLat = (p.latitude - q.latitude) * METERS_PER_DEG_LAT;
      const dLng = (p.longitude - q.longitude) * metersPerDegLng;
      return sum + Math.hypot(dLat, dLng) / 1000;
    }, 0);
  // Length is linear in the radius, so one measurement scales it exactly.
  return at((1000 * totalKm) / lengthKm(at(1000)));
}

/** Walks the loop at the mock paces and records a fix every few seconds. */
function simulateRun(startedAt: number): {
  points: SplitPoint[];
  distanceKm: number;
  durationSeconds: number;
} {
  const loop = buildLoop(TOTAL_KM);
  const cumulative = [0];
  loop.slice(1).forEach((p, i) => {
    const q = loop[i];
    const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((q.latitude * Math.PI) / 180);
    cumulative.push(
      cumulative[i] +
        Math.hypot(
          (p.latitude - q.latitude) * METERS_PER_DEG_LAT,
          (p.longitude - q.longitude) * metersPerDegLng,
        ) / 1000,
    );
  });
  const length = cumulative[cumulative.length - 1];

  const locate = (km: number): RouteCoordinate => {
    let i = cumulative.findIndex((c) => c >= km);
    if (i <= 0) i = 1;
    const share = (km - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1]);
    return {
      latitude: loop[i - 1].latitude + share * (loop[i].latitude - loop[i - 1].latitude),
      longitude: loop[i - 1].longitude + share * (loop[i].longitude - loop[i - 1].longitude),
    };
  };
  const fix = (km: number, ms: number): SplitPoint => ({
    timestamp: ms,
    coords: { ...locate(km), altitude: 12 },
  });
  const marker = (ms: number): SplitPoint => ({
    timestamp: ms,
    coords: { latitude: 0, longitude: 0, altitude: -9999 },
  });

  const points: SplitPoint[] = [fix(0, startedAt)];
  let km = 0;
  let ms = startedAt;
  let movingSeconds = 0;
  let paused = false;
  while (km < length - 0.005) {
    const pace = KM_PACES[Math.min(Math.floor(km), KM_PACES.length - 1)];
    km = Math.min(length, km + SAMPLE_EVERY_S / pace);
    ms += SAMPLE_EVERY_S * 1000;
    movingSeconds += SAMPLE_EVERY_S;
    points.push(fix(km, ms));
    if (!paused && km >= PAUSE_AT_KM) {
      paused = true;
      points.push(marker(ms));
      ms += PAUSE_SECONDS * 1000;
      points.push(marker(ms));
    }
  }
  return { points, distanceKm: km, durationSeconds: movingSeconds };
}

const startedAt = Date.now() - 3 * 60 * 60 * 1000;
const simulated = simulateRun(startedAt);

/** A full run: route, six splits (the last one partial), calories. */
export const mockLongRun: RunResultsParams = {
  distanceKm: simulated.distanceKm,
  durationSeconds: simulated.durationSeconds,
  route: simulated.points
    .filter((p) => p.coords.altitude !== -9999)
    .map(({ coords }) => ({ latitude: coords.latitude, longitude: coords.longitude })),
  startedAt,
  calories: Math.floor(simulated.distanceKm * 65),
  splits: computeSplits(simulated.points),
};

/** The same run as a goal run: some goals met, some missed. */
export const mockGoalRun: RunResultsParams = {
  ...mockLongRun,
  goal: { distanceMeters: 5000, durationSeconds: 27 * 60, paceSecPerKm: 325 },
};

/** Finished right after starting. */
export const mockShortRun: RunResultsParams = {
  distanceKm: 0.02,
  durationSeconds: 7,
  route: [],
  startedAt,
  calories: 1,
  splits: [],
};

/** A real distance but no GPS route, so no map and no splits. */
export const mockNoRouteRun: RunResultsParams = {
  distanceKm: 3.2,
  durationSeconds: 1000,
  route: [],
  startedAt,
  calories: 208,
  splits: [],
};

/** An interval session as planned: 1 km warm-up, 6 × 400 m fast, 1 km cool-down. */
const mockWorkout: Workout = {
  id: 'w-mock',
  date: '2026-10-01',
  type: 'intervals',
  status: 'planned',
  segments: [
    { id: 'wu', kind: 'warmup', target: { type: 'distance', meters: 1000 }, pace: null },
    {
      id: 'g',
      repeat: 6,
      steps: [
        { id: 'w', kind: 'work', target: { type: 'distance', meters: 400 }, pace: { min: 285, max: 305 } },
        { id: 'r', kind: 'recovery', target: { type: 'duration', seconds: 90 }, pace: null },
      ],
    },
    { id: 'cd', kind: 'cooldown', target: { type: 'distance', meters: 1000 }, pace: null },
  ],
};

/** The long run as a finished plan workout: planned vs actual. */
export const mockPlanRun: RunResultsParams = {
  ...mockLongRun,
  planned: { workout: mockWorkout, partial: false },
};

/** The same, cut short: only part of the session was run. */
export const mockPartialPlanRun: RunResultsParams = {
  ...mockNoRouteRun,
  planned: { workout: mockWorkout, partial: true },
};
