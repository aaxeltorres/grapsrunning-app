/**
 * How the run screen treats each step of a plan workout. Pure logic (no
 * React): which pace alert a step gets, which layout shows it, the zone
 * timeline of consecutive-zone sessions and the haptic countdown before
 * a timed work step.
 *
 * Zones are pace ranges for now (there is no heart rate in the app).
 */

import type { Zone } from '../coach/plan';
import type { AlertTargets } from './goalAlerts';
import {
  SEGMENT_ALERT_GRACE_KM,
  SEGMENT_ALERT_GRACE_S,
  SHORT_STEP_CLEAR_S,
  SHORT_STEP_GRACE_KM,
  SHORT_STEP_GRACE_S,
  SHORT_STEP_HOLD_S,
  SHORT_STEP_MAX_S,
  SHORT_STEP_WINDOW_S,
} from './goalConfig';
import { WORK_COUNTDOWN_S } from './workoutConfig';
import type { RunSegment } from './workoutSegments';

/**
 * The pace alert of a step, or `null` for none:
 * - rests never alert (an active rest only shows its zone as a hint);
 * - manual steps and steps too short for GPS have no pace range, so none;
 * - Z1 and Z2 alert only when faster than the range: slower is fine there;
 * - Z3 to Z5, and steps without a zone (older workouts), on both sides;
 * - steps under SHORT_STEP_MAX_S react faster and ignore their first
 *   seconds, so the acceleration into a rep doesn't alert.
 */
export function segmentAlertTargets(segment: RunSegment): AlertTargets | null {
  if (segment.rest !== null || segment.end !== 'auto' || !segment.paceRange) {
    return null;
  }
  const short = segment.estimatedSeconds < SHORT_STEP_MAX_S;
  return {
    paceRange: segment.paceRange,
    paceSide: segment.zone !== null && segment.zone <= 2 ? 'fasterOnly' : 'both',
    grace: short
      ? { seconds: SHORT_STEP_GRACE_S, km: SHORT_STEP_GRACE_KM }
      : { seconds: SEGMENT_ALERT_GRACE_S, km: SEGMENT_ALERT_GRACE_KM },
    ...(short && {
      timing: {
        windowS: SHORT_STEP_WINDOW_S,
        holdS: SHORT_STEP_HOLD_S,
        clearS: SHORT_STEP_CLEAR_S,
      },
    }),
  };
}

/**
 * The kind of session, from its segments:
 * - `zone2`: continuous, every step in Z1 or Z2 (a regenerative run);
 * - `zones`: continuous and described in zones (tempo, progressive,
 *   extensive aerobic);
 * - `steps`: anything else (reps, run/walk, older workouts).
 */
export type SessionStyle = 'zone2' | 'zones' | 'steps';

export function sessionStyle(segments: RunSegment[]): SessionStyle {
  if (segments.length === 0) return 'steps';
  const continuous = segments.every((s) => s.rep === null && s.end === 'auto');
  const zoned = segments.every((s) => s.zone !== null);
  if (!continuous || !zoned) return 'steps';
  return segments.every((s) => (s.zone ?? 0) <= 2) ? 'zone2' : 'zones';
}

/**
 * What the current step shows as its hero:
 * - `manual`: an elapsed timer and one large Done / Ready button;
 * - `rest`: a calm countdown (or elapsed timer) to the next rep;
 * - `distance`: the run's distance (Z2 sessions);
 * - `zoneBlock`: the zone and the time left in it, with a timeline;
 * - `countdown`: the step's own countdown by time or distance.
 */
export type StepLayout = 'manual' | 'rest' | 'distance' | 'zoneBlock' | 'countdown';

export function stepLayout(segment: RunSegment, style: SessionStyle): StepLayout {
  if (segment.end !== 'auto') return 'manual';
  if (segment.rest !== null) return 'rest';
  if (style === 'zone2') return 'distance';
  if (style === 'zones') return 'zoneBlock';
  return 'countdown';
}

export type TimelineBlock = {
  index: number;
  zone: Zone | null;
  seconds: number;
  state: 'done' | 'current' | 'next';
};

/** Every block of a consecutive-zone session, with where the run is. */
export function zoneTimeline(segments: RunSegment[], currentIndex: number): TimelineBlock[] {
  return segments.map((segment) => ({
    index: segment.index,
    zone: segment.zone,
    seconds: segment.estimatedSeconds,
    state:
      segment.index < currentIndex
        ? 'done'
        : segment.index === currentIndex
          ? 'current'
          : 'next',
  }));
}

/** The next work step after `index`, for the rest's preview. */
export function nextWork(segments: RunSegment[], index: number): RunSegment | null {
  return segments.slice(index + 1).find((s) => s.kind === 'work') ?? null;
}

/**
 * The haptic countdown before a timed work step: the seconds (3, 2, 1)
 * crossed between two readings of the current step's time left. Only
 * when the current step ends by time and the next one is an automatic
 * work step. Paused, the time left doesn't move, so nothing ticks.
 */
export function countdownTicks(
  segment: RunSegment | null,
  next: RunSegment | null,
  previousRemaining: number,
  remaining: number,
): number[] {
  if (!segment || !next) return [];
  if (segment.target.type !== 'duration' || segment.end !== 'auto') return [];
  if (next.kind !== 'work' || next.end !== 'auto') return [];
  const ticks: number[] = [];
  for (let second = WORK_COUNTDOWN_S; second >= 1; second -= 1) {
    if (previousRemaining > second && remaining <= second && remaining > 0) {
      ticks.push(second);
    }
  }
  return ticks;
}
