import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunState } from './useRunTracking';
import {
  alertFlags,
  createAlertState,
  updateAlerts,
  type AlertFlags,
  type AlertTargets,
} from '../run/goalAlerts';
import type { RunGoal } from '../run/goals';

type Result = AlertFlags & {
  /** Smoothed current pace (s/km) used by the alerts, `null` until known. */
  currentPace: number | null;
};

/**
 * Feeds the goal alert state machine one sample per tracking tick while
 * the run is moving. Re-renders only when an alert or the pace changes.
 */
export function useGoalAlerts(
  goal: RunGoal,
  runState: RunState,
  distanceKm: number,
  durationSeconds: number,
): Result {
  const stateRef = useRef(createAlertState());
  const [result, setResult] = useState<Result>({
    pace: false,
    finish: false,
    currentPace: null,
  });

  const targets = useMemo<AlertTargets>(
    () => ({
      paceSecPerKm: goal.paceSecPerKm,
      finish:
        goal.distanceMeters !== undefined && goal.durationSeconds !== undefined
          ? { distanceKm: goal.distanceMeters / 1000, seconds: goal.durationSeconds }
          : undefined,
    }),
    [goal.paceSecPerKm, goal.distanceMeters, goal.durationSeconds],
  );

  // The tracking clock ticks once a second while running; pauses don't
  // count, so samples stay on moving time.
  useEffect(() => {
    if (runState !== 'running') return;
    const next = updateAlerts(
      stateRef.current,
      { movingSeconds: durationSeconds, distanceKm },
      targets,
    );
    stateRef.current = next;
    const flags = alertFlags(next);
    const currentPace =
      next.currentPace === null ? null : Math.round(next.currentPace);
    setResult((prev) =>
      prev.pace === flags.pace &&
      prev.finish === flags.finish &&
      prev.currentPace === currentPace
        ? prev
        : { ...flags, currentPace },
    );
    // Sample on clock ticks only; distance is read as of that tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSeconds, runState, targets]);

  return result;
}
