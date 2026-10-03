/**
 * Dev-only sample runs for the Stats screen. Nothing outside `__DEV__`
 * may import this file: StatsScreen requires it behind `__DEV__`, so
 * release and preview bundles never contain it.
 *
 * Use: long-press the "Stats" title (or the "Dev: sample runs" link of the
 * empty state) and pick "Add sample runs" or "Remove sample runs".
 */

import type { Workout } from '../coach/plan';
import type { RouteCoordinate } from '../navigation/types';
import type { RunGoal } from '../run/goals';
import { buildWorkoutResult } from '../run/planResult';
import type { RunModeId } from '../run/runModes';
import { buildSavedRun } from '../run/savedRun';
import type { Split } from '../run/splits';
import type { SavedRun } from '../run/types';
import { runHistoryStorage } from '../storage/runHistoryStorage';
import { mockLongRun, mockPlanRun } from '../utils/mockRun';

/** Ids of sample runs start with this, so removing them never touches real runs. */
const SAMPLE_ID_PREFIX = 'dev-sample-run-';

type RouteKind = 'loop' | 'none' | 'still';

type Sample = {
  daysAgo: number;
  hour: number;
  minute: number;
  distanceKm: number;
  durationSec: number;
  mode: RunModeId;
  route: RouteKind;
  goal?: RunGoal;
  /** A finished plan workout (the mock interval session), cut short or not. */
  plan?: { workout: Workout; partial: boolean };
};

const PLAN_WORKOUT = mockPlanRun.planned?.workout;
const LONG_RUN_KM = mockLongRun.distanceKm;

const SAMPLES: Sample[] = [
  // The mock 5.3 km loop with its real splits.
  { daysAgo: 1, hour: 7, minute: 42, distanceKm: LONG_RUN_KM, durationSec: mockLongRun.durationSeconds, mode: 'quick', route: 'loop' },
  {
    daysAgo: 3, hour: 18, minute: 5, distanceKm: 8.2, durationSec: 2650, mode: 'goal', route: 'loop',
    goal: { distanceMeters: 8000, durationSeconds: 45 * 60, paceSecPerKm: 330 },
  },
  // No route at all.
  { daysAgo: 5, hour: 6, minute: 30, distanceKm: 3.2, durationSec: 1050, mode: 'quick', route: 'none' },
  ...(PLAN_WORKOUT
    ? [{ daysAgo: 8, hour: 7, minute: 15, distanceKm: 4.6, durationSec: 1690, mode: 'plan', route: 'loop', plan: { workout: PLAN_WORKOUT, partial: false } } as Sample]
    : []),
  { daysAgo: 12, hour: 19, minute: 20, distanceKm: 10.4, durationSec: 3520, mode: 'quick', route: 'loop' },
  // Two identical points: a route that is not worth a map.
  { daysAgo: 19, hour: 8, minute: 0, distanceKm: 2.1, durationSec: 760, mode: 'intervals', route: 'still' },
  // The previous month, so the list shows two groups.
  { daysAgo: 33, hour: 6, minute: 50, distanceKm: 12.4, durationSec: 4325, mode: 'quick', route: 'loop' },
  {
    daysAgo: 41, hour: 7, minute: 30, distanceKm: 5.0, durationSec: 1650, mode: 'goal', route: 'loop',
    goal: { durationSeconds: 27 * 60, paceSecPerKm: 330 },
  },
  { daysAgo: 70, hour: 17, minute: 45, distanceKm: 7.5, durationSec: 2480, mode: 'quick', route: 'loop' },
];

/** The first part of the mock loop that matches the distance (the whole loop past 5.3 km). */
function routeFor(sample: Sample): RouteCoordinate[] {
  if (sample.route === 'none') return [];
  if (sample.route === 'still') {
    const point = mockLongRun.route[0];
    return [point, { ...point }];
  }
  const share = Math.min(1, sample.distanceKm / LONG_RUN_KM);
  return mockLongRun.route.slice(0, Math.max(2, Math.ceil(mockLongRun.route.length * share)));
}

/** Even-ish splits around the average pace, with a little variation. */
function splitsFor(sample: Sample): Split[] {
  if (sample.distanceKm === LONG_RUN_KM) return mockLongRun.splits ?? [];
  const avgPace = sample.durationSec / sample.distanceKm;
  const fullKm = Math.floor(sample.distanceKm);
  const splits: Split[] = Array.from({ length: fullKm }, (_, i) => ({
    index: i + 1,
    distanceKm: 1,
    seconds: Math.round(avgPace * (1 + 0.04 * Math.sin(i * 1.7))),
    partial: false,
  }));
  const rest = sample.distanceKm - fullKm;
  if (rest >= 0.1) {
    splits.push({
      index: fullKm + 1,
      distanceKm: rest,
      seconds: Math.round(avgPace * rest),
      partial: true,
    });
  }
  return splits;
}

function buildSample(sample: Sample, index: number): SavedRun {
  const started = new Date();
  started.setDate(started.getDate() - sample.daysAgo);
  started.setHours(sample.hour, sample.minute, 0, 0);
  const startedAt = started.getTime();

  const planned = sample.plan && {
    ...sample.plan,
    result: buildWorkoutResult({
      distanceKm: sample.distanceKm,
      durationSeconds: sample.durationSec,
      startedAt,
    }),
  };

  const run = buildSavedRun({
    distanceKm: sample.distanceKm,
    durationSeconds: sample.durationSec,
    startedAt,
    calories: Math.floor(sample.distanceKm * 65),
    route: routeFor(sample),
    splits: splitsFor(sample),
    mode: sample.mode,
    goal: sample.goal,
    planned,
  });
  // A fixed id per sample, so adding them again replaces them.
  return { ...run, id: `${SAMPLE_ID_PREFIX}${index}` };
}

export async function seedSampleRuns(): Promise<void> {
  for (const [index, sample] of SAMPLES.entries()) {
    await runHistoryStorage.saveRun(buildSample(sample, index));
  }
}

export async function clearSampleRuns(): Promise<void> {
  const runs = await runHistoryStorage.loadRuns();
  for (const run of runs) {
    if (run.id.startsWith(SAMPLE_ID_PREFIX)) await runHistoryStorage.deleteRun(run.id);
  }
}
