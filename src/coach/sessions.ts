/**
 * The structured training sessions (Fartlek, HIIT, Tempo run...) as
 * templates. Pure logic (no React). The plan generator and the workout
 * editor build every session from here, so both always agree.
 *
 * A template mixes fixed parts (the rep blocks, never stretched: reps,
 * sets and their rests are the session) with flexible continuous parts
 * (warm-up, easy lead-in, zone blocks, cool-down) that are scaled to
 * reach a total time. Paces come from the runner's zones (zones.ts).
 * GPS limits (workoutConfig.ts) decide what gets a pace target: efforts
 * under 30 s are countdowns with none, sprints under 100 m are manual.
 */

import { MIN_MEASURED_DISTANCE_M, MIN_PACED_EFFORT_S } from '../run/workoutConfig';
import {
  totalDuration,
  type Pace,
  type SessionId,
  type StepKind,
  type StepTarget,
  type WorkoutSegment,
  type WorkoutStep,
  type WorkoutType,
  type Zone,
} from './plan';
import type { LevelId } from './runnerProfile';
import { zonePace } from './zones';

export type SessionSpec = {
  category: Exclude<WorkoutType, 'rest'>;
  /** Interval-type: only for runners who opted into speed work. */
  speedWork: boolean;
  /** Only from the 5K level up (never beginners, never `run_30`). */
  advanced: boolean;
  /** Total time limits in the editor, in minutes. */
  minMinutes: number;
  maxMinutes: number;
};

export const SESSION_SPECS: Record<SessionId, SessionSpec> = {
  regenerative: { category: 'easy', speedWork: false, advanced: false, minMinutes: 20, maxMinutes: 60 },
  extensiveAerobic: { category: 'aerobic', speedWork: false, advanced: false, minMinutes: 30, maxMinutes: 75 },
  progressive: { category: 'aerobic', speedWork: false, advanced: false, minMinutes: 30, maxMinutes: 80 },
  tempoRun: { category: 'tempo', speedWork: true, advanced: true, minMinutes: 30, maxMinutes: 70 },
  strides: { category: 'intervals', speedWork: true, advanced: false, minMinutes: 20, maxMinutes: 45 },
  fartlek: { category: 'intervals', speedWork: true, advanced: false, minMinutes: 35, maxMinutes: 55 },
  longIntervals: { category: 'intervals', speedWork: true, advanced: true, minMinutes: 55, maxMinutes: 80 },
  mixedIntervals: { category: 'intervals', speedWork: true, advanced: false, minMinutes: 25, maxMinutes: 50 },
  hiit: { category: 'speed', speedWork: true, advanced: true, minMinutes: 22, maxMinutes: 45 },
  hiitMacro: { category: 'speed', speedWork: true, advanced: true, minMinutes: 27, maxMinutes: 50 },
  sprints: { category: 'speed', speedWork: true, advanced: true, minMinutes: 33, maxMinutes: 70 },
};

export const SESSION_IDS = Object.keys(SESSION_SPECS) as SessionId[];

export function isSessionId(value: string): value is SessionId {
  return value in SESSION_SPECS;
}

/** Levels that may get the advanced sessions. */
export function isAdvancedLevel(level: LevelId) {
  return level === 'run_5k' || level === 'run_10k_plus';
}

/** Flexible parts are whole minutes, as a coach writes them, and never... */
const FLEX_ROUND_S = 60;
/** ...shorter than this. */
const FLEX_MIN_S = 60;
/** Estimated length of a manual effort and of a full recovery. */
const SPRINT_ESTIMATE_S = 5;
const FULL_REST_ESTIMATE_S = 90;
const FULL_SET_REST_ESTIMATE_S = 240;

const min = (n: number) => n * 60;

type Flex = { flex: true; kind: StepKind; zone: Zone; seconds: number };
type Part = Flex | WorkoutSegment;

