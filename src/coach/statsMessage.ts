/**
 * Coach Mike's line on the Stats screen. Pure logic (no React): the single
 * place the screen gets its text from. The content comes from the rules in
 * `statsInsights.ts`.
 */

import type { SavedRun } from '../run/types';
import type { Plan } from './plan';
import type { RunnerProfile } from './runnerProfile';
import { getMikeInsight } from './statsInsights';

/** What Mike says, or `undefined` to hide his card. */
export function statsMikeMessage({
  runs,
  plan,
  profile,
  now = new Date(),
  firstName,
}: {
  runs: SavedRun[];
  plan?: Plan | null;
  profile?: RunnerProfile | null;
  /** The moment the data was loaded; the message is stable for that day. */
  now?: Date;
  firstName?: string;
}): string | undefined {
  return getMikeInsight({ runs, plan, profile, now, firstName })?.message;
}
