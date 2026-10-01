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

/**
 * Each session as the coach wrote it. Speed and interval sessions that
 * start cold get a 10' Z1 warm-up; the rest is the reference session.
 */
const TEMPLATES: Record<SessionId, (m: Make) => Part[]> = {
  // 40' Z2
  regenerative: () => [flex('steady', 2, 40)],
  // 45' to 60' continuous Z3
  extensiveAerobic: () => [flex('steady', 3, 45)],
  // 20' Z2 + 15' Z3 + 10' Z4 + 5' Z1
  progressive: () => [
    flex('steady', 2, 20),
    flex('steady', 3, 15),
    flex('steady', 4, 10),
    flex('cooldown', 1, 5),
  ],
  // 5' Z1 + 15' Z3 + 15' Z4 + 5' Z1: consecutive zones, no rests
  tempoRun: () => [
    flex('warmup', 1, 5),
    flex('steady', 3, 15),
    flex('steady', 4, 15),
    flex('cooldown', 1, 5),
  ],
  // 15' Z2 + 8 × 15'' Z4 with full (manual) rests
  strides: ({ step, repeat }) => [
    flex('warmup', 2, 15),
    repeat(8, [
      step('work', seconds(15), 4),
      step('recovery', manual(FULL_REST_ESTIMATE_S), undefined),
    ]),
  ],
  // 5' Z2 + 8 × (1'30'' Z4 + 2'30'' Z2)
  fartlek: ({ step, repeat }) => [
    flex('warmup', 2, 5),
    repeat(8, [step('work', seconds(90), 4), step('recovery', seconds(150), 2)]),
  ],
  // 10 × 3' Z4 with 2' active rests in Z1
  longIntervals: ({ step, repeat }) => [
    flex('warmup', 1, 10),
    repeat(10, [step('work', seconds(180), 4), step('recovery', seconds(120), 1)]),
    flex('cooldown', 1, 5),
  ],
  // 5 × 2' Z4 with 2' Z2 rests, finish 5' Z1
  mixedIntervals: ({ step, repeat }) => [
    flex('warmup', 1, 10),
    repeat(5, [step('work', seconds(120), 4), step('recovery', seconds(120), 2)]),
    flex('cooldown', 1, 5),
  ],
  // 10 × 10'' Z5, then 6 × 15'' Z4, all with 1' Z2 rests
  hiit: ({ step, repeat }) => [
    flex('warmup', 1, 10),
    repeat(10, [step('work', seconds(10), 5), step('recovery', seconds(60), 2)]),
    repeat(6, [step('work', seconds(15), 4), step('recovery', seconds(60), 2)]),
  ],
  // 2 sets of 8 × 20'' Z5, 1' Z1 micro rest, 3' macro rest
  hiitMacro: ({ step, repeat }) => [
    flex('warmup', 1, 10),
    repeat(8, [step('work', seconds(20), 5), step('recovery', seconds(60), 1)], {
      sets: 2,
      macroRest: step('macroRest', seconds(180), 1),
    }),
  ],
  // 3 blocks of 5 × 20 m sprints in Z5, full (manual) rests, then 15' Z1
  sprints: ({ step, repeat }) => [
    flex('warmup', 1, 10),
    repeat(
      5,
      [
        step('work', manual(SPRINT_ESTIMATE_S, 20), 5),
        step('recovery', manual(FULL_REST_ESTIMATE_S), undefined),
      ],
      { sets: 3, macroRest: step('macroRest', manual(FULL_SET_REST_ESTIMATE_S), undefined) },
    ),
    flex('cooldown', 1, 15),
  ],
};

/**
 * The step's pace: its zone's range, unless GPS can't judge a pace over
 * it (a manual step, an effort under 30 s, a sprint under 100 m).
 */
function paceFor(target: StepTarget, zone: Zone | undefined, easyPace: number): Pace | null {
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
 * so the whole session lasts about that long.
 */
export function buildSession(
  workoutId: string,
  session: SessionId,
  easyPace: number,
  options: { scale?: number; totalSeconds?: number } = {},
): WorkoutSegment[] {
  const make = maker(workoutId, easyPace);
  const parts = TEMPLATES[session](make);
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
