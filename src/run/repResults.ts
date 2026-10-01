/**
 * Per-rep recording of a plan workout run, and the rows Run results shows
 * for it. Pure logic (no React): fed the engine's events, it notes the
 * moving time and distance of every work step.
 */

import type { Counter, RepResult } from '../coach/plan';
import { formatPaceSeconds } from '../utils/format';
import { MIN_MEASURED_DISTANCE_M, MIN_PACED_EFFORT_S } from './workoutConfig';
import type { WorkoutEvent, WorkoutSample } from './workoutEvents';
import type { RunSegment } from './workoutSegments';

export type RepRecorder = {
  /** The work step running now, and where it started. */
  open: { segment: RunSegment; at: WorkoutSample } | null;
  reps: RepResult[];
};

export function createRepRecorder(): RepRecorder {
  return { open: null, reps: [] };
}

/** Whether GPS can tell a pace over this much time and distance. */
export function isMeasuredEffort(seconds: number, meters: number) {
  return seconds >= MIN_PACED_EFFORT_S && meters >= MIN_MEASURED_DISTANCE_M;
}

function toRep(
  segment: RunSegment,
  from: WorkoutSample,
  to: WorkoutSample,
  ended: RepResult['ended'],
): RepResult {
  const seconds = Math.max(0, to.movingSeconds - from.movingSeconds);
  const meters = Math.max(0, (to.distanceKm - from.distanceKm) * 1000);
  // A manual effort (a 20 m sprint) is never paced, whatever GPS says.
  const paced = segment.end === 'auto' && isMeasuredEffort(seconds, meters);
  return {
    index: segment.index,
    label: segment.label,
    ...(segment.rep && { rep: segment.rep }),
    ...(segment.set && { set: segment.set }),
    ...(segment.zone !== null && { zone: segment.zone }),
    target: segment.target,
    ...(segment.paceRange && { targetPace: segment.paceRange }),
    seconds,
    meters: Math.round(meters),
    paceSecPerKm: paced ? seconds / (meters / 1000) : null,
    ended,
  };
}

/** Feeds one engine event. Only work steps are recorded. */
export function recordEvent(recorder: RepRecorder, event: WorkoutEvent): RepRecorder {
  if (event.type === 'segmentStart' && event.segment.kind === 'work') {
    return { ...recorder, open: { segment: event.segment, at: event.at } };
  }
  const open = recorder.open;
  if (event.type === 'segmentEnd' && open && event.segment.index === open.segment.index) {
    const ended = event.reason === 'ready' ? 'done' : event.reason;
    return { open: null, reps: [...recorder.reps, toRep(open.segment, open.at, event.at, ended)] };
  }
  return recorder;
}

export type SetSummary = {
  reps: number;
  /** Average pace over the set's measured reps, `null` when none was. */
  avgPaceSecPerKm: number | null;
  /** Average time of a rep. */
  avgSeconds: number;
};

/** The finished reps of one set (skipped ones left out), for the macro rest. */
export function setSummary(reps: RepResult[], set: Counter): SetSummary | null {
  const done = reps.filter(
    (r) => r.set?.number === set.number && r.set.of === set.of && r.ended !== 'skipped',
  );
  if (done.length === 0) return null;
  const measured = done.filter((r) => r.paceSecPerKm !== null);
  const measuredKm = measured.reduce((sum, r) => sum + r.meters / 1000, 0);
  const measuredSeconds = measured.reduce((sum, r) => sum + r.seconds, 0);
  return {
    reps: done.length,
    avgPaceSecPerKm: measuredKm > 0 ? measuredSeconds / measuredKm : null,
    avgSeconds: done.reduce((sum, r) => sum + r.seconds, 0) / done.length,
  };
}

/** "20 s", "1:30" */
export function formatEffortTime(seconds: number) {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export type RepRow = {
  key: string;
  /** "Rep 3", "Set 2 · Rep 3" */
  label: string;
  /** The pace when measured, else the time. */
  value: string;
  unit: '/km' | '';
  /** What it was aimed at: "4:55–5:30", "20 s", "20 m". */
  target: string;
  /** "On target", "8 s/km slow", "+2 s", "Skipped"; `null` when nothing compares. */
  verdict: string | null;
  /** Off the target (shown in a warmer color). */
  off: boolean;
};

const TIME_EVEN_S = 1;

function repLabel(rep: RepResult, position: number) {
  const repText = `Rep ${rep.rep?.number ?? position + 1}`;
  return rep.set ? `Set ${rep.set.number} · ${repText}` : repText;
}

function targetText(rep: RepResult) {
  if (rep.targetPace) {
    return `${formatPaceSeconds(rep.targetPace.min)}–${formatPaceSeconds(rep.targetPace.max)}`;
  }
  const { target } = rep;
  if (target.type === 'duration') return formatEffortTime(target.seconds);
  if (target.type === 'distance') return `${Math.round(target.meters)} m`;
  return target.meters !== undefined ? `${target.meters} m` : 'Open';
}

/** One row per rep: pace against its range, or time for short efforts. */
export function repRows(reps: RepResult[]): RepRow[] {
  return reps.map((rep, i) => {
    const base = { key: `${rep.index}`, label: repLabel(rep, i), target: targetText(rep) };
    if (rep.ended === 'skipped') {
      return { ...base, value: '–', unit: '', verdict: 'Skipped', off: false };
    }
    if (rep.paceSecPerKm !== null) {
      // Whole seconds, as shown: 4:59.9999 is on a 5:00 edge, not "0 s fast".
      const pace = Math.round(rep.paceSecPerKm);
      const value = formatPaceSeconds(pace);
      if (!rep.targetPace) return { ...base, value, unit: '/km', verdict: null, off: false };
      const { min, max } = rep.targetPace;
      const off = pace < min ? min - pace : pace > max ? pace - max : 0;
      const verdict =
        off === 0
          ? 'On target'
          : `${Math.round(off)} s/km ${pace < min ? 'fast' : 'slow'}`;
      return { ...base, value, unit: '/km', verdict, off: off > 0 };
    }
    const value = formatEffortTime(rep.seconds);
    if (rep.target.type !== 'duration' || rep.ended !== 'completed') {
      return { ...base, value, unit: '', verdict: null, off: false };
    }
    const diff = rep.seconds - rep.target.seconds;
    return {
      ...base,
      value,
      unit: '',
      verdict:
        Math.abs(diff) <= TIME_EVEN_S
          ? 'On time'
          : `${diff > 0 ? '+' : '−'}${formatEffortTime(Math.abs(diff))}`,
      off: false,
    };
  });
}
