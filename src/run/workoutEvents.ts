/**
 * Events a workout run emits, and a tiny bus to listen to them. The run
 * screen uses them for haptics; a coaching layer (Mike's voice) can
 * subscribe later without touching the engine.
 */

import type { RunSegment } from './workoutSegments';

/** Where the run was: moving time (pauses excluded) and distance. */
export type WorkoutSample = { movingSeconds: number; distanceKm: number };

/**
 * `completed`: its duration or distance was reached. `done` / `ready`: a
 * manual step ended by the runner's tap. `skipped`: Skip. `finished`: the
 * run ended early with Finish.
 */
export type SegmentEndReason = 'completed' | 'done' | 'ready' | 'skipped' | 'finished';

export type WorkoutEvent =
  /** The segment carries its zone, rep / set counters and how it ends. */
  | { type: 'segmentStart'; segment: RunSegment; at: WorkoutSample }
  | {
      type: 'segmentEnd';
      segment: RunSegment;
      reason: SegmentEndReason;
      at: WorkoutSample;
    }
  /** Kilometer `km` done, in `seconds` of moving time. */
  | { type: 'kmSplit'; km: number; seconds: number; at: WorkoutSample }
  /** The run went past the last segment (completed or skipped, not ended early). */
  | { type: 'workoutComplete'; at: WorkoutSample };

export type WorkoutEventListener = (event: WorkoutEvent) => void;

export type WorkoutEventBus = {
  emit: (event: WorkoutEvent) => void;
  /** Returns the unsubscribe function. */
  subscribe: (listener: WorkoutEventListener) => () => void;
};

export function createWorkoutEventBus(): WorkoutEventBus {
  const listeners = new Set<WorkoutEventListener>();
  return {
    emit: (event) => listeners.forEach((listener) => listener(event)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
