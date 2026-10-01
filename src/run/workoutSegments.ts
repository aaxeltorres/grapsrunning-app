/**
 * A plan workout as the ordered list of segments a run executes. Pure
 * logic (no React), built on the Workout model in coach/plan.ts: repeat
 * groups are unrolled, and each segment keeps its step's id, kind and
 * target, so nothing here is a second workout model.
 */

import {
  formatDistanceShort,
  formatDurationShort,
  isRepeatGroup,
  isRunWalk,
  stepDuration,
  type Pace,
  type StepKind,
  type StepTarget,
  type Workout,
  type WorkoutStep,
} from '../coach/plan';
import { PACE_TOLERANCE_S_PER_KM } from './goalConfig';

/** Color family of a segment on the run screen. */
export type SegmentTone = 'fast' | 'recovery' | 'easy' | 'long' | 'warm';

/** Seconds per km; `min` is the faster end. */
export type PaceRange = { min: number; max: number };

export type RunSegment = {
  /** Position in the run, from 0. */
  index: number;
  stepId: string;
  kind: StepKind;
  target: StepTarget;
  /** `null` when the step has no pace target (walks, free jogs). */
  paceRange: PaceRange | null;
  /** Inside a repeat group: "Rep 3 of 9". */
  rep: { number: number; of: number } | null;
  /** For the proportional workout bar. */
  estimatedSeconds: number;
  label: string;
  tone: SegmentTone;
};

/** A single target pace counts as on target within the shared tolerance. */
export function toPaceRange(pace: Pace | null): PaceRange | null {
  if (pace === null) return null;
  return typeof pace === 'number'
    ? { min: pace - PACE_TOLERANCE_S_PER_KM, max: pace + PACE_TOLERANCE_S_PER_KM }
    : { min: pace.min, max: pace.max };
}

function describe(
  step: WorkoutStep,
  workout: Pick<Workout, 'type' | 'segments'>,
): { label: string; tone: SegmentTone } {
  const runWalk = isRunWalk(workout);
  switch (step.kind) {
    case 'warmup':
      return { label: 'Warm-up', tone: 'warm' };
    case 'cooldown':
      return { label: 'Cool-down', tone: 'warm' };
    case 'work':
      return { label: 'Fast rep', tone: 'fast' };
    case 'recovery':
      return runWalk
        ? { label: 'Walk', tone: 'recovery' }
        : { label: 'Recovery', tone: 'recovery' };
    case 'steady':
      if (runWalk) return { label: 'Run', tone: workout.type === 'long' ? 'long' : 'easy' };
      if (workout.type === 'long') return { label: 'Long run', tone: 'long' };
      return { label: 'Easy run', tone: 'easy' };
  }
}

/** Every segment of the workout, in order. Empty on rest days. */
export function buildRunSegments(
  workout: Pick<Workout, 'type' | 'segments'>,
): RunSegment[] {
  const out: RunSegment[] = [];
  const push = (step: WorkoutStep, rep: RunSegment['rep']) =>
    out.push({
      index: out.length,
      stepId: step.id,
      kind: step.kind,
      target: step.target,
      paceRange: toPaceRange(step.pace),
      rep,
      estimatedSeconds: stepDuration(step),
      ...describe(step, workout),
    });

  for (const segment of workout.segments) {
    if (!isRepeatGroup(segment)) {
      push(segment, null);
      continue;
    }
    for (let n = 1; n <= segment.repeat; n++) {
      for (const step of segment.steps) push(step, { number: n, of: segment.repeat });
    }
  }
  return out;
}

/** "400 m", "90 s", "5 min" */
export function formatSegmentTarget(segment: RunSegment): string {
  return segment.target.type === 'distance'
    ? formatDistanceShort(segment.target.meters)
    : formatDurationShort(segment.target.seconds);
}
