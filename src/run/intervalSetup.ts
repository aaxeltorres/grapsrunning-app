/**
 * "Intervals": a workout the runner builds from blocks of reps and sets.
 * Pure logic (no React). The setup is plain JSON (kept as the last used
 * one); `buildIntervalWorkout` turns it into a normal `Workout` made of the
 * engine's own types, so the run screen, the alerts and the per-rep
 * recording treat it exactly like a workout from the plan.
 *
 * GPS rules come from the model (`paceFor` in coach/sessions.ts): efforts
 * under 30 s run by time with no pace target, and distances under 100 m
 * become manual "Done" steps.
 */

import {
  formatDistanceShort,
  paceMidpoint,
  totalDistance,
  totalDuration,
  type Workout,
  type WorkoutSegment,
  type WorkoutStep,
  type Zone,
} from '../coach/plan';
import { paceFor } from '../coach/sessions';
import { zonePace } from '../coach/zones';
import type { ISODate } from '../utils/dates';
import {
  DEFAULT_COOLDOWN_MINUTES,
  DEFAULT_WARMUP_MINUTES,
  MANUAL_EFFORT_MIN_ESTIMATE_S,
  MANUAL_REST_ESTIMATE_S,
  MANUAL_SET_REST_ESTIMATE_S,
  MAX_BLOCKS,
  MAX_TOTAL_REPS,
  MAX_TOTAL_S,
  REPS_MAX,
  REPS_MIN,
  REST_MAX_S,
  REST_MIN_S,
  REST_STEP_S,
  SETS_MAX,
  SETS_MIN,
  SET_REST_MAX_S,
  SET_REST_MIN_S,
  SET_REST_STEP_S,
  WARMUP_MAX_MINUTES,
  WARMUP_MIN_MINUTES,
  WORK_DISTANCES_M,
  WORK_TIME_MAX_S,
  WORK_TIME_MIN_S,
  WORK_TIME_STEP_S,
} from './intervalConfig';
import { MIN_MEASURED_DISTANCE_M, MIN_PACED_EFFORT_S } from './workoutConfig';

export const INTERVAL_SETUP_VERSION = 1;

/** A rest: a set time, or until the runner taps Ready (the time is kept for when it is switched back). */
export type IntervalRest = {
  manual: boolean;
  seconds: number;
  zone: Zone;
};

/** Both amounts are kept, so switching "by distance" / "by time" loses nothing. */
export type IntervalWork = {
  by: 'distance' | 'time';
  meters: number;
  seconds: number;
};

export type IntervalBlock = {
  /** Only for lists in the UI. */
  id: string;
  work: IntervalWork;
  reps: number;
  /** Zone of the work. */
  zone: Zone;
  /** Between reps. */
  rest: IntervalRest;
  sets: number;
  /** Between sets, used when `sets` is more than 1. */
  setRest: IntervalRest;
};

export type IntervalPart = { on: boolean; minutes: number };

export type IntervalSetup = {
  schemaVersion: typeof INTERVAL_SETUP_VERSION;
  warmup: IntervalPart;
  cooldown: IntervalPart;
  /** 1 to MAX_BLOCKS, run in order. */
  blocks: IntervalBlock[];
};

/** Zones offered for a timed rest: easy ones only (rests never alert). */
export const REST_ZONES: readonly Zone[] = [1, 2];

let blockCounter = 0;
export function newBlockId() {
  blockCounter += 1;
  return `block-${Date.now().toString(36)}-${blockCounter}`;
}

export function newBlock(overrides: Partial<Omit<IntervalBlock, 'id'>> = {}): IntervalBlock {
  return {
    id: newBlockId(),
    work: { by: 'distance', meters: 400, seconds: 60 },
    reps: 6,
    zone: 4,
    rest: { manual: false, seconds: 90, zone: 1 },
    sets: 1,
    setRest: { manual: false, seconds: 180, zone: 1 },
    ...overrides,
  };
}

export function defaultSetup(): IntervalSetup {
  return {
    schemaVersion: INTERVAL_SETUP_VERSION,
    warmup: { on: true, minutes: DEFAULT_WARMUP_MINUTES },
    cooldown: { on: false, minutes: DEFAULT_COOLDOWN_MINUTES },
    blocks: [newBlock()],
  };
}

// --- Presets ---------------------------------------------------------------

export type IntervalPreset = { id: string; label: string; build: () => IntervalSetup };

function presetSetup(block: Partial<Omit<IntervalBlock, 'id'>>, cooldown = true): IntervalSetup {
  return {
    schemaVersion: INTERVAL_SETUP_VERSION,
    warmup: { on: true, minutes: DEFAULT_WARMUP_MINUTES },
    cooldown: { on: cooldown, minutes: DEFAULT_COOLDOWN_MINUTES },
    blocks: [newBlock(block)],
  };
}