const isFlex = (part: Part): part is Flex => 'flex' in part;

type Make = {
  step: (kind: StepKind, target: StepTarget, zone: Zone | undefined) => WorkoutStep;
  repeat: (
    repeat: number,
    steps: WorkoutStep[],
    sets?: { sets: number; macroRest: WorkoutStep },
  ) => WorkoutSegment;
};

const seconds = (s: number): StepTarget => ({ type: 'duration', seconds: s });
const manual = (estimatedSeconds: number, meters?: number): StepTarget =>
  meters === undefined
    ? { type: 'manual', estimatedSeconds }
    : { type: 'manual', estimatedSeconds, meters };
const flex = (kind: StepKind, zone: Zone, minutes: number): Flex => ({
  flex: true,
  kind,
  zone,
  seconds: min(minutes),
});

type Template = (m: Make) => Part[];

const sprintSets = (reps: number, meters: number, sets: number): Template => ({ step, repeat }) => [
  flex('warmup', 1, 10),
  repeat(
    reps,
    [
      step('work', manual(SPRINT_ESTIMATE_S, meters), 5),
      step('recovery', manual(FULL_REST_ESTIMATE_S), undefined),
    ],
    { sets, macroRest: step('macroRest', manual(FULL_SET_REST_ESTIMATE_S), undefined) },
  ),
  flex('cooldown', 1, 15),
];

/**
 * Each session as the coach wrote it, in variants. The first variant is
 * the reference session; the others change reps, rep length or the zone
 * split, so the plan never repeats a session exactly week after week
 * (the generator picks the variant from the week, see `buildSession`).
 * Speed and interval sessions that start cold get a 10' Z1 warm-up.
 */
