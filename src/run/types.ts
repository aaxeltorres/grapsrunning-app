import type { Animated } from 'react-native';
import type { RunState } from '../hooks/useRunTracking';
import type { RunGoal } from './goals';
import type { Workout } from '../coach/plan';

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
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
};
