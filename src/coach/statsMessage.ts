/**
 * Coach Mike's line on the Stats screen. Pure logic (no React). For now
 * it is a placeholder greeting; the real content (what to say about the
 * runs) goes in this one function without touching the screen's layout.
 */

import type { SavedRun } from '../run/types';

/** What Mike says, or `undefined` to hide his card. */
export function statsMikeMessage({ runs }: { runs: SavedRun[] }): string | undefined {
  if (runs.length === 0) return 'Your runs will show up here. Ready when you are.';
  return 'Here are your runs. Tap one to see the details.';
}