const TEMPLATES: Record<SessionId, Template[]> = {
  regenerative: [
    // 40' Z2
    () => [flex('steady', 2, 40)],
  ],
  extensiveAerobic: [
    // 45' to 60' continuous Z3
    () => [flex('steady', 3, 45)],
    // 10' Z2 + 35' Z3
    () => [flex('steady', 2, 10), flex('steady', 3, 35)],
  ],
  progressive: [
    // 20' Z2 + 15' Z3 + 10' Z4 + 5' Z1
    () => [
      flex('steady', 2, 20),
      flex('steady', 3, 15),
      flex('steady', 4, 10),
      flex('cooldown', 1, 5),
    ],
    // 15' Z2 + 20' Z3 + 10' Z4 + 5' Z1
    () => [
      flex('steady', 2, 15),
      flex('steady', 3, 20),
      flex('steady', 4, 10),
      flex('cooldown', 1, 5),
    ],
  ],
  tempoRun: [
    // 5' Z1 + 15' Z3 + 15' Z4 + 5' Z1: consecutive zones, no rests
    () => [
      flex('warmup', 1, 5),
      flex('steady', 3, 15),
      flex('steady', 4, 15),
      flex('cooldown', 1, 5),
    ],
    // 5' Z1 + 10' Z3 + 20' Z4 + 5' Z1
    () => [
      flex('warmup', 1, 5),
      flex('steady', 3, 10),
      flex('steady', 4, 20),
      flex('cooldown', 1, 5),
    ],
  ],
  strides: [
    // 15' Z2 + 8 × 15'' Z4 with full (manual) rests
    ({ step, repeat }) => [
      flex('warmup', 2, 15),
      repeat(8, [
        step('work', seconds(15), 4),
        step('recovery', manual(FULL_REST_ESTIMATE_S), undefined),
      ]),
    ],
    // 15' Z2 + 6 × 20'' Z4 with full (manual) rests
    ({ step, repeat }) => [
      flex('warmup', 2, 15),
      repeat(6, [
        step('work', seconds(20), 4),
        step('recovery', manual(FULL_REST_ESTIMATE_S), undefined),
      ]),
    ],
  ],
  fartlek: [
    // 5' Z2 + 8 × (1'30'' Z4 + 2'30'' Z2)
    ({ step, repeat }) => [
      flex('warmup', 2, 5),
      repeat(8, [step('work', seconds(90), 4), step('recovery', seconds(150), 2)]),
    ],
    // 5' Z2 + 6 × (2' Z4 + 2' Z2)
    ({ step, repeat }) => [
      flex('warmup', 2, 5),
      repeat(6, [step('work', seconds(120), 4), step('recovery', seconds(120), 2)]),
    ],
    // 5' Z2 + 10 × (1' Z4 + 2' Z2)
    ({ step, repeat }) => [
      flex('warmup', 2, 5),
      repeat(10, [step('work', seconds(60), 4), step('recovery', seconds(120), 2)]),
    ],
  ],
  longIntervals: [
    // 10 × 3' Z4 with 2' active rests in Z1
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(10, [step('work', seconds(180), 4), step('recovery', seconds(120), 1)]),
      flex('cooldown', 1, 5),
    ],
    // 6 × 4' Z4 with 2' active rests in Z1
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(6, [step('work', seconds(240), 4), step('recovery', seconds(120), 1)]),
      flex('cooldown', 1, 5),
    ],
    // 5 × 5' Z4 with 2'30'' active rests in Z1
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(5, [step('work', seconds(300), 4), step('recovery', seconds(150), 1)]),
      flex('cooldown', 1, 5),
    ],
  ],
  mixedIntervals: [
    // 5 × 2' Z4 with 2' Z2 rests, finish 5' Z1
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(5, [step('work', seconds(120), 4), step('recovery', seconds(120), 2)]),
      flex('cooldown', 1, 5),
    ],
    // 4 × 3' Z4 with 2' Z2 rests
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(4, [step('work', seconds(180), 4), step('recovery', seconds(120), 2)]),
      flex('cooldown', 1, 5),
    ],
    // 6 × 1'30'' Z4 with 1'30'' Z2 rests
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(6, [step('work', seconds(90), 4), step('recovery', seconds(90), 2)]),
      flex('cooldown', 1, 5),
    ],
  ],
  hiit: [
    // 10 × 10'' Z5, then 6 × 15'' Z4, all with 1' Z2 rests
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(10, [step('work', seconds(10), 5), step('recovery', seconds(60), 2)]),
      repeat(6, [step('work', seconds(15), 4), step('recovery', seconds(60), 2)]),
    ],
    // 12 × 10'' Z5, then 4 × 20'' Z4, all with 1' Z2 rests
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(12, [step('work', seconds(10), 5), step('recovery', seconds(60), 2)]),
      repeat(4, [step('work', seconds(20), 4), step('recovery', seconds(60), 2)]),
    ],
    // 8 × 15'' Z5, then 4 × 20'' Z4, all with 1' Z2 rests
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(8, [step('work', seconds(15), 5), step('recovery', seconds(60), 2)]),
      repeat(4, [step('work', seconds(20), 4), step('recovery', seconds(60), 2)]),
    ],
  ],
  hiitMacro: [
    // 2 sets of 8 × 20'' Z5, 1' Z1 micro rest, 3' macro rest
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(8, [step('work', seconds(20), 5), step('recovery', seconds(60), 1)], {
        sets: 2,
        macroRest: step('macroRest', seconds(180), 1),
      }),
    ],
    // 3 sets of 6 × 20'' Z5, 1' Z1 micro rest, 3' macro rest
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(6, [step('work', seconds(20), 5), step('recovery', seconds(60), 1)], {
        sets: 3,
        macroRest: step('macroRest', seconds(180), 1),
      }),
    ],
    // 2 sets of 10 × 15'' Z5, 45'' Z1 micro rest, 3' macro rest
    ({ step, repeat }) => [
      flex('warmup', 1, 10),
      repeat(10, [step('work', seconds(15), 5), step('recovery', seconds(45), 1)], {
        sets: 2,
        macroRest: step('macroRest', seconds(180), 1),
      }),
    ],
  ],
  sprints: [
    // 3 blocks of 5 × 20 m sprints in Z5, full (manual) rests, then 15' Z1
    sprintSets(5, 20, 3),
    // 4 blocks of 4 × 30 m
    sprintSets(4, 30, 4),
    // 2 blocks of 6 × 20 m
    sprintSets(6, 20, 2),
  ],
};

