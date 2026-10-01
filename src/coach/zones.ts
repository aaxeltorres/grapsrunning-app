/**
 * Training zones 1 to 5. Pure logic (no React).
 *
 * Zones are pace ranges for now: there is no heart rate in the app yet
 * (the "Intensity by" setting shows Heart rate as coming soon). Each range
 * comes from the runner's easy pace, the same pace the plan generator
 * uses, and stays within the pace limits of the whole app.
 */

import { GOAL_PACE_MAX_S_PER_KM, GOAL_PACE_MIN_S_PER_KM } from '../run/goalConfig';
import type { Zone } from './plan';

export const ZONES: readonly Zone[] = [1, 2, 3, 4, 5];

export type ZoneInfo = { name: string; feel: string };

export const ZONE_INFO: Record<Zone, ZoneInfo> = {
  1: { name: 'Very easy', feel: 'Calm breathing.' },
  2: { name: 'Comfortable', feel: 'You can hold a conversation.' },
  3: { name: 'Moderate to hard', feel: 'Talking is difficult.' },
  4: { name: 'Intense', feel: 'You speak in broken phrases.' },
  5: { name: 'Sprint', feel: "You can't talk." },
};

/**
 * Each zone as seconds per km around the easy pace E: `fast` is added to E
 * for the faster end, `slow` for the slower end. The bands touch, so every
 * pace falls in exactly one zone. Z2 holds the generator's easy range
 * (E-10 to E+20) and Z4 its interval pace (E-75 to E-45).
 */
const ZONE_OFFSETS: Record<Zone, { fast: number; slow: number }> = {
  1: { fast: 25, slow: 60 },
  2: { fast: -15, slow: 25 },
  3: { fast: -45, slow: -15 },
  4: { fast: -75, slow: -45 },
  5: { fast: -110, slow: -75 },
};

export type ZonePace = { min: number; max: number };

const round5 = (n: number) => Math.round(n / 5) * 5;
const clampPace = (n: number) =>
  Math.min(GOAL_PACE_MAX_S_PER_KM, Math.max(GOAL_PACE_MIN_S_PER_KM, n));

/** A zone's pace range (`min` is the faster end) for an easy pace. */
export function zonePace(easyPace: number, zone: Zone): ZonePace {
  const { fast, slow } = ZONE_OFFSETS[zone];
  const min = clampPace(round5(easyPace + fast));
  const max = clampPace(round5(easyPace + slow));
  return { min, max: Math.max(min, max) };
}

export function zonePaces(easyPace: number): Record<Zone, ZonePace> {
  return {
    1: zonePace(easyPace, 1),
    2: zonePace(easyPace, 2),
    3: zonePace(easyPace, 3),
    4: zonePace(easyPace, 4),
    5: zonePace(easyPace, 5),
  };
}
