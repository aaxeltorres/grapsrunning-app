/**
 * A plan workout as the ordered list of segments a run executes. Pure
 * logic (no React), built on the Workout model in coach/plan.ts: repeat
 * groups and sets are unrolled (by `unrollSegments`, the same unrolling
 * the totals use), and each segment keeps its step's id, kind, target and
 * zone, so nothing here is a second workout model.
 */

import {
  formatDistanceShort,
  formatDurationShort,
  isRest,
  isRunWalk,
  manualEndLabel,
  stepDuration,
  unrollSegments,
  type Counter,
  type Pace,
  type StepKind,
  type StepTarget,
  type Workout,
  type WorkoutStep,
  type Zone,
} from '../coach/plan';
import { PACE_TOLERANCE_S_PER_KM } from './goalConfig';
import { MIN_MEASURED_DISTANCE_M, MIN_PACED_EFFORT_S } from './workoutConfig';

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
  /**
   * `null` when the step has no pace target (walks, free jogs) or is too
   * short for GPS to measure one (see workoutConfig.ts).
   */
  paceRange: PaceRange | null;
  /** Inside a repeat group: "Rep 3 of 9". */
  rep: Counter | null;
  /** Inside a group with sets: "Set 1 of 2". */
  set: Counter | null;
  /** A micro rest between reps, a macro rest between sets, or neither. */
  rest: 'micro' | 'macro' | null;
  zone: Zone | null;
  /**
   * `auto`: ends on its duration or distance. `done` / `ready`: a manual
   * step that ends when the runner taps Done (an effort) or Ready (a rest).
   */
  end: 'auto' | 'done' | 'ready';
  /** For the proportional workout bar. */
  estimatedSeconds: number;
  label: string;
  tone: SegmentTone;
};

/** Whether GPS can judge a pace over this step. */
function isPaceMeasurable(target: StepTarget) {
  if (target.type === 'manual') return false;
  if (target.type === 'duration') return target.seconds >= MIN_PACED_EFFORT_S;
  return target.meters >= MIN_MEASURED_DISTANCE_M;
}

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
      return {
        label:
          step.target.type === 'manual'
            ? 'Sprint'
            : step.zone !== undefined && step.zone <= 2
              ? 'Rep'
              : 'Fast rep',
        tone: 'fast',
      };
    case 'recovery':
      return runWalk
        ? { label: 'Walk', tone: 'recovery' }
        : { label: 'Recovery', tone: 'recovery' };
    case 'macroRest':
      return { label: 'Set rest', tone: 'recovery' };
    case 'steady':
      if (runWalk) return { label: 'Run', tone: workout.type === 'long' ? 'long' : 'easy' };
      if (workout.type === 'long') return { label: 'Long run', tone: 'long' };
      if (step.zone !== undefined && workout.type !== 'easy') {
        return { label: `Zone ${step.zone}`, tone: step.zone >= 4 ? 'fast' : 'easy' };
      }
      return { label: 'Easy run', tone: 'easy' };
  }
}

/** Every segment of the workout, in order. Empty on rest days. */
export function buildRunSegments(
  workout: Pick<Workout, 'type' | 'segments'>,
): RunSegment[] {
  return unrollSegments(workout.segments).map(({ step, rep, set }, index) => ({
    index,
    stepId: step.id,
    kind: step.kind,
    target: step.target,
    paceRange: isPaceMeasurable(step.target) ? toPaceRange(step.pace) : null,
    rep,
    set,
    rest: step.kind === 'macroRest' ? 'macro' : isRest(step) ? 'micro' : null,
    zone: step.zone ?? null,
    end: step.target.type === 'manual' ? manualEndLabel(step) : 'auto',
    estimatedSeconds: stepDuration(step),
    ...describe(step, workout),
  }));
}

/** "400 m", "90 s", "5 min"; a manual step: "20 m", "Until ready". */
export function formatSegmentTarget(segment: RunSegment): string {
  const { target } = segment;
  if (target.type === 'distance') return formatDistanceShort(target.meters);
  if (target.type === 'duration') return formatDurationShort(target.seconds);
  if (target.meters !== undefined) return formatDistanceShort(target.meters);
  return segment.end === 'ready' ? 'Until ready' : 'Until done';
}