/**
 * The step's pace: its zone's range, unless GPS can't judge a pace over
 * it (a manual step, an effort under 30 s, a sprint under 100 m).
 */
export function paceFor(target: StepTarget, zone: Zone | undefined, easyPace: number): Pace | null {
  if (zone === undefined || target.type === 'manual') return null;
  if (target.type === 'duration' && target.seconds < MIN_PACED_EFFORT_S) return null;
  if (target.type === 'distance' && target.meters < MIN_MEASURED_DISTANCE_M) return null;
  return zonePace(easyPace, zone);
}

function maker(workoutId: string, easyPace: number): Make {
  let n = 0;
  const nextId = () => `${workoutId}-${++n}`;
  return {
    step: (kind, target, zone) => {
      const step: WorkoutStep = { id: nextId(), kind, target, pace: paceFor(target, zone, easyPace) };
      if (zone !== undefined) step.zone = zone;
      return step;
    },
    repeat: (repeat, steps, sets) => ({
      id: nextId(),
      repeat,
      steps,
      ...(sets ? { sets: sets.sets, macroRest: sets.macroRest } : {}),
    }),
  };
}

const roundFlex = (s: number) => Math.max(FLEX_MIN_S, Math.round(s / FLEX_ROUND_S) * FLEX_ROUND_S);

/**
 * Builds a session. `scale` stretches its continuous parts (1 = the
 * reference session); `totalSeconds`, when given, wins and sets the scale
 * so the whole session lasts about that long. `variant` picks one of the
 * session's variants, wrapping around (any whole number works, e.g. the
 * plan week).
 */
export function buildSession(
  workoutId: string,
  session: SessionId,
  easyPace: number,
  options: { scale?: number; totalSeconds?: number; variant?: number } = {},
): WorkoutSegment[] {
  const make = maker(workoutId, easyPace);
  const variants = TEMPLATES[session];
  const parts = variants[Math.max(0, options.variant ?? 0) % variants.length](make);
  const fixed = totalDuration({ segments: parts.filter((p): p is WorkoutSegment => !isFlex(p)) });
  const flexBase = parts.reduce((sum, p) => sum + (isFlex(p) ? p.seconds : 0), 0);

  let scale = options.scale ?? 1;
  if (options.totalSeconds !== undefined && flexBase > 0) {
    scale = Math.max(0, options.totalSeconds - fixed) / flexBase;
  }

  // Each flexible part rounded; the largest one absorbs the rounding so
  // the total lands on target.
  const flexSeconds = parts.map((p) => (isFlex(p) ? roundFlex(p.seconds * scale) : 0));
  const target = flexBase * scale;
  const largest = flexSeconds.indexOf(Math.max(...flexSeconds));
  if (largest >= 0 && flexBase > 0) {
    const drift = flexSeconds.reduce((a, b) => a + b, 0) - target;
    flexSeconds[largest] = roundFlex(flexSeconds[largest] - drift);
  }

  // Ids follow the session's order: flexible parts get theirs here, and
  // the rep blocks were numbered while the template was built.
  let n = 0;
  return parts.map((part, i) =>
    isFlex(part)
      ? {
          id: `${workoutId}-f${++n}`,
          kind: part.kind,
          target: seconds(flexSeconds[i]),
          pace: paceFor(seconds(flexSeconds[i]), part.zone, easyPace),
          zone: part.zone,
        }
      : part,
  );
}
