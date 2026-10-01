import type { Animated } from 'react-native';
import type { RunState } from '../hooks/useRunTracking';

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
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
};
