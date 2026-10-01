import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunState } from './useRunTracking';
import {
  currentSegment,
  finishEngine,
  isComplete,
  nextSegment,
  segmentProgress,
  segmentSample,
  skipSegment,
  startEngine,
  tickEngine,
  type EngineState,
  type EngineStep,
  type SegmentProgress,
} from '../run/workoutEngine';
import {
  createWorkoutEventBus,
  type WorkoutEventBus,
  type WorkoutSample,
} from '../run/workoutEvents';
import { alertFlags, createAlertState, updateAlerts } from '../run/goalAlerts';
import { SEGMENT_ALERT_GRACE_KM, SEGMENT_ALERT_GRACE_S } from '../run/workoutConfig';
import type { RunSegment } from '../run/workoutSegments';

type Result = {
  segment: RunSegment | null;
  next: RunSegment | null;
  progress: SegmentProgress;
  /** Every segment is done (completed or skipped). */
  complete: boolean;
  /** The current segment's pace is off its target range. */
  paceAlert: boolean;
  skip: () => void;
  /** Call before leaving the run with Finish. */
  finishEarly: () => void;
  events: WorkoutEventBus;
};

/**
 * Runs a workout on the tracking ticks: starts the engine once tracking
 * runs, advances it on every clock or distance update while running, and
 * keeps the current segment's pace alert. Events go to `events`.
 */
export function useWorkoutRun(
  segments: RunSegment[],
  runState: RunState,
  distanceKm: number,
  durationSeconds: number,
): Result {
  const events = useRef(createWorkoutEventBus()).current;
  const engineRef = useRef<EngineState | null>(null);
  const alertRef = useRef(createAlertState());
  // Re-renders the view when the engine moves to another segment.
  const [, setSegmentIndex] = useState(0);
  const [paceAlert, setPaceAlert] = useState(false);

  const sample: WorkoutSample = { movingSeconds: durationSeconds, distanceKm };
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  // Applies an engine step: publishes its events and, on a new segment,
  // restarts the pace alert so the last segment's pace never leaks in.
  const apply = useCallback(
    (step: EngineStep) => {
      engineRef.current = step.state;
      step.events.forEach(events.emit);
      if (step.events.some((e) => e.type === 'segmentStart' || e.type === 'workoutComplete')) {
        alertRef.current = createAlertState();
        setPaceAlert(false);
      }
      setSegmentIndex(step.state.index);
    },
    [events],
  );

  useEffect(() => {
    if (runState !== 'running') return;
    const engine = engineRef.current;
    if (!engine) {
      apply(startEngine(segments, sample));
      return;
    }
    apply(tickEngine(engine, sample));

    const state = engineRef.current!;
    const segment = currentSegment(state);
    if (!segment?.paceRange) return;
    alertRef.current = updateAlerts(alertRef.current, segmentSample(state, sample), {
      paceRange: segment.paceRange,
      grace: { seconds: SEGMENT_ALERT_GRACE_S, km: SEGMENT_ALERT_GRACE_KM },
    });
    const flag = alertFlags(alertRef.current).pace;
    setPaceAlert((prev) => (prev === flag ? prev : flag));
    // Samples on tracking updates only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSeconds, distanceKm, runState]);

  const skip = useCallback(() => {
    if (engineRef.current) apply(skipSegment(engineRef.current, sampleRef.current));
  }, [apply]);

  const finishEarly = useCallback(() => {
    if (engineRef.current) apply(finishEngine(engineRef.current, sampleRef.current));
  }, [apply]);

  const engine = engineRef.current;
  return {
    segment: engine ? currentSegment(engine) : segments[0] ?? null,
    next: engine ? nextSegment(engine) : segments[1] ?? null,
    progress: engine
      ? segmentProgress(engine, sample)
      : { remaining: initialAmount(segments[0]), fractionLeft: 1, overall: 0 },
    complete: engine ? isComplete(engine) : segments.length === 0,
    paceAlert,
    skip,
    finishEarly,
    events,
  };
}

function initialAmount(segment: RunSegment | undefined) {
  if (!segment) return 0;
  return segment.target.type === 'duration' ? segment.target.seconds : segment.target.meters;
}
