/**
 * Runs a workout segment by segment. Pure logic (no React, no timers): fed
 * one sample per tracking tick, it advances segments by time or distance
 * and returns the events that happened. Samples are on moving time, so a
 * pause (no samples, frozen clock) simply freezes the current segment.
 * Manual segments (a short sprint, a full recovery) never end on their
 * own: `confirmSegment` ends them when the runner taps Done or Ready.
 */

import type { RunSegment } from './workoutSegments';
import type {
  SegmentEndReason,
  WorkoutEvent,
  WorkoutSample,
} from './workoutEvents';

export type EngineState = {
  segments: RunSegment[];
  /** Current segment; `segments.length` once the workout is done. */
  index: number;
  /** Where the current segment started. */
  segmentStart: WorkoutSample;
  /** Whole kilometers already reported, and when the last one ended. */
  splitKm: number;
  splitSeconds: number;
  /** The previous sample, to place segment ends between two ticks. */
  lastSample: WorkoutSample;
  /** Ended early with Finish; nothing happens after that. */
  finished: boolean;
};

export type EngineStep = { state: EngineState; events: WorkoutEvent[] };

export function isComplete(state: EngineState) {
  return state.index >= state.segments.length;
}

export function currentSegment(state: EngineState): RunSegment | null {
  return state.segments[state.index] ?? null;
}

export function nextSegment(state: EngineState): RunSegment | null {
  return state.segments[state.index + 1] ?? null;
}

/** Moves to the following segment from `at`, with its events. */
function moveOn(
  state: EngineState,
  reason: SegmentEndReason,
  at: WorkoutSample,
  events: WorkoutEvent[],
): EngineState {
  const ended = state.segments[state.index];
  events.push({ type: 'segmentEnd', segment: ended, reason, at });
  const next: EngineState = { ...state, index: state.index + 1, segmentStart: at };
  const upcoming = next.segments[next.index];
  events.push(
    upcoming
      ? { type: 'segmentStart', segment: upcoming, at }
      : { type: 'workoutComplete', at },
  );
  return next;
}

export function startEngine(segments: RunSegment[], sample: WorkoutSample): EngineStep {
  const state: EngineState = {
    segments,
    index: 0,
    segmentStart: sample,
    splitKm: Math.floor(sample.distanceKm),
    splitSeconds: sample.movingSeconds,
    lastSample: sample,
    finished: false,
  };
  const first = segments[0];
  return {
    state,
    events: first ? [{ type: 'segmentStart', segment: first, at: sample }] : [],
  };
}

/** Linear position between two samples, `share` from 0 (`a`) to 1 (`b`). */
function between(a: WorkoutSample, b: WorkoutSample, share: number): WorkoutSample {
  const s = Math.min(1, Math.max(0, share));
  return {
    movingSeconds: a.movingSeconds + s * (b.movingSeconds - a.movingSeconds),
    distanceKm: a.distanceKm + s * (b.distanceKm - a.distanceKm),
  };
}

/**
 * Where the current segment ends if `sample` has reached it, else null.
 * The end is placed between the previous sample and this one, so a tick
 * that crosses several segments hands each one over at the right point.
 */
function segmentEnd(state: EngineState, sample: WorkoutSample): WorkoutSample | null {
  const segment = state.segments[state.index];
  if (segment.target.type === 'manual') return null;
  const start = state.segmentStart;
  // The segment may have started after the previous sample.
  const from =
    start.movingSeconds > state.lastSample.movingSeconds ? start : state.lastSample;
  if (segment.target.type === 'duration') {
    const end = start.movingSeconds + segment.target.seconds;
    if (sample.movingSeconds < end) return null;
    const span = sample.movingSeconds - from.movingSeconds;
    const at = between(from, sample, span > 0 ? (end - from.movingSeconds) / span : 1);
    return { movingSeconds: end, distanceKm: at.distanceKm };
  }
  const endKm = start.distanceKm + segment.target.meters / 1000;
  if (sample.distanceKm < endKm) return null;
  const span = sample.distanceKm - from.distanceKm;
  const at = between(from, sample, span > 0 ? (endKm - from.distanceKm) / span : 1);
  return { movingSeconds: at.movingSeconds, distanceKm: endKm };
}

