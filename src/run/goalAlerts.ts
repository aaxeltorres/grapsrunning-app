/**
 * Off-track alerts for paced runs, as a small state machine. Pure logic
 * (no React, no timers) fed one sample per tracking tick, so goal runs
 * and, later, plan workouts can share it.
 *
 * - Pace: off track when the smoothed current pace is outside the target
 *   plus or minus the tolerance.
 * - Finish (time with a distance): off track when the projected finish,
 *   elapsed time plus the remaining distance at the current pace, is later
 *   than the target.
 *
 * An alert shows only after its condition held for ALERT_HOLD_S, clears
 * after ALERT_CLEAR_S back on track, and nothing alerts during the start
 * grace period. Targets that are not given never alert.
 */

import {
  ALERT_CLEAR_S,
  ALERT_GRACE_KM,
  ALERT_GRACE_S,
  ALERT_HOLD_S,
  PACE_SMOOTHING_WINDOW_S,
  PACE_TOLERANCE_S_PER_KM,
} from './goalConfig';

export type AlertSample = {
  /** Moving time, pauses excluded. */
  movingSeconds: number;
  distanceKm: number;
};

export type AlertTargets = {
  /** Target pace in seconds per km. */
  paceSecPerKm?: number;
  /** Finish this distance (km) within this time (s). */
  finish?: { distanceKm: number; seconds: number };
};

type Debounced = {
  active: boolean;
  /** The raw (undebounced) condition at the last sample. */
  raw: boolean;
  /** Moving time when `raw` last changed. */
  since: number;
};

export type AlertState = {
  /** Samples within the smoothing window, oldest first. */
  samples: AlertSample[];
  /** Smoothed current pace (s/km), `null` until there is enough data. */
  currentPace: number | null;
  pace: Debounced;
  finish: Debounced;
};

export type AlertFlags = { pace: boolean; finish: boolean };

const calm = (): Debounced => ({ active: false, raw: false, since: 0 });

export function createAlertState(): AlertState {
  return { samples: [], currentPace: null, pace: calm(), finish: calm() };
}

// Below this distance over a window the pace is just GPS noise.
const MIN_WINDOW_KM = 0.005;

/** Pace over the window of moving time, `null` while barely moving. */
function windowPace(samples: AlertSample[]): number | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.movingSeconds - first.movingSeconds;
  const dd = last.distanceKm - first.distanceKm;
  if (dt < PACE_SMOOTHING_WINDOW_S / 2 || dd < MIN_WINDOW_KM) return null;
  return dt / dd;
}

function debounce(prev: Debounced, raw: boolean, now: number): Debounced {
  const since = raw === prev.raw ? prev.since : now;
  const held = now - since;
  const active = prev.active
    ? raw || held < ALERT_CLEAR_S
    : raw && held >= ALERT_HOLD_S;
  return { active, raw, since };
}

/** Feeds one sample; returns the next state. Samples must not go back in time. */
export function updateAlerts(
  state: AlertState,
  sample: AlertSample,
  targets: AlertTargets,
): AlertState {
  const now = sample.movingSeconds;
  const samples = [...state.samples, sample].filter(
    (s) => now - s.movingSeconds <= PACE_SMOOTHING_WINDOW_S,
  );
  const currentPace = windowPace(samples);
  const ready =
    now >= ALERT_GRACE_S &&
    sample.distanceKm >= ALERT_GRACE_KM &&
    currentPace !== null;

  const paceOff =
    ready &&
    targets.paceSecPerKm !== undefined &&
    Math.abs(currentPace - targets.paceSecPerKm) > PACE_TOLERANCE_S_PER_KM;

  let finishOff = false;
  if (ready && targets.finish) {
    const remainingKm = Math.max(0, targets.finish.distanceKm - sample.distanceKm);
    finishOff = now + remainingKm * currentPace > targets.finish.seconds;
  }

  return {
    samples,
    currentPace,
    pace: debounce(state.pace, paceOff, now),
    finish: debounce(state.finish, finishOff, now),
  };
}

export function alertFlags(state: AlertState): AlertFlags {
  return { pace: state.pace.active, finish: state.finish.active };
}
