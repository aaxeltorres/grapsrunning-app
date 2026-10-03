import type { Animated } from 'react-native';
import type { RunState } from '../hooks/useRunTracking';
import type { RunGoal } from './goals';
import type { RepResult, Workout, WorkoutResult } from '../coach/plan';
import type { RouteCoordinate } from '../navigation/types';
import type { RunModeId } from './runModes';
import type { Split } from './splits';

/**
 * What the ActiveRun shell hands to every run view. The shell owns the
 * tracking; the views only draw it and report what the user pressed.
 */
export type RunViewProps = {
  runState: RunState;
  distanceKm: number;
  durationSeconds: number;
  paceLabel: string;
  calories: number;
  /** Theme progress (0 = light, 1 = dark) shared with the shell's background. */
  themeAnim: Animated.Value;
  /** Goal runs only: the goals set on the setup screen. */
  goal?: RunGoal;
  /** Plan workout runs only: the workout to execute, as stored (edits included). */
  workout?: Workout;
  /** Replaces the workout's own name on the run screen (e.g. "Intervals"). */
  title?: string;
  onPause: () => void;
  onResume: () => void;
  /**
   * Plan workout runs say whether every segment was run (otherwise it's
   * partial) and hand over every work step as it was run.
   */
  onFinish: (summary?: { completedAll: boolean; reps?: RepResult[] }) => void;
};

/** Bump when the shape of a saved run changes in a way old data can't satisfy. */
export const SAVED_RUN_SCHEMA_VERSION = 1;

/**
 * A finished run kept in the run history. Only runs that pass
 * `isRunSaveable` are stored. Plain JSON, so it can move to a database.
 */
export type SavedRun = {
  schemaVersion: typeof SAVED_RUN_SCHEMA_VERSION;
  /** Stable per run (from its start), so saving twice never duplicates it. */
  id: string;
  /** When the run started: an ISO timestamp, shown in the runner's local time. */
  startedAt: string;
  /** Moving time: paused time is not counted. */
  movingDurationSec: number;
  distanceMeters: number;
  /** Seconds per km, `null` when there is too little data for a pace. */
  avgPaceSecPerKm: number | null;
  calories?: number;
  /** Downsampled to a few hundred points, first and last kept. */
  route: RouteCoordinate[];
  /** Per-kilometer splits, empty when there is no complete kilometer. */
  splits: Split[];
  mode: RunModeId;
  goal?: RunGoal;
  /** Plan workout runs only: what was planned and what came out of it. */
  planned?: {
    workoutId: string;
    title: string;
    plannedDistanceMeters: number;
    plannedDurationSeconds: number;
    partial: boolean;
    result?: WorkoutResult;
  };
  /** Workouts with reps (plan or intervals): every work step as it was run. */
  reps?: RepResult[];
};