export const INTERVAL_PRESETS: readonly IntervalPreset[] = [
  {
    id: 'strides',
    label: '8 × 15″ strides',
    build: () =>
      presetSetup(
        {
          work: { by: 'time', meters: 100, seconds: 15 },
          reps: 8,
          zone: 4,
          rest: { manual: true, seconds: 60, zone: 1 },
        },
        false,
      ),
  },
  {
    id: 'sets',
    label: '2 sets of 8 × 20″',
    build: () =>
      presetSetup({
        work: { by: 'time', meters: 100, seconds: 20 },
        reps: 8,
        zone: 5,
        rest: { manual: false, seconds: 60, zone: 1 },
        sets: 2,
        setRest: { manual: false, seconds: 180, zone: 1 },
      }),
  },
  {
    id: '6x400',
    label: '6 × 400 m',
    build: () => presetSetup({}),
  },
  {
    id: '4x1k',
    label: '4 × 1 km',
    build: () =>
      presetSetup({
        work: { by: 'distance', meters: 1000, seconds: 240 },
        reps: 4,
        zone: 4,
        rest: { manual: false, seconds: 120, zone: 1 },
      }),
  },
];

// --- Normalizing a stored setup -------------------------------------------

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const snapTo = (n: number, step: number, min: number, max: number) =>
  clamp(Math.round(n / step) * step, min, max);

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asZone(value: unknown, fallback: Zone): Zone {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : fallback;
}

function nearestDistance(meters: number) {
  return WORK_DISTANCES_M.reduce((best, m) =>
    Math.abs(m - meters) < Math.abs(best - meters) ? m : best,
  );
}

function normalizeRest(raw: unknown, fallback: IntervalRest, min: number, max: number, step: number): IntervalRest {
  const r = asRecord(raw);
  return {
    manual: r.manual === true,
    seconds: snapTo(num(r.seconds, fallback.seconds), step, min, max),
    zone: asZone(r.zone, fallback.zone),
  };
}

function normalizePart(raw: unknown, fallback: IntervalPart): IntervalPart {
  const r = asRecord(raw);
  return {
    on: typeof r.on === 'boolean' ? r.on : fallback.on,
    minutes: clamp(Math.round(num(r.minutes, fallback.minutes)), WARMUP_MIN_MINUTES, WARMUP_MAX_MINUTES),
  };
}

function normalizeBlock(raw: unknown): IntervalBlock {
  const base = newBlock();
  const r = asRecord(raw);
  const work = asRecord(r.work);
  return {
    id: newBlockId(),
    work: {
      by: work.by === 'time' ? 'time' : 'distance',
      meters: nearestDistance(num(work.meters, base.work.meters)),
      seconds: snapTo(num(work.seconds, base.work.seconds), WORK_TIME_STEP_S, WORK_TIME_MIN_S, WORK_TIME_MAX_S),
    },
    reps: clamp(Math.round(num(r.reps, base.reps)), REPS_MIN, REPS_MAX),
    zone: asZone(r.zone, base.zone),
    rest: normalizeRest(r.rest, base.rest, REST_MIN_S, REST_MAX_S, REST_STEP_S),
    sets: clamp(Math.round(num(r.sets, base.sets)), SETS_MIN, SETS_MAX),
    setRest: normalizeRest(r.setRest, base.setRest, SET_REST_MIN_S, SET_REST_MAX_S, SET_REST_STEP_S),
  };
}

/**
 * Any stored value as a valid setup: numbers are clamped to the limits and
 * snapped to what the wheels offer, anything missing falls back to the
 * default. Never throws.
 */
export function normalizeSetup(raw: unknown): IntervalSetup {
  const r = asRecord(raw);
  const base = defaultSetup();
  const blocks = (Array.isArray(r.blocks) ? r.blocks : []).slice(0, MAX_BLOCKS).map(normalizeBlock);
  return {
    schemaVersion: INTERVAL_SETUP_VERSION,
    warmup: normalizePart(r.warmup, base.warmup),
    cooldown: normalizePart(r.cooldown, base.cooldown),
    blocks: blocks.length > 0 ? blocks : base.blocks,
  };
}

// --- Building the workout --------------------------------------------------