/** One tracking tick: km splits, then as many segments as were reached. */
export function tickEngine(state: EngineState, sample: WorkoutSample): EngineStep {
  const events: WorkoutEvent[] = [];
  if (state.finished) return { state, events };

  let next = state;
  while (sample.distanceKm >= next.splitKm + 1) {
    events.push({
      type: 'kmSplit',
      km: next.splitKm + 1,
      seconds: sample.movingSeconds - next.splitSeconds,
      at: sample,
    });
    next = { ...next, splitKm: next.splitKm + 1, splitSeconds: sample.movingSeconds };
  }

  while (!isComplete(next)) {
    const end = segmentEnd(next, sample);
    if (!end) break;
    next = moveOn(next, 'completed', end, events);
  }
  return { state: { ...next, lastSample: sample }, events };
}

/**
 * Done or Ready tapped: ends the current manual segment and starts the
 * next one. Does nothing on a segment that ends by itself.
 */
export function confirmSegment(state: EngineState, sample: WorkoutSample): EngineStep {
  const events: WorkoutEvent[] = [];
  const segment = currentSegment(state);
  if (state.finished || !segment || segment.end === 'auto') return { state, events };
  return {
    state: { ...moveOn(state, segment.end, sample, events), lastSample: sample },
    events,
  };
}

/** Ends the current segment now and starts the next one. */
export function skipSegment(state: EngineState, sample: WorkoutSample): EngineStep {
  const events: WorkoutEvent[] = [];
  if (state.finished || isComplete(state)) return { state, events };
  return {
    state: { ...moveOn(state, 'skipped', sample, events), lastSample: sample },
    events,
  };
}

/** Finish pressed: ends the current segment early, if one is running. */
export function finishEngine(state: EngineState, sample: WorkoutSample): EngineStep {
  if (state.finished) return { state, events: [] };
  const events: WorkoutEvent[] = [];
  const segment = currentSegment(state);
  if (segment) events.push({ type: 'segmentEnd', segment, reason: 'finished', at: sample });
  return { state: { ...state, finished: true }, events };
}

export type SegmentProgress = {
  /**
   * Seconds or meters left in the current segment (0 when done). A manual
   * segment has no end to count down to: 0.
   */
  remaining: number;
  /** Share of the current segment left, 1 to 0. A manual segment stays at 1. */
  fractionLeft: number;
  /** Position in the whole workout by estimated time, 0 to 1. */
  overall: number;
};

export function segmentProgress(state: EngineState, sample: WorkoutSample): SegmentProgress {
  const segment = currentSegment(state);
  if (!segment) return { remaining: 0, fractionLeft: 0, overall: 1 };

  const start = state.segmentStart;
  const { target } = segment;
  let remaining = 0;
  let fractionLeft = 1;
  if (target.type !== 'manual') {
    const total = target.type === 'duration' ? target.seconds : target.meters;
    const done =
      target.type === 'duration'
        ? sample.movingSeconds - start.movingSeconds
        : (sample.distanceKm - start.distanceKm) * 1000;
    remaining = Math.min(total, Math.max(0, total - done));
    fractionLeft = total > 0 ? remaining / total : 0;
  }

  const estimates = state.segments.map((s) => s.estimatedSeconds);
  const workoutTotal = estimates.reduce((sum, s) => sum + s, 0);
  const before = estimates.slice(0, state.index).reduce((sum, s) => sum + s, 0);
  const overall =
    workoutTotal > 0
      ? (before + (1 - fractionLeft) * segment.estimatedSeconds) / workoutTotal
      : 0;
  return { remaining, fractionLeft, overall };
}

/** The sample relative to the current segment's start (for its alerts). */
export function segmentSample(state: EngineState, sample: WorkoutSample): WorkoutSample {
  return {
    movingSeconds: sample.movingSeconds - state.segmentStart.movingSeconds,
    distanceKm: sample.distanceKm - state.segmentStart.distanceKm,
  };
}
