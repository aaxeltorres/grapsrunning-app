import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunState } from './useRunTracking';
import type { RepResult } from '../coach/plan';
import {
  confirmSegment,
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
import { countdownTicks, segmentAlertTargets } from '../run/stepBehavior';
import { createRepRecorder, recordEvent } from '../run/repResults';
import type { RunSegment } from '../run/workoutSegments';
import {
  countdownHaptic,
  mediumImpact,
  restStartHaptic,
  successNotification,
  workStartHaptic,
} from '../utils/haptics';

type Result = {
  segment: RunSegment | null;
  next: RunSegment | null;
  progress: SegmentProgress;
  /** Every segment is done (completed or skipped). */
  complete: boolean;
  /** The current segment's pace is off its target (see stepBehavior.ts). */
  paceAlert: boolean;
  /** The work steps run so far (for the macro rest's set summary). */
  reps: RepResult[];
  skip: () => void;
  /** Done or Ready tapped on a manual segment. */
  confirm: () => void;
  /**
   * Read it before `finishEarly`: whether every segment was run, none
   * skipped. Anything else is a partial workout.
   */
  outcome: () => WorkoutOutcome;
  /** Call before leaving the run with Finish. */
  finishEarly: () => void;
  /** Every work step recorded, including the one Finish cut short. */
  recordedReps: () => RepResult[];
  events: WorkoutEventBus;
};

export type WorkoutOutcome = { completedAll: boolean };

/**
 * Runs a workout on the tracking ticks: starts the engine once tracking
 * runs, advances it on every clock or distance update while running, keeps
 * the current segment's pace alert (by its zone and length), records every
 * work step and plays the step haptics: a firm one when a rep starts, a
 * soft one when a rest starts and a 3, 2, 1 before a timed rep. Everything
 * runs on moving time, so a pause freezes it all. Events go to `events`.
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
  const skippedRef = useRef(0);
  const recorderRef = useRef(createRepRecorder());
  const [reps, setReps] = useState<RepResult[]>([]);
  // Time left in the current segment at the last tick, for the 3, 2, 1.
  const countdownRef = useRef<{ index: number; remaining: number } | null>(null);

  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type === 'segmentEnd' && event.reason === 'skipped') {
          skippedRef.current += 1;
        }
        const recorded = recordEvent(recorderRef.current, event);
        if (recorded.reps !== recorderRef.current.reps) setReps(recorded.reps);
        recorderRef.current = recorded;

        if (event.type === 'segmentStart' && event.segment.index > 0) {
          if (event.segment.kind === 'work') workStartHaptic();
          else if (event.segment.rest !== null) restStartHaptic();
          else mediumImpact();
        }
        if (event.type === 'workoutComplete') successNotification();
      }),
    [events],
  );

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

    // 3, 2, 1 before a timed rep, from the time left in this segment.
    const remaining = segmentProgress(state, sample).remaining;
    const last = countdownRef.current;
    if (segment && last && last.index === segment.index) {
      if (countdownTicks(segment, nextSegment(state), last.remaining, remaining).length > 0) {
        countdownHaptic();
      }
    }
    countdownRef.current = segment ? { index: segment.index, remaining } : null;

    const targets = segment ? segmentAlertTargets(segment) : null;
    if (!targets) return;
    alertRef.current = updateAlerts(alertRef.current, segmentSample(state, sample), targets);
    const flag = alertFlags(alertRef.current).pace;
    setPaceAlert((prev) => (prev === flag ? prev : flag));
    // Samples on tracking updates only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSeconds, distanceKm, runState]);

  const skip = useCallback(() => {
    if (engineRef.current) apply(skipSegment(engineRef.current, sampleRef.current));
  }, [apply]);

  const confirm = useCallback(() => {
    if (engineRef.current) apply(confirmSegment(engineRef.current, sampleRef.current));
  }, [apply]);

  const outcome = useCallback(
    (): WorkoutOutcome => ({
      completedAll:
        engineRef.current !== null &&
        isComplete(engineRef.current) &&
        skippedRef.current === 0,
    }),
    [],
  );

  const finishEarly = useCallback(() => {
    if (engineRef.current) apply(finishEngine(engineRef.current, sampleRef.current));
  }, [apply]);

  const recordedReps = useCallback(() => recorderRef.current.reps, []);

  const engine = engineRef.current;
  return {
    segment: engine ? currentSegment(engine) : segments[0] ?? null,
    next: engine ? nextSegment(engine) : segments[1] ?? null,
    progress: engine
      ? segmentProgress(engine, sample)
      : {
          remaining: initialAmount(segments[0]),
          fractionLeft: 1,
          overall: 0,
          elapsedSeconds: 0,
        },
    complete: engine ? isComplete(engine) : segments.length === 0,
    paceAlert,
    reps,
    skip,
    confirm,
    outcome,
    finishEarly,
    recordedReps,
    events,
  };
}

function initialAmount(segment: RunSegment | undefined) {
  if (!segment) return 0;
  const { target } = segment;
  if (target.type === 'manual') return 0;
  return target.type === 'duration' ? target.seconds : target.meters;
}