/** Plan-model steps for a setup, for a runner with this easy pace (s/km). */
export function buildIntervalWorkout(
  setup: IntervalSetup,
  easyPace: number,
  { id, date }: { id: string; date: ISODate },
): Workout {
  let n = 0;
  const nextId = () => `${id}-${++n}`;
  const step = (
    kind: WorkoutStep['kind'],
    target: WorkoutStep['target'],
    zone: Zone | undefined,
  ): WorkoutStep => {
    const built: WorkoutStep = { id: nextId(), kind, target, pace: paceFor(target, zone, easyPace) };
    if (zone !== undefined) built.zone = zone;
    return built;
  };

  const workStep = (block: IntervalBlock) => {
    const { work, zone } = block;
    if (work.by === 'time') return step('work', { type: 'duration', seconds: work.seconds }, zone);
    if (work.meters >= MIN_MEASURED_DISTANCE_M) {
      return step('work', { type: 'distance', meters: work.meters }, zone);
    }
    const mid = paceMidpoint(zonePace(easyPace, zone));
    const estimatedSeconds = Math.max(
      MANUAL_EFFORT_MIN_ESTIMATE_S,
      Math.round((work.meters / 1000) * mid),
    );
    return step('work', { type: 'manual', estimatedSeconds, meters: work.meters }, zone);
  };

  const restStep = (
    kind: 'recovery' | 'macroRest',
    rest: IntervalRest,
    manualEstimate: number,
  ) =>
    rest.manual
      ? step(kind, { type: 'manual', estimatedSeconds: manualEstimate }, undefined)
      : step(kind, { type: 'duration', seconds: rest.seconds }, rest.zone);

  const segments: WorkoutSegment[] = [];
  if (setup.warmup.on) {
    segments.push(step('warmup', { type: 'duration', seconds: setup.warmup.minutes * 60 }, 1));
  }
  setup.blocks.forEach((block, index) => {
    const steps = [workStep(block), restStep('recovery', block.rest, MANUAL_REST_ESTIMATE_S)];
    const group: WorkoutSegment = { id: nextId(), repeat: block.reps, steps };
    if (block.sets > 1) {
      group.sets = block.sets;
      group.macroRest = restStep('macroRest', block.setRest, MANUAL_SET_REST_ESTIMATE_S);
    }
    // The rest after the last rep of a block is the one before the next
    // block; after the last block the workout ends, or the cool-down begins.
    if (index === setup.blocks.length - 1) group.noFinalRest = true;
    segments.push(group);
  });
  if (setup.cooldown.on) {
    segments.push(step('cooldown', { type: 'duration', seconds: setup.cooldown.minutes * 60 }, 1));
  }

  return { id, date, type: 'intervals', status: 'planned', segments };
}

// --- Summary and validation ------------------------------------------------

/** Every effort of the workout, sets included. */
export function totalReps(setup: IntervalSetup) {
  return setup.blocks.reduce((sum, block) => sum + block.reps * block.sets, 0);
}

export type IntervalIssue =
  | { kind: 'tooLong'; seconds: number }
  | { kind: 'tooManyReps'; count: number };

export type IntervalStats = {
  /** Estimated: manual steps count with an estimate. */
  seconds: number;
  /** `null` when an effort is too short for GPS, so a distance would be a guess. */
  meters: number | null;
};

function isMeasurable(block: IntervalBlock) {
  return block.work.by === 'time'
    ? block.work.seconds >= MIN_PACED_EFFORT_S
    : block.work.meters >= MIN_MEASURED_DISTANCE_M;
}

export function setupStats(setup: IntervalSetup, workout: Workout): IntervalStats {
  return {
    seconds: totalDuration(workout),
    meters: setup.blocks.every(isMeasurable) ? totalDistance(workout) : null,
  };
}

/** What blocks Start. The wheels already keep every value in range. */
export function validateSetup(setup: IntervalSetup, stats: IntervalStats): IntervalIssue[] {
  const issues: IntervalIssue[] = [];
  const count = totalReps(setup);
  if (count > MAX_TOTAL_REPS) issues.push({ kind: 'tooManyReps', count });
  if (stats.seconds > MAX_TOTAL_S) issues.push({ kind: 'tooLong', seconds: stats.seconds });
  return issues;
}

/** One short line when a GPS rule changes how the block's reps run; else `null`. */
export function blockNote(block: IntervalBlock): string | null {
  const { work } = block;
  if (work.by === 'distance' && work.meters < MIN_MEASURED_DISTANCE_M) {
    return `Under ${MIN_MEASURED_DISTANCE_M} m is too short for GPS: you tap Done after each rep.`;
  }
  if (work.by === 'time' && work.seconds < MIN_PACED_EFFORT_S) {
    return `Under ${MIN_PACED_EFFORT_S} s is too short for GPS: reps run by time, with no pace target.`;
  }
  return null;
}

// --- Text ------------------------------------------------------------------

/** "20 s", "1:30" */
export function formatSeconds(seconds: number) {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "400 m", "1.2 km", "20 s", "1:30" */
export function formatWork(work: IntervalWork) {
  return work.by === 'distance' ? formatDistanceShort(work.meters) : formatSeconds(work.seconds);
}

/** "1:30", or "Until I'm ready" */
export function formatRest(rest: IntervalRest) {
  return rest.manual ? "Until I'm ready" : formatSeconds(rest.seconds);
}

/** "6 × 400 m", "2 sets of 8 × 20 s" */
export function blockTitle(block: IntervalBlock) {
  const reps = `${block.reps} × ${formatWork(block.work)}`;
  return block.sets > 1 ? `${block.sets} sets of ${reps}` : reps;
}
